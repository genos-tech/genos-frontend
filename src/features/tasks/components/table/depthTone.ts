import { g } from "../../../../theme/tokens";

// A nested row is told apart by its indent and a quiet tone per depth: a 3px guide on the
// left edge and a faint wash of the same hue (1st level none; 2nd, 3rd, 4th+ each their own
// hue). The pilot (MIP-1123) had one grey guide for every depth; Ken asked for the levels to
// be tellable again (MIP-1175), without the old loud blue / teal / amber rows.
// Its own module so the row, the quick-add draft row and the tests share it.
const DEPTH_TONES = [g.accent, g.info, g.success] as const;
export const depthRowTone = (rowDepth: number) => {
    if (rowDepth <= 0) return null;
    const hue = DEPTH_TONES[Math.min(rowDepth, DEPTH_TONES.length) - 1];
    return {
        guide: hue.solid,
        wash: `color-mix(in srgb, ${hue.solid} 11%, transparent)`,
    };
};
export const depthRowLeftBorder = (rowDepth: number): string =>
    `3px solid ${depthRowTone(rowDepth)?.guide ?? "transparent"}`;
export const depthRowBackground = (rowDepth: number): string =>
    depthRowTone(rowDepth)?.wash ?? "transparent";
