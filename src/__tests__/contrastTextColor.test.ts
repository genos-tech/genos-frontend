import { describe, expect, it } from "vitest";

import { getContrastTextColor } from "../features/tasks/utils/contrastTextColor";

// The picker stores this as a color's `textColor`, the API applies the same
// rule (`text_color_for`) to a label the agent makes, and the agent's approval
// card draws that label with it.
describe("getContrastTextColor", () => {
    it.each([
        ["#ffd93b", "black"],
        ["#ffffff", "black"],
        ["#00ffff", "black"],
        ["#0044c2", "white"],
        ["#000000", "white"],
        ["#7c3aed", "white"],
        ["#808080", "white"],
    ])("%s reads with %s text", (hex, text) => {
        expect(getContrastTextColor(hex)).toBe(text);
    });

    it("switches to black just above a luminance of 0.6", () => {
        // 0.299*153 + 0.587*153 + 0.114*153 = 153 -> exactly 0.6, which is not above it.
        expect(getContrastTextColor("#999999")).toBe("white");
        expect(getContrastTextColor("#9a9a9a")).toBe("black");
    });
});
