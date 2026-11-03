/**
 * Black or white, whichever reads on a `#rrggbb` fill. The tag and label
 * color picker (`TagColorPickerMenu`) stores this as a color's `textColor`,
 * and the API applies the same rule (`text_color_for`) when the agent makes
 * a project label, so a label made by a tool looks like one picked by hand.
 * One copy, so the picker and the agent's approval card cannot drift.
 */
export const getContrastTextColor = (hex: string): "black" | "white" => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "black" : "white";
};
