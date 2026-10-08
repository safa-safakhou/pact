import { useEffect, useState } from "react";
export type Ambition = string;
export function AmbitionChoice({
  value,
  disabled,
  save,
}: {
  value: Ambition;
  disabled: boolean;
  save: (value: Ambition) => Promise<void>;
}) {
  const [choice, setChoice] = useState(value),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setChoice(value);
  }, [value]);
  return (
    <section className="game-card" aria-label="Your private notes">
      <h3>Private notes</h3>
      <p>Write any goals, observations, plans or reminders. You and your agent can decide what belongs here.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            await save(choice);
          } catch {
            setError("Notes were not saved. Reconnect and try again.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          Private notes{" "}
          <textarea
            value={choice}
            maxLength={8000}
            rows={6}
            disabled={disabled || saving}
            onChange={(e) => setChoice(e.target.value)}
          />
        </label>
        <button type="submit" disabled={disabled || saving || choice === value}>
          {saving ? "Saving…" : "Save notes"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
