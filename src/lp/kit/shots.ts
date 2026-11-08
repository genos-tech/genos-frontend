import shots from "./shots.json";

/**
 * The product screenshots the marketing pages use, and the rectangle of the app window each one
 * shows (CSS pixels: `width` x `height` at 1x, cut from `x`,`y` of a 1440x900 desktop window or a
 * 390x844 phone).
 *
 * `shots.json` is the one source: `scripts/lp-screenshots.mjs` reads it to cut each picture, and
 * `Shot` reads it so the browser reserves the space before the image arrives (no layout shift).
 * Each exists for both languages under `public/lp/shots/<lang>/`, at 1x (`<name>.webp`) and 2x
 * (`<name>@2x.webp`); `LandingPageMIP1232.test.tsx` fails if one is missing. Pictures are cut to the
 * part that carries the point (the answer, the table, the card), not the whole window, so the text
 * in them stays readable at the width the page shows them. Retake the set whenever the app's UI
 * changes: see the header of the script.
 */
export type ShotName = keyof typeof shots;

/** The rectangle of one shot; a language may override parts of it (an answer can run longer in Japanese). */
export type ShotRect = { width: number; height: number; x: number; y: number };

export const SHOTS = shots as Record<
    ShotName,
    ShotRect & Partial<Record<"ja" | "en", Partial<ShotRect>>>
>;

export const shotRect = (name: ShotName, lang: "ja" | "en"): ShotRect => {
    const { width, height, x, y } = SHOTS[name];
    return { width, height, x, y, ...SHOTS[name][lang] };
};

export const SHOT_NAMES = Object.keys(shots) as ShotName[];
