import { describe, expect, it } from "vitest";
import {
  BASE_FADE_DURATION,
  BASE_SHIMMER_DURATION,
  durationForSpeed,
  normalizeAnimationSpeed,
} from "./settings";

describe("animation speed settings", () => {
  it("turns higher speed multipliers into shorter durations", () => {
    expect(durationForSpeed(BASE_SHIMMER_DURATION, 2)).toBe(450);
    expect(durationForSpeed(BASE_FADE_DURATION, 0.5)).toBe(480);
  });

  it("clamps values to the supported slider range", () => {
    expect(normalizeAnimationSpeed(0)).toBe(0.25);
    expect(normalizeAnimationSpeed(4)).toBe(3);
  });
});
