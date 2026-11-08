/**
 * MIP-1291: two small menu triggers were 22px on a phone (the attachment "..." measured 24x22
 * at 390 wide, the GM tag pin 22px inside a 44px menu row). Under a coarse pointer they grow.
 * jsdom has no layout and no pointer, so this reads the CSS the components emit; the pixel
 * sizes were measured in Chromium with touch emulation (see the PR).
 */
import { CssVarsProvider } from "@mui/joy";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GMTagFilterRow } from "../features/chat/components/sidebar/GMTagFilterRow";
import { AttachmentActionsMenu } from "../features/notes/common/components/AttachmentActionsMenu";

vi.mock("../hooks/common/usePersonalGMTags", () => ({
    usePersonalGMTags: () => ({
        tags: [
            {
                tagId: 1,
                name: "Launch",
                color: "#8e23ff",
                textColor: "#ffffff",
                isDefaultVisible: true,
                sortOrder: 1,
            },
        ],
        defaultVisibleTagIds: [1],
        updateTag: vi.fn(),
    }),
}));
vi.mock("../features/chat/components/modals/ModalManageGMTags", () => ({
    ModalManageGMTags: () => null,
}));

afterEach(cleanup);

const allCss = () =>
    Array.from(document.querySelectorAll("style"))
        .map((s) => s.textContent ?? "")
        .join("\n");

/** The declarations a coarse-pointer media rule gives THIS element (matched by its Emotion class). */
const coarseRuleOf = (el: Element) => {
    const css = allCss();
    const rules: string[] = [];
    for (const cls of Array.from(el.classList).filter((c) => c.startsWith("css-"))) {
        const re = new RegExp(
            `@media \\(pointer: ?coarse\\) ?\\{\\.${cls}([^{]*)\\{([^}]*)\\}`,
            "g"
        );
        for (const m of css.matchAll(re)) rules.push(`${m[1]}{${m[2]}}`);
    }
    return rules.join("\n");
};

describe("small menu triggers grow on touch screens", () => {
    it("the attachment actions button gets a 36px hit area without growing its box", () => {
        render(
            <CssVarsProvider>
                <AttachmentActionsMenu
                    name="README.md"
                    onDownload={() => {}}
                    onImportAsNote={() => {}}
                />
            </CssVarsProvider>
        );
        const rule = coarseRuleOf(screen.getByRole("button", { name: /File actions for/ }));
        // A pseudo-element 7px past the box above and below: 22 + 14 = 36px to hit.
        expect(rule).toMatch(/^::after\{[^}]*position:absolute/);
        expect(rule).toMatch(/inset-block:-7px/);
        // The chip row's height must not change (the message list would reflow).
        expect(rule).not.toMatch(/min-height|--IconButton-size/);
    });

    it("the GM tag pin is 36px under a coarse pointer", async () => {
        render(
            <CssVarsProvider>
                <GMTagFilterRow selectedTagIds={new Set()} setSelectedTagIds={() => {}} />
            </CssVarsProvider>
        );
        await userEvent.click(screen.getByRole("button", { name: "Tags" }));
        await waitFor(() => expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0));
        // The pin is the only IconButton inside the menu rows.
        const pin = screen.getAllByRole("menuitem")[0].querySelector("button");
        expect(pin).not.toBeNull();
        expect(coarseRuleOf(pin!)).toMatch(/--IconButton-size:36px/);
    });
});
