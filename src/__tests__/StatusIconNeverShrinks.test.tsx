/**
 * MIP-1156: an icon-only status next to a title (the sidebar's Recents rows).
 * In a narrow row it used to be squeezed to nothing while its glyph overflowed
 * onto the title beside it. jsdom cannot measure layout; this pins the rule that
 * prevents it, and that a labelled status may still shrink (its words truncate).
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusLabel } from "../features/tasks/components/meta/StatusLabel";

describe("StatusLabel in a narrow row", () => {
    it("an icon-only status never shrinks", () => {
        const { getByRole } = render(<StatusLabel status="WIP" iconOnly />);
        expect(getByRole("img", { name: "WIP" }).style.flexShrink).toBe("0");
    });

    it("a status with words may shrink (the words truncate)", () => {
        const { getByText } = render(<StatusLabel status="WIP" />);
        expect(getByText("WIP").parentElement!.style.flexShrink).toBe("");
    });
});
