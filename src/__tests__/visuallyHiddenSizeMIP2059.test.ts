/**
 * MIP-2059: in MUI `sx` a bare `width: 1` is 100% and `margin: -1` is -8px, which made every
 * "visually hidden" live region a parent-sized box that stretched the Settings modal's scroll
 * area. The sizes must be 1px strings.
 */
import { describe, expect, it } from "vitest";

import { visuallyHidden } from "../components/ui/a11y/visuallyHidden";

describe("visuallyHidden", () => {
    it("is 1px by 1px, not a fraction of its parent", () => {
        expect(visuallyHidden.width).toBe("1px");
        expect(visuallyHidden.height).toBe("1px");
        expect(visuallyHidden.margin).toBe("-1px");
    });
});
