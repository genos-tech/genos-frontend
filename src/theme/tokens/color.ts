/**
 * Color math for the design tokens: OKLCH ⇄ sRGB, WCAG contrast, and
 * alpha compositing.
 *
 * Why OKLCH: it is perceptually uniform, so two grays at the same `L` look
 * equally light whatever hue they lean toward. That is what lets one set
 * of lightness steps produce a neutral scale for every color theme (the
 * same idea as Linear's LCH theme generator). Only the NEUTRALS are
 * generated here; brand ramps stay the hand-picked Tailwind hex values in
 * `themePalettes.ts`. Neutrals are low-chroma, so they never leave the sRGB
 * gamut and need no gamut mapping beyond a clamp.
 *
 * Formulas: Björn Ottosson, "A perceptual color space for image
 * processing" (2020), and WCAG 2.2 relative luminance.
 */

export type Rgb = [number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const hexToRgb = (hex: string): Rgb => {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
};

export const rgbToHex = ([r, g, b]: Rgb): string =>
    "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** "r, g, b", the shape `rgba(var(--x-rgb), α)` needs. Same helper the
 *  `--gp-*` palette uses, so the two systems can't format it differently. */
export { rgbTriplet as rgbString } from "../themePalettes";

const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (v: number) =>
    255 * clamp01(v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** sRGB hex → OKLCH. `h` in degrees. */
export const hexToOklch = (hex: string): { l: number; c: number; h: number } => {
    const [r, g, b] = hexToRgb(hex).map(toLinear);
    const l_ = Math.cbrt(0.4122214708 * r + 0.5363015719 * g + 0.0514459929 * b);
    const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
    const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
    const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
    return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
};

/** OKLCH → sRGB hex, clamped into gamut. */
export const oklchToHex = (l: number, c: number, h: number): string => {
    const rad = (h * Math.PI) / 180;
    const A = c * Math.cos(rad);
    const B = c * Math.sin(rad);
    const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
    return rgbToHex([
        fromLinear(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
        fromLinear(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
        fromLinear(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
    ]);
};

/** WCAG 2.2 relative luminance. */
export const luminance = (hex: string): number => {
    const [r, g, b] = hexToRgb(hex).map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two opaque colors, 1–21. */
export const contrast = (a: string, b: string): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

/** Paint `fg` at `alpha` over the opaque `bg`; returns the opaque result.
 *  Alpha tokens (hover fills, subtle tints) are judged by what they
 *  actually render as on the surface beneath them. */
export const composite = (fg: string, alpha: number, bg: string): string => {
    const f = hexToRgb(fg);
    const b = hexToRgb(bg);
    return rgbToHex(f.map((v, i) => v * alpha + b[i] * (1 - alpha)) as Rgb);
};
