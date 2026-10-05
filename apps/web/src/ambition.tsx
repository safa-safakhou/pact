import { useEffect, useState } from "react";
export type Ambition = "neutral" | "farmer" | "trader" | "defender";
export const ambitionDescriptions: Record<Ambition, string> = {
  neutral: "Choose your own next objective.",
  farmer: "Grow a dependable food supply before making promises.",
  trader: "Build useful exchanges with real neighbouring kingdoms.",
  defender: "Prepare your kingdom while respecting your chosen limits.",
};
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
    <section className="game-card" aria-label="Your private ambition">
      <h3>What kind of kingdom are you building?</h3>
      <p>{ambitionDescriptions[value]} Your ambition is private guidance, not a class or bonus.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            await save(choice);
          } catch {
            setError("Ambition was not saved. Reconnect and try again.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          Private ambition{" "}
          <select value={choice} disabled={disabled || saving} onChange={(e) => setChoice(e.target.value as Ambition)}>
            <option value="neutral">Choose freely</option>
            <option value="farmer">Farmer</option>
            <option value="trader">Trader</option>
            <option value="defender">Defender</option>
          </select>
        </label>
        <button type="submit" disabled={disabled || saving || choice === value}>
          {saving ? "Saving…" : "Save ambition"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
