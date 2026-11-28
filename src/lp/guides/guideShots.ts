import guideShots from "../kit/guideShots.json";
import type { Lang } from "../lpLang";

type GuideShot = { width: number; height: number; pins: number[][] };

/** Sizes and pin positions, written by `scripts/lp-guide-screenshots.mjs`. */
export const GUIDE_SHOTS = guideShots as unknown as Record<string, Record<Lang, GuideShot>>;
