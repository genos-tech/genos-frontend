/**
 * MIP-1319 (touch targets, last part): the remaining header controls are 44px on a touch screen,
 * and nothing changes with a mouse: note Back, the members pill, the editor's cluster of toggles,
 * the task overlay's Close, Start / Complete buttons of the task and milestone previews, the chat
 * list header (section tabs, Unread, More), the graph node actions, the graph dialog's Close and
 * the zoom controls.
 *
 * jsdom evaluates no `@media` and lays nothing out, so the helpers' CSS is read as text and the
 * call sites are pinned by their source. The measured result at 390 (`elementFromPoint`, before /
 * after) is in the PR and in genos-docs `design/evidence/MIP-1319-last.md`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Box, Chip } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cssWithMediaOf } from "./utils/cssOf";

import { chipHitAreaSx, tallHitAreaSx } from "../components/ui/touchTargets";

afterEach(cleanup);

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const outsideMedia = (css: string) => css.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, "");

describe("tallHitAreaSx", () => {
    it("is 44px high and exactly as wide as the control, and only under a coarse pointer", () => {
        const rule = tallHitAreaSx("& [role='button']")["@media (pointer: coarse)"];
        expect(rule["& [role='button']"]).toEqual({ position: "relative" });
        expect(rule["& [role='button']::after"]).toMatchObject({
            content: '""',
            left: 0,
            width: "100%",
            height: 44,
        });
        expect(Object.keys(tallHitAreaSx())).toEqual(["@media (pointer: coarse)"]);
    });
});

describe("chipHitAreaSx", () => {
    it("reaches (44 - height) / 2 above and below the chip, inside the coarse media query only", () => {
        const { container } = render(
            <CssVarsProvider>
                <Chip onClick={() => {}} sx={chipHitAreaSx(26)}>
                    Unread
                </Chip>
            </CssVarsProvider>
        );
        const css = cssWithMediaOf(container.firstElementChild as Element);
        expect(css).toMatch(/@media \(pointer: coarse\)/);
        expect(css).toMatch(/MuiChip-action::after[^{]*\{[^}]*top: -9px/);
        expect(css).toMatch(/MuiChip-action::after[^{]*\{[^}]*bottom: -9px/);
        expect(outsideMedia(css)).not.toMatch(/::after/);
    });
});

describe("a 44px target on a touch screen, by source", () => {
    it.each([
        ["note Back, my notes", "features/notes/my-notes/components/MyNoteMain.tsx"],
        ["note Back, task notes", "features/notes/task-notes/components/TaskNoteMain.tsx"],
        ["note Back, open failure", "features/notes/common/components/NoteOpenFailure.tsx"],
    ])("%s", (_name, file) => {
        const text = source(file);
        expect(text).toContain("touchTargetSx(");
        expect(text).toMatch(/backToNotesList[\s\S]{0,200}touchTargetSx\("&"\)/);
    });

    it("the members pill: avatars are tapped 44px high, not wider (they overlap)", () => {
        expect(source("features/notes/common/components/NoteHeaderActions.tsx")).toContain(
            `tallHitAreaSx("& [role='button']")`
        );
    });

    it("the editor's toggles (wrap, code, comments) are 44px, and the cluster clears the bigger comments toggle", () => {
        const text = source("components/editors/genos/GenosNoteEditor.tsx");
        expect(text.match(/\.\.\.headerTouchTargetsSx,/g)?.length).toBe(1);
        expect(text).toContain('headerTouchTargetsSx["@media (pointer: coarse)"]');
        expect(text).toMatch(/COMMENTS_SIDEBAR_WIDTH \+ 12 : 60/);
    });

    it("the phone overlay's Close (MobileOverlay) grows the bar, not the content", () => {
        expect(source("components/layout/MobileOverlay.tsx")).toContain("...headerTouchTargetsSx");
    });

    it("every ModalFrame dialog's Close (the graph dialog's too)", () => {
        expect(source("components/ui/modal/ModalFrame.tsx")).toMatch(
            /\.\.\.touchTargetSx\("&"\),\s*\n\s*color: g\.text\.secondary/
        );
    });

    it("Start / Complete Task and Start / Complete Milestone", () => {
        const task = source("features/tasks/components/contents/base/TaskTitleBlock.tsx");
        const milestone = source("features/tasks/components/contents/TaskPreview.tsx");
        expect(task.match(/sx=\{touchTargetSx\("&"\)\}/g)?.length).toBe(2);
        expect(milestone.match(/sx=\{touchTargetSx\("&"\)\}/g)?.length).toBe(2);
    });

    it("chat list header: tabs 44, More 44, Unread chip in a 44px band", () => {
        const text = source("features/chat/components/sidebar/ChatSidebar.tsx");
        expect(text).toContain('...touchTargetSx("&")');
        expect(text).toContain("sx={headerTouchTargetsSx}");
        expect(text).toContain("...chipHitAreaSx(26)");
    });

    it("graph node actions (open, add) and the status picker are 44px taps, drawn the same", () => {
        expect(source("features/tasks/diagram/components/nodeParts.tsx")).toContain(
            '...invisibleHitAreaSx("&")'
        );
        expect(source("features/tasks/diagram/components/TaskNodeCard.tsx")).toContain(
            'sx={{ display: "inline-flex", ...invisibleHitAreaSx("&") }}'
        );
    });

    it("graph zoom controls: 44px buttons, moved clear of the legend, under a coarse pointer", () => {
        const text = source("features/tasks/diagram/components/TaskFlowCanvas.tsx");
        const coarse = text.slice(text.indexOf('"@media (pointer: coarse)"'));
        expect(coarse).toContain('"& .react-flow__panel.react-flow__controls": {');
        expect(coarse).toMatch(/top: 0,\s*bottom: "auto"/);
        expect(coarse).toMatch(/react-flow__controls-button": \{ width: 44, height: 44 \}/);
    });
});

describe("nothing outside the coarse media query", () => {
    it("a Box with the new helpers has no rule that a mouse sees", () => {
        const { container } = render(
            <CssVarsProvider>
                <Box sx={{ ...tallHitAreaSx("& span"), ...chipHitAreaSx(26) }}>
                    <span role="button" />
                </Box>
            </CssVarsProvider>
        );
        expect(outsideMedia(cssWithMediaOf(container.firstElementChild as Element))).not.toMatch(
            /::after|position: relative/
        );
    });
});
