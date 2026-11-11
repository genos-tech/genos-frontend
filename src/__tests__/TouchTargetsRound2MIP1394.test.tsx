/**
 * MIP-1394 (touch targets, round 2): the chat message-list avatar and the phone task page's header
 * buttons are 44px tap targets on a touch screen, and nothing changes with a mouse.
 *
 * jsdom evaluates no `@media` and lays nothing out, so the CSS the components emit is read as text
 * (`cssWithMediaOf`). The measured result at 390 (`elementFromPoint`, before / after) is in the PR.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cssWithMediaOf } from "./utils/cssOf";

import { Bubble } from "../components/ui/bubble";
import { Clickable } from "../components/ui/Clickable";

afterEach(cleanup);

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const AVATAR_AREA = /\[role=['"]button['"]\]::after[^{]*\{[^}]*height: 44px/;

/** The CSS of the box that holds the avatar, found through the avatar itself. */
const avatarHolderCss = (el: HTMLElement) => cssWithMediaOf(el.parentElement as HTMLElement);

describe("the avatar in a message row", () => {
    const avatar = <Clickable height={32} width={32} onActivate={() => {}} />;

    it.each([
        ["compact (the avatar sits in a gutter column)", "compact"],
        ["bubble (the avatar sits in the header line)", "bubble"],
    ] as const)("%s: carries the hit area, only under a coarse pointer", (_name, layout) => {
        render(
            <CssVarsProvider>
                <Bubble avatar={avatar} layout={layout}>
                    hello
                </Bubble>
            </CssVarsProvider>
        );
        const css = avatarHolderCss(screen.getByRole("button"));
        expect(css).toMatch(/@media \(pointer: coarse\)/);
        expect(css).toMatch(AVATAR_AREA);
        // Nothing outside the media query: a mouse sees no change.
        const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, "");
        expect(outside).not.toMatch(/::after/);
        expect(outside).not.toMatch(/position: relative/);
    });

    it("an avatar that is not a button (a system sender) gets nothing", () => {
        render(
            <CssVarsProvider>
                <Bubble avatar={<span data-testid="plain">S</span>} layout="compact">
                    hello
                </Bubble>
            </CssVarsProvider>
        );
        expect(screen.queryByRole("button")).toBeNull();
    });
});

describe("the phone task page header (MobileTaskHome)", () => {
    const source = readFileSync(join(SRC, "features/tasks/MobileTaskHome.tsx"), "utf8");

    it("spreads the shared header rule on the bar, so every IconButton in it is 44px on a phone", () => {
        expect(source).toContain("...headerTouchTargetsSx");
        expect(source).toContain("components/ui/touchTargets");
    });

    it("keeps the bar at 56px: 44px of button + 2 x 4px of padding, not 2 x 6px", () => {
        expect(source).toMatch(/minHeight: "56px"/);
        expect(source).toMatch(/py: 0\.5,/);
        expect(source).not.toMatch(/py: 0\.75,\s*\n\s*borderBottom/);
    });
});
