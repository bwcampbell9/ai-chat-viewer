export const BASE_SHIMMER_DURATION = 900;
export const BASE_FADE_DURATION = 240;
export const MIN_ANIMATION_SPEED = 0.25;
export const MAX_ANIMATION_SPEED = 3;

export function normalizeAnimationSpeed(speed: number): number {
  return Math.min(MAX_ANIMATION_SPEED, Math.max(MIN_ANIMATION_SPEED, speed));
}

export function durationForSpeed(baseDuration: number, speed: number): number {
  return Math.round(baseDuration / normalizeAnimationSpeed(speed));
}
