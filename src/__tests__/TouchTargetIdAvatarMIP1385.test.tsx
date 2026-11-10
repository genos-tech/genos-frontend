/**
 * MIP-1385: the task id chip ("click to copy", 40 x 16) and the chat header avatar (38px) are 44px
 * tap targets on a touch screen WITHOUT changing their look: an invisible hit area from
 * `invisibleHitAreaSx` (ui/touchTargets), only inside `@media (pointer: coarse)`.
 *
 * jsdom evaluates no `@media` and lays nothing out, so the CSS the components emit is read as text
 * (`cssWithMediaOf`). The measured result at 390 (every task surface, `elementFromPoint` on a 44px
 * box around the control, before / after) is in the PR.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Box } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cssWithMediaOf } from "./utils/cssOf";

import { Clickable } from "../components/ui/Clickable";
import { invisibleHitAreaSx, TOUCH_TARGET } from "../components/ui/touchTargets";
import { TaskIdText } from "../features/tasks/components/card";

afterEach(cleanup);

describe("invisibleHitAreaSx", () => {
    it("paints nothing and moves nothing: an empty ::after, centred, 44px, never narrower than the control", () => {
        const rule = invisibleHitAreaSx()["@media (pointer: coarse)"];
        expect(rule["&"]).toEqual({ position: "relative" });
        expect(rule["&::after"]).toEqual({
            content: '""',
            position: "absolute",
            top: "50%",
            left: "50%",
            width: `max(100%, ${TOUCH_TARGET}px)`,
            height: 44,
            transform: "translate(-50%, -50%)",
        });
        // No fill, border or size on the control itself.
        expect(JSON.stringify(rule["&"])).not.toMatch(/width|height|padding|margin|background/);
    });

    it("exists only under a coarse pointer, so a mouse sees no change", () => {
        expect(Object.keys(invisibleHitAreaSx())).toEqual(["@media (pointer: coarse)"]);
        expect(Object.keys(invisibleHitAreaSx("& [role='button']"))).toEqual([
            "@media (pointer: coarse)",
        ]);
    });
});

describe("the task id chip", () => {
    const renderId = (props: Parameters<typeof TaskIdText>[0]) =>
        render(
            <CssVarsProvider>
                <TaskIdText {...props} />
            </CssVarsProvider>
        );

    it("carries the hit area only inside the coarse media query", () => {
        renderId({ text: "TP-77" });
        const css = cssWithMediaOf(screen.getByText("TP-77"));
        expect(css).toMatch(/@media \(pointer: coarse\)/);
        // (jsdom's CSSOM drops `width: max(100%, 44px)`; the helper test above pins it.)
        expect(css).toMatch(/::after[^{]*\{[^}]*height: 44px/);
        // The positioning that anchors it is inside the media query too.
        const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, "");
        expect(outside).not.toMatch(/position: relative/);
        expect(outside).not.toMatch(/::after/);
    });

    it("the focusable form (a real button) has it as well", () => {
        renderId({ text: "TP-77", focusable: true });
        const chip = screen.getByRole("button");
        expect(cssWithMediaOf(chip)).toMatch(/::after[^{]*\{[^}]*height: 44px/);
    });

    it("a bare id (not copyable) is plain text: no hit area, nothing to tap", () => {
        renderId({ text: "TP-77", copyable: false });
        expect(cssWithMediaOf(screen.getByText("TP-77"))).not.toMatch(/::after/);
    });
});

describe("the chat header avatar", () => {
    it("the avatar wrapper reaches its Clickable (role=button) with the hit area", () => {
        const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
        const source = readFileSync(
            join(SRC, "features/chat/components/headers/HeaderUserName.tsx"),
            "utf8"
        );
        expect(source).toContain(`...invisibleHitAreaSx("& [role='button']")`);
        expect(source).toContain("components/ui/touchTargets");
    });

    it("the selector it uses matches the avatars' Clickable", () => {
        render(
            <CssVarsProvider>
                <Box sx={invisibleHitAreaSx("& [role='button']")}>
                    <Clickable height={38} width={38} onActivate={() => {}} />
                </Box>
            </CssVarsProvider>
        );
        const button = screen.getByRole("button");
        const wrapper = button.parentElement!;
        expect(cssWithMediaOf(wrapper)).toMatch(
            /\[role='button'\]::after|\[role="button"\]::after/
        );
        expect(button.matches("[role='button']")).toBe(true);
    });
});
