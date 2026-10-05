export type ExperiencePreferences = {
  muted: boolean;
  music: number;
  effects: number;
  ambience: number;
  notifications: number;
  humour: boolean;
  motion: "system" | "on" | "off";
};
export const defaultExperiencePreferences: ExperiencePreferences = {
  muted: false,
  music: 0.22,
  effects: 0.35,
  ambience: 0.3,
  notifications: 0.65,
  humour: true,
  motion: "system",
};
const prefix = "pact_experience:";
export function clearExperiencePreferences(storage: Pick<Storage, "length" | "key" | "removeItem">): void {
  try {
    for (let n = storage.length - 1; n >= 0; n--) {
      const key = storage.key(n);
      if (key?.startsWith(prefix)) storage.removeItem(key);
    }
  } catch {}
}
export function readExperiencePreferences(owner: string, storage: Pick<Storage, "getItem">): ExperiencePreferences {
  try {
    const raw = JSON.parse(storage.getItem(prefix + owner) ?? "{}") as Record<string, unknown>;
    const value = { ...defaultExperiencePreferences };
    for (const key of ["music", "effects", "ambience", "notifications"] as const)
      if (typeof raw[key] === "number" && Number.isFinite(raw[key])) value[key] = Math.max(0, Math.min(1, raw[key]));
    if (typeof raw.muted === "boolean") value.muted = raw.muted;
    if (typeof raw.humour === "boolean") value.humour = raw.humour;
    if (raw.motion === "on" || raw.motion === "off" || raw.motion === "system") value.motion = raw.motion;
    return value;
  } catch {
    return { ...defaultExperiencePreferences };
  }
}
export function saveExperiencePreferences(
  owner: string,
  value: ExperiencePreferences,
  storage: Pick<Storage, "setItem">,
): void {
  try {
    storage.setItem(prefix + owner, JSON.stringify(value));
  } catch {}
}
export interface AudioPort {
  volume: number;
  loop: boolean;
  currentTime: number;
  src: string;
  play(): Promise<void>;
  pause(): void;
  load(): void;
}
export class ExperienceAudio {
  private enabled = false;
  private hidden = false;
  private disposed = false;
  private prefs: ExperiencePreferences;
  private readonly loops = new Map<"music" | "ambience", AudioPort>();
  private readonly effects = new Set<AudioPort>();
  private readonly seen = new Set<string>();
  private lastCue = -Infinity;
  private lastHonk = -Infinity;
  constructor(
    private readonly make: (file: string) => AudioPort,
    private readonly now: () => number,
    prefs = defaultExperiencePreferences,
  ) {
    this.prefs = { ...prefs };
  }
  enable(): void {
    if (this.disposed) return;
    this.enabled = true;
    this.sync();
  }
  configure(prefs: ExperiencePreferences): void {
    this.prefs = { ...prefs };
    this.sync();
  }
  visibility(hidden: boolean): void {
    this.hidden = hidden;
    this.stopEffects();
    this.sync();
  }
  private playable(): boolean {
    return this.enabled && !this.hidden && !this.disposed && !this.prefs.muted;
  }
  private sync(): void {
    for (const category of ["music", "ambience"] as const) {
      let audio = this.loops.get(category);
      if (this.playable() && this.prefs[category] > 0) {
        if (!audio) {
          audio = this.make(category === "music" ? "settlement.wav" : "ambience.wav");
          audio.loop = true;
          this.loops.set(category, audio);
        }
        audio.volume = this.prefs[category];
        void audio.play().catch(() => {});
      } else audio?.pause();
    }
    if (!this.playable() || this.prefs.effects === 0 || this.prefs.notifications === 0) this.stopEffects();
  }
  /** First observation while silent/hidden is consumed; no queued replay on return. */
  cue(key: string, file: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    if (
      !this.playable() ||
      this.prefs.effects === 0 ||
      this.prefs.notifications === 0 ||
      this.now() - this.lastCue < 3000
    )
      return false;
    this.lastCue = this.now();
    this.playEffect(file, this.prefs.effects * this.prefs.notifications, 2000);
    return true;
  }
  honk(): boolean {
    if (!this.playable() || !this.prefs.humour || this.prefs.effects === 0 || this.now() - this.lastHonk < 10000)
      return false;
    this.lastHonk = this.now();
    this.playEffect("honk.wav", this.prefs.effects, 800);
    return true;
  }
  private playEffect(file: string, volume: number, duration: number): void {
    const audio = this.make(file);
    audio.volume = volume;
    this.effects.add(audio);
    void audio.play().catch(() => {
      this.release(audio);
      this.effects.delete(audio);
    });
    setTimeout(() => {
      this.release(audio);
      this.effects.delete(audio);
    }, duration);
  }
  private release(audio: AudioPort): void {
    audio.pause();
    audio.src = "";
    audio.load();
  }
  private stopEffects(): void {
    for (const audio of this.effects) this.release(audio);
    this.effects.clear();
  }
  dispose(): void {
    this.disposed = true;
    this.stopEffects();
    for (const audio of this.loops.values()) this.release(audio);
    this.loops.clear();
  }
}
