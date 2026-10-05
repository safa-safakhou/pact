import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AudioPort,
  clearExperiencePreferences,
  defaultExperiencePreferences,
  ExperienceAudio,
  readExperiencePreferences,
  saveExperiencePreferences,
} from "./experience-audio.js";

class FakeAudio implements AudioPort {
  volume = 1;
  loop = false;
  currentTime = 0;
  plays = 0;
  pauses = 0;
  loads = 0;
  src: string;
  constructor(src: string) {
    this.src = src;
  }
  play() {
    this.plays++;
    return Promise.resolve();
  }
  pause() {
    this.pauses++;
  }
  load() {
    this.loads++;
  }
}
afterEach(() => vi.useRealTimers());
function setup() {
  let time = 0;
  const made: FakeAudio[] = [];
  const engine = new ExperienceAudio(
    (file) => {
      const a = new FakeAudio(file);
      made.push(a);
      return a;
    },
    () => time,
  );
  return {
    engine,
    made,
    tick: (n: number) => {
      time += n;
    },
  };
}
describe("bounded cosmetic audio", () => {
  it("stays silent before gesture, shares one instance per loop and applies independent volumes", () => {
    const { engine, made } = setup();
    engine.configure(defaultExperiencePreferences);
    expect(made).toHaveLength(0);
    expect(engine.cue("initial", "build.wav")).toBe(false);
    engine.enable();
    expect(made).toHaveLength(2);
    engine.enable();
    engine.configure({ ...defaultExperiencePreferences, music: 0.1, ambience: 0.7 });
    expect(made).toHaveLength(2);
    expect(made.map((a) => a.volume)).toEqual([0.1, 0.7]);
    expect(engine.cue("initial", "build.wav")).toBe(false);
    engine.configure({ ...defaultExperiencePreferences, muted: true });
    expect(made.every((a) => a.pauses > 0)).toBe(true);
    engine.dispose();
  });
  it("consumes hidden/disabled cues without backlog and enforces event and honk cooldowns", () => {
    vi.useFakeTimers();
    const { engine, made, tick } = setup();
    engine.enable();
    expect(engine.cue("build1", "build.wav")).toBe(true);
    expect(engine.cue("build1", "build.wav")).toBe(false);
    tick(2999);
    expect(engine.cue("build2", "build.wav")).toBe(false);
    tick(1);
    expect(engine.cue("build3", "build.wav")).toBe(true);
    expect(engine.honk()).toBe(true);
    tick(9999);
    expect(engine.honk()).toBe(false);
    tick(1);
    expect(engine.honk()).toBe(true);
    engine.visibility(true);
    expect(engine.cue("hidden", "delivery.wav")).toBe(false);
    engine.visibility(false);
    expect(engine.cue("hidden", "delivery.wav")).toBe(false);
    expect(made.filter((a) => a.loop)).toHaveLength(2);
    engine.configure({ ...defaultExperiencePreferences, notifications: 0 });
    expect(engine.cue("disabled", "seal.wav")).toBe(false);
    engine.configure(defaultExperiencePreferences);
    expect(engine.cue("disabled", "seal.wav")).toBe(false);
    engine.dispose();
    expect(made.every((a) => a.src === "")).toBe(true);
    vi.runAllTimers();
    expect(engine.honk()).toBe(false);
  });
  it("blocks manual flavour when humour is off and keeps effects silent at zero", () => {
    const { engine, made } = setup();
    engine.enable();
    engine.configure({ ...defaultExperiencePreferences, humour: false });
    expect(engine.honk()).toBe(false);
    engine.configure({ ...defaultExperiencePreferences, effects: 0 });
    expect(engine.cue("muted-effects", "build.wav")).toBe(false);
    expect(engine.honk()).toBe(false);
    expect(made).toHaveLength(2);
    engine.dispose();
  });
  it("reads only owner-scoped bounded preferences, survives invalid storage and clears on signout", () => {
    const map = new Map<string, string>([["unrelated", "keep"]]);
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      get length() {
        return map.size;
      },
      key: (n: number) => Array.from(map.keys())[n] ?? null,
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
    saveExperiencePreferences(
      "owner-a",
      { ...defaultExperiencePreferences, music: 0.9, humour: false, motion: "off" },
      storage,
    );
    expect(readExperiencePreferences("owner-a", storage)).toMatchObject({ music: 0.9, humour: false, motion: "off" });
    expect(readExperiencePreferences("owner-b", storage)).toEqual(defaultExperiencePreferences);
    map.set("pact_experience:bad", '{"music":99,"effects":-8,"motion":"invented"}');
    expect(readExperiencePreferences("bad", storage)).toMatchObject({ music: 1, effects: 0, motion: "system" });
    map.set("pact_experience:broken", "{");
    expect(readExperiencePreferences("broken", storage)).toEqual(defaultExperiencePreferences);
    clearExperiencePreferences(storage);
    expect(Array.from(map.entries())).toEqual([["unrelated", "keep"]]);
  });
});
