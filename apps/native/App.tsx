import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { Button, SafeAreaView, Text, View } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const origin = process.env.EXPO_PUBLIC_PACT_ORIGIN ?? "https://pact.example";
const clientId = "pact-native";

export default function App() {
  const [status, setStatus] = useState("Signed out");
  const accessToken = useRef<string | undefined>(undefined);
  const redirectUri = `${origin}/native/callback`;

  const signIn = async () => {
    setStatus("Opening secure sign-in…");
    const request = new AuthSession.AuthRequest({
      clientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      scopes: ["world:read", "game:act"],
      extraParams: { audience: "human", resource: `${origin}/native`, subject_label: "PACT native app" },
    });
    const result = await request.promptAsync({
      authorizationEndpoint: `${origin}/oauth/authorize`,
    });
    if (result.type !== "success" || !result.params.code || !request.codeVerifier) {
      setStatus("Sign-in cancelled");
      return;
    }
    const response = await fetch(`${origin}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        code: result.params.code,
        redirect_uri: redirectUri,
        code_verifier: request.codeVerifier,
        resource: `${origin}/native`,
      }),
    });
    const tokens = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      audience?: string;
    };
    if (!response.ok || tokens.audience !== "human" || !tokens.access_token || !tokens.refresh_token) {
      setStatus("Sign-in rejected");
      return;
    }
    accessToken.current = tokens.access_token;
    await SecureStore.setItemAsync("pact.native.refresh.v1", tokens.refresh_token);
    setStatus("Signed in");
  };

  return (
    <SafeAreaView>
      <View accessibilityRole="summary">
        <Text accessibilityRole="header">PACT</Text>
        <Text>{status}</Text>
        <Button title="Sign in to PACT" onPress={() => void signIn()} />
      </View>
    </SafeAreaView>
  );
}
