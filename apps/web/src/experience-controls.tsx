import { useEffect, useRef, useState } from "react";
import { pactBaseUrl } from "./client-location.js";
import {
  ExperienceAudio,
  type ExperiencePreferences,
  readExperiencePreferences,
  saveExperiencePreferences,
} from "./experience-audio.js";
export function ExperienceControls({
  owner,
  onAudioReady,
}: {
  owner: string;
  onAudioReady?: (audio: ExperienceAudio | null) => void;
}) {
  const [prefs, setPrefs] = useState(() => readExperiencePreferences(owner, localStorage));
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [gag, setGag] = useState(false);
  useEffect(() => {
    if (!gag) return;
    const timer = setTimeout(() => setGag(false), 700);
    return () => clearTimeout(timer);
  }, [gag]);
  const audio = useRef<ExperienceAudio | null>(null);
  useEffect(() => {
    const engine = new ExperienceAudio(
      (file) => new Audio(`${pactBaseUrl()}experience/audio/${file}`),
      () => performance.now(),
      readExperiencePreferences(owner, localStorage),
    );
    audio.current = engine;
    onAudioReady?.(engine);
    const visibility = () => engine.visibility(document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      engine.dispose();
      audio.current = null;
      onAudioReady?.(null);
    };
  }, [owner, onAudioReady]);
  useEffect(() => {
    audio.current?.configure(prefs);
    saveExperiencePreferences(owner, prefs, localStorage);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      document.documentElement.dataset.experienceMotion =
        prefs.motion === "off" || (prefs.motion === "system" && media.matches) ? "off" : "on";
      document.documentElement.dataset.experienceHumour = prefs.humour ? "on" : "off";
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      delete document.documentElement.dataset.experienceMotion;
      delete document.documentElement.dataset.experienceHumour;
    };
  }, [owner, prefs]);
  function update<K extends keyof ExperiencePreferences>(key: K, value: ExperiencePreferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }
  return (
    <details className="game-card experience-controls">
      <summary>Sound, humour and motion</summary>
      <p>Sound starts only when you enable it here. Every game fact remains readable without sound or motion.</p>
      <button
        type="button"
        disabled={enabled}
        onClick={() => {
          audio.current?.enable();
          setEnabled(true);
        }}
      >
        Enable sound
      </button>
      <label>
        <input type="checkbox" checked={prefs.muted} onChange={(e) => update("muted", e.target.checked)} />
        Master mute
      </label>
      {(["music", "effects", "ambience", "notifications"] as const).map((key) => (
        <label key={key} htmlFor={`experience-${key}`}>
          {key} volume ({Math.round(prefs[key] * 100)}%)
          <input
            id={`experience-${key}`}
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={prefs[key]}
            onChange={(e) => update(key, Number(e.target.value))}
          />
        </label>
      ))}
      <label>
        <input
          type="checkbox"
          checked={prefs.humour}
          onChange={(e) => {
            update("humour", e.target.checked);
            setMessage("");
          }}
        />
        Humour
      </label>
      <label htmlFor="experience-motion">Motion</label>
      <select
        id="experience-motion"
        value={prefs.motion}
        onChange={(e) => update("motion", e.target.value as ExperiencePreferences["motion"])}
      >
        <option value="system">Follow system</option>
        <option value="off">Static</option>
        <option value="on">Allow motion</option>
      </select>
      {prefs.humour && (
        <div data-flavour>
          <img
            className={gag ? "experience-gag" : ""}
            src={`${pactBaseUrl()}experience/characters/honk-${gag ? "pleased" : "idle"}.png`}
            width="96"
            height="106"
            alt="Sir Honk cosmetic portrait"
          />
          <p>HONK. The goose has filed a noise complaint. Cosmetic sound only.</p>
          <button
            type="button"
            disabled={!enabled || prefs.muted}
            onClick={() => {
              const played = audio.current?.honk();
              if (played) setGag(true);
              setMessage(
                played
                  ? "HONK. The goose has filed a noise complaint. No game action."
                  : "Please wait: one squawk per ten seconds.",
              );
            }}
          >
            Preview goose sound
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
