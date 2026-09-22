import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Button, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { createNativeApi, NativeApiError } from "./src/native-api.js";

WebBrowser.maybeCompleteAuthSession();

const publicBaseUrl = (process.env.EXPO_PUBLIC_PACT_ORIGIN ?? "https://safa.dedyn.io/pact").replace(/\/$/, "");
const clientId = "pact-native";
const refreshKey = "pact.native.refresh.v1";
const redirectUri = `${publicBaseUrl}/native/callback`;
const api = createNativeApi({ baseUrl: publicBaseUrl, clientId, fetch: globalThis.fetch.bind(globalThis) });

function message(error: unknown): string {
  if (error instanceof NativeApiError) return error.code;
  if (error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)) return error.message;
  return "REQUEST_FAILED";
}

export default function App() {
  const [status, setStatus] = useState("Restoring session…");
  const [output, setOutput] = useState("No server state loaded yet.");
  const [accessToken, setAccessToken] = useState<string>();
  const [approvalId, setApprovalId] = useState("");
  const [busy, setBusy] = useState(false);
  const approvalRequests = useRef(new Map<string, Promise<unknown>>());

  const show = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      const result = await operation();
      setOutput(JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      setOutput(message(error));
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const acceptTokens = useCallback(async (tokens: Awaited<ReturnType<typeof api.refresh>>) => {
    if (tokens.audience !== "human") throw new Error("WRONG_AUDIENCE");
    await SecureStore.setItemAsync(refreshKey, tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    setStatus("Signed in");
    return tokens.accessToken;
  }, []);

  const loadDraft = useCallback(async () => {
    if (!accessToken) throw new Error("UNAUTHENTICATED");
    return api.loadDraft(accessToken);
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(refreshKey)
      .then(async (refreshToken) => {
        if (!refreshToken) {
          if (active) setStatus("Signed out");
          return;
        }
        const tokens = await api.refresh(refreshToken);
        if (!active) return;
        const token = await acceptTokens(tokens);
        setOutput(JSON.stringify(await api.loadDraft(token), null, 2));
      })
      .catch(async (error: unknown) => {
        await SecureStore.deleteItemAsync(refreshKey).catch(() => undefined);
        if (active) {
          setAccessToken(undefined);
          setStatus("Session expired");
          setOutput(message(error));
        }
      });
    return () => {
      active = false;
    };
  }, [acceptTokens]);

  useEffect(() => {
    if (!accessToken) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void loadDraft()
          .then((draft) => setOutput(JSON.stringify(draft, null, 2)))
          .catch((error: unknown) => setOutput(message(error)));
      }
    });
    return () => subscription.remove();
  }, [accessToken, loadDraft]);

  const signIn = async () => {
    setStatus("Opening secure sign-in…");
    await show(async () => {
      const request = new AuthSession.AuthRequest({
        clientId,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        scopes: ["world:read", "game:act"],
        extraParams: {
          audience: "human",
          resource: `${publicBaseUrl}/native`,
          subject_label: "PACT native app",
        },
      });
      const result = await request.promptAsync({ authorizationEndpoint: `${publicBaseUrl}/oauth/authorize` });
      if (result.type !== "success" || !result.params.code || !request.codeVerifier) {
        setStatus("Sign-in cancelled");
        return { authenticated: false };
      }
      const token = await acceptTokens(
        await api.exchangeCode({ code: result.params.code, verifier: request.codeVerifier, redirectUri }),
      );
      return api.loadDraft(token);
    }).catch(() => setStatus("Sign-in rejected"));
  };

  const revoke = async () => {
    await show(async () => {
      const refreshToken = await SecureStore.getItemAsync(refreshKey);
      try {
        if (refreshToken) await api.revoke(refreshToken);
      } finally {
        await SecureStore.deleteItemAsync(refreshKey).catch(() => undefined);
        setAccessToken(undefined);
        setStatus("Signed out");
      }
      return { revoked: true };
    });
  };

  const approveOnce = (id: string): Promise<unknown> => {
    if (!accessToken) return Promise.reject(new Error("UNAUTHENTICATED"));
    const current = approvalRequests.current.get(id);
    if (current) return current;
    const request = api.approve(accessToken, id).finally(() => approvalRequests.current.delete(id));
    approvalRequests.current.set(id, request);
    return request;
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 20 }}>
        <View accessibilityRole="summary" style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "700" }}>
            PACT
          </Text>
          <Text>{status}</Text>
          {!accessToken ? (
            <Button disabled={busy} title="Sign in to PACT" onPress={() => void signIn().catch(() => undefined)} />
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <Button
            disabled={busy || !accessToken}
            title="Reload private draft"
            onPress={() => void show(loadDraft).catch(() => undefined)}
          />
          <Button
            disabled={busy || !accessToken}
            title="Submit sandbox action"
            onPress={() =>
              void show(() => {
                if (!accessToken) throw new Error("UNAUTHENTICATED");
                return api.submitSandboxEcho(accessToken, Crypto.randomUUID(), "PACT native development-build proof");
              }).catch(() => undefined)
            }
          />
        </View>

        <View style={{ gap: 8 }}>
          <TextInput
            accessibilityLabel="Approval ID"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setApprovalId}
            placeholder="Approval ID"
            style={{ borderColor: "#777", borderRadius: 6, borderWidth: 1, padding: 10 }}
            value={approvalId}
          />
          <Button
            disabled={busy || !accessToken || !approvalId}
            title="Review exact approval"
            onPress={() =>
              void show(() => {
                if (!accessToken) throw new Error("UNAUTHENTICATED");
                return api.reviewApproval(accessToken, approvalId);
              }).catch(() => undefined)
            }
          />
          <Button
            disabled={busy || !accessToken || !approvalId}
            title="Approve exact action"
            onPress={() => void show(() => approveOnce(approvalId)).catch(() => undefined)}
          />
        </View>

        <Button
          disabled={busy || !accessToken}
          title="Revoke this connection"
          onPress={() => void revoke().catch(() => undefined)}
        />
        <Text accessibilityLiveRegion="polite" selectable style={{ fontFamily: "Courier", fontSize: 12 }}>
          {output}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
