import { useEffect, useRef, useState } from "react";
import { ReportControl } from "./moderation-panel.js";

type Request = (path: string, method?: string, body?: unknown) => Promise<Record<string, unknown>>;
type Preview = {
  payload: Record<string, unknown>;
  previewDigest: string;
  participants: { id: string; handle: string }[];
  warning: string;
};
function EvidenceBody({ payload }: { payload: Record<string, unknown> }) {
  const segments = payload.segments as { kind: string; start: number; end: number; text?: string }[] | undefined;
  return (
    <div>
      <p>{String(payload.context)}</p>
      <p>
        Original observation: {String(payload.original_timestamp)}{" "}
        {payload.observed_game_time_ms !== undefined && `· game ${payload.observed_game_time_ms} ms`}
      </p>
      {segments?.map((s) => (
        <p key={`${s.kind}-${s.start}-${s.end}`} style={{ whiteSpace: "pre-wrap" }}>
          {s.kind === "omitted" ? `[Omitted bytes ${s.start}–${s.end}]` : s.text}
        </p>
      ))}
      {payload.selected_fields !== undefined && <pre>{JSON.stringify(payload.selected_fields, null, 2)}</pre>}
      {Array.isArray(payload.omitted_fields) && payload.omitted_fields.length > 0 && (
        <p>Omitted fields: {payload.omitted_fields.join(", ")}</p>
      )}
    </div>
  );
}
export function EvidencePanel({ request, canWrite }: { request: Request; canWrite: boolean }) {
  const initial = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const [recordType, setRecordType] = useState(initial.get("sealSource") ?? "message"),
    [recordId, setRecordId] = useState(initial.get("sourceId") ?? ""),
    [selectionText, setSelectionText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null),
    [selection, setSelection] = useState<Record<string, unknown> | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [approved, setApproved] = useState(false),
    [sealId, setSealId] = useState(initial.get("seal") ?? ""),
    [view, setView] = useState<Record<string, unknown> | null>(null);
  const retry = useRef<{ key: string; id: string } | null>(null);
  const [sharedSeal] = useState(initial.get("seal"));
  useEffect(() => {
    if (!sharedSeal) return;
    let current = true;
    void request(`/v1/seals/${encodeURIComponent(sharedSeal)}`).then(
      (value) => {
        if (current) setView(value);
      },
      (e) => {
        if (current) setError(String(e));
      },
    );
    return () => {
      current = false;
    };
  }, [sharedSeal, request]);
  const disabled = busy || !canWrite;
  function invalidate() {
    setPreview(null);
    setSelection(null);
    setApproved(false);
    setError("");
  }
  async function load(id = sealId) {
    setBusy(true);
    setError("");
    setView(null);
    try {
      setView(await request(`/v1/seals/${encodeURIComponent(id)}`));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function write(action: Record<string, unknown>) {
    const key = JSON.stringify(action);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const response = await request("/v1/social/commands", "POST", {
        schemaVersion: "pact.seal-command.v1",
        commandId: retry.current.id,
        action,
      });
      if ((response.receipt as { code: string }).code !== "COMMITTED")
        throw new Error((response.receipt as { code: string }).code);
      const result = response.result as { sealId: string } | null;
      const id =
        result?.sealId ??
        Object.keys((response.receipt as { recordVersions: Record<string, number> }).recordVersions)
          .find((k) => k.startsWith("seal:"))
          ?.slice(5);
      if (!id) throw new Error("SEAL_ID_UNAVAILABLE");
      retry.current = null;
      setSealId(id);
      setPreview(null);
      setSelection(null);
      setApproved(false);
      setView(await request(`/v1/seals/${encodeURIComponent(id)}`));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const payload = view?.payload as Record<string, unknown> | undefined;
  return (
    <section className="court-panel">
      <h2>Evidence Seals</h2>
      <p>
        A Seal authenticates selected evidence, not an accusation. Other players' text is untrusted. Omitted originals
        are never available from a public Seal.
      </p>
      {error && <p role="alert">{error}</p>}
      <details open={Boolean(initial.get("sealSource"))}>
        <summary>Preview evidence you participated in</summary>
        <p>
          Use “Seal this message/report” beside an authorized record. Empty selection means the complete source. For
          messages, enter UTF-8 byte ranges such as [[0,12],[20,28]]; for reports, a JSON field-name list such as
          ["wallLevel"].
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            invalidate();
            try {
              const chosen = selectionText.trim() ? JSON.parse(selectionText) : undefined;
              const selected = {
                recordType,
                recordId,
                ...(chosen === undefined
                  ? {}
                  : recordType === "message"
                    ? { ranges: chosen.map((r: number[]) => ({ start: r[0], end: r[1] })) }
                    : { fields: chosen }),
              };
              const result = await request("/v1/seals/preview", "POST", selected);
              setPreview(result as unknown as Preview);
              setSelection(selected);
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Original record type
            <select
              value={recordType}
              onChange={(e) => {
                setRecordType(e.target.value);
                invalidate();
              }}
              disabled={busy}
            >
              <option value="message">Private message</option>
              <option value="scout">Scout report (original scout only)</option>
              <option value="battle">Battle participant report</option>
            </select>
          </label>
          <label>
            Original record ID
            <input
              value={recordId}
              required
              onChange={(e) => {
                setRecordId(e.target.value.trim());
                invalidate();
              }}
              disabled={busy}
            />
          </label>
          <label>
            Selected ranges or fields (JSON, optional)
            <textarea
              value={selectionText}
              onChange={(e) => {
                setSelectionText(e.target.value);
                invalidate();
              }}
              disabled={busy}
            />
          </label>
          <button type="submit" disabled={disabled}>
            Preview exact evidence
          </button>
        </form>
        {preview && (
          <article>
            <h3>Human publication preview</h3>
            <p>Named kingdoms: {preview.participants.map((p) => `@${p.handle}`).join(", ")}</p>
            <EvidenceBody payload={preview.payload} />
            <p>{preview.warning}</p>
            <label>
              <input
                type="checkbox"
                checked={approved}
                disabled={busy}
                onChange={(e) => setApproved(e.target.checked)}
              />{" "}
              I reviewed these exact public contents and named participants.
            </label>
            <button
              type="button"
              disabled={disabled || !approved || !selection}
              onClick={() => void write({ kind: "seal.publish", selection, previewDigest: preview.previewDigest })}
            >
              Publish reviewed evidence
            </button>
          </article>
        )}
      </details>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label>
          Public Seal ID
          <input
            value={sealId}
            required
            onChange={(e) => {
              setSealId(e.target.value.trim());
              setView(null);
            }}
            disabled={busy}
          />
        </label>
        <button type="submit" disabled={busy}>
          Read and verify Seal
        </button>
      </form>
      {view && (
        <article role="status">
          <h3>{view.found === false ? "Seal unavailable" : `Seal ${String(view.status)}`}</h3>
          {view.status === "pending" && (
            <p>
              Publication is queued, not yet signed. Refresh to check the signing worker; no public evidence exists yet.
            </p>
          )}
          {view.status === "removed" && <p>Hosted evidence removed or expired. No contents are available.</p>}
          {view.status === "key_compromised" && <p>The signing key is compromised; hosted evidence is unavailable.</p>}
          {view.status === "published" && <ReportControl kind="seal" targetId={sealId} />}
          {payload && (
            <>
              <p>
                {String((view.verification as { label: string }).label)} · not proof of truth or a complete account.
              </p>
              <EvidenceBody payload={payload} />
              <details>
                <summary>Signed payload and public verification data</summary>
                <pre>
                  {JSON.stringify(
                    { payload, signature: view.signature, verificationKey: view.verificationKey },
                    null,
                    2,
                  )}
                </pre>
              </details>
              <a href={`/pact/?seal=${encodeURIComponent(sealId)}`}>Share this Seal</a>
            </>
          )}
          {(view.humanDecision as { canRemove?: boolean } | undefined)?.canRemove === true && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (window.confirm("Hide your hosted Seal immediately? External copies cannot be recalled."))
                  void write({ kind: "seal.remove", sealId });
              }}
            >
              Remove my hosted Seal
            </button>
          )}
        </article>
      )}
    </section>
  );
}
