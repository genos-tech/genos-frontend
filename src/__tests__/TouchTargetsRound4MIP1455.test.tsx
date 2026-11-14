/**
 * MIP-1455 (touch targets, round 4): the tab strip's tab and close x, the graph's "Click to edit
 * dates" and legend toggle are 44px taps on a touch screen, and nothing changes with a mouse. The
 * chat list row's pin / "..." / avatar and the search box's "Open" arrow were taken OUT again
 * (a phone could not open a chat): see the chat list test below.
 *
 * jsdom evaluates no `@media` and lays nothing out, so the CSS the components emit is read as text
 * (`cssWithMediaOf`) and the call sites that need a graph or a chat list are pinned by their
 * source, as `TouchTargetsLastMIP1319` does. The 44px result at 390 was NOT measured here (see PR).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cssWithMediaOf } from "./utils/cssOf";

import { TabStrip } from "../components/ui/feedback/TabStrip";

afterEach(cleanup);

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const outsideMedia = (css: string) => css.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, "");

describe("TabStrip", () => {
    const renderStrip = () =>
        render(
            <CssVarsProvider>
                <TabStrip
                    ariaLabel="Open notes"
                    closeLabel="Close"
                    tabs={[
                        { id: "a", label: "Alpha", closable: true },
                        { id: "b", label: "Beta", closable: true },
                    ]}
                    value="a"
                    onChange={() => {}}
                    onClose={() => {}}
                />
            </CssVarsProvider>
        );

    it("a tab is at least 44 x 44 on a touch screen only", () => {
        renderStrip();
        const css = cssWithMediaOf(screen.getByRole("tab", { name: "Alpha" }));
        expect(css).toMatch(/@media \(pointer: coarse\)[^{]*\{[^}]*min-height: 44px/);
        expect(outsideMedia(css)).not.toMatch(/min-height/);
    });

    it("the close x keeps its 18px and gets an invisible 44px-high area, on a touch screen only", () => {
        const { container } = renderStrip();
        const close = container.querySelector<HTMLElement>('[data-tab-close="a"]')!;
        const css = cssWithMediaOf(close);
        expect(css).toMatch(/@media \(pointer: coarse\)/);
        expect(css).toMatch(/::after[^{]*\{[^}]*content: ""/);
        // 18px + 13px above and below = 44; 18px + 20px + 6px = 44 wide, not into the next tab.
        expect(css).toMatch(/::after[^{]*\{[^}]*top: -13px/);
        expect(css).toMatch(/::after[^{]*\{[^}]*bottom: -13px/);
        expect(css).toMatch(/::after[^{]*\{[^}]*inset-inline-start: -20px/);
        expect(css).toMatch(/::after[^{]*\{[^}]*inset-inline-end: -6px/);
        expect(outsideMedia(css)).not.toMatch(/::after|position: relative/);
        expect(css).toMatch(/width: 18px/);
        expect(css).toMatch(/height: 18px/);
    });
});

describe("call sites, by source", () => {
    it("graph: 'Click to edit dates' is a tall hit area, only when the dates can be edited", () => {
        const text = source("features/tasks/diagram/components/TaskNodeCard.tsx");
        expect(text).toContain('...(dateEditable ? tallHitAreaSx("&") : null)');
    });

    it("graph legend: the header toggle is 44 high and its +/- button is 44 on a touch screen", () => {
        const text = source("features/tasks/diagram/components/DiagramLegend.tsx");
        expect(text).toContain('...touchTargetSx("&")');
        expect(text).toMatch(/"@media \(pointer: coarse\)": \{ "--IconButton-size": "44px" \}/);
    });

    it("chat list row: NO invisible hit areas on the pin, '...' or avatar (a phone could not open a chat)", () => {
        // On a phone `NavItem` forces `position: static` on the row's action buttons
        // (`ACTION_IN_FLOW`, more specific than the `position: relative` the hit-area helpers set),
        // so the helpers' `::after` found the ROW as its containing block: 100% of the row wide,
        // so a tap anywhere on the row hit "...". They stay off the chat list row until the hit
        // area is built so a `position` rule elsewhere cannot move its anchor.
        for (const file of [
            "features/chat/components/sidebar/ChatListItemActions.tsx",
            "features/chat/components/sidebar/chatListItem.tsx",
            "features/chat/components/sidebar/ChatSearch.tsx",
        ]) {
            const text = source(file);
            expect(text, file).not.toContain("tallHitAreaSx");
            expect(text, file).not.toContain("invisibleHitAreaSx");
        }
    });
});
