/**
 * One avatar base for the whole app (MIP-1133): sizes come from one scale,
 * initials from `initialOf`, and nothing outside `components/ui/avatars`
 * renders a raw Joy `<Avatar>`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { avatarPx } from "../components/ui/avatars/avatarSize";
import { BaseAvatar } from "../components/ui/avatars/BaseAvatar";
import { UserAvatar } from "../components/ui/avatars/UserAvatar";
import { AVATAR } from "../theme/tokens/scales";
import type { UserProps } from "../types/admin";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return name === "__tests__" ? [] : walk(full);
        return /\.(tsx?)$/.test(name) ? [full] : [];
    });

describe("BaseAvatar", () => {
    it("sizes the circle from the scale", () => {
        render(<BaseAvatar data-testid="a" name="Ken" size="lg" />);
        expect(getComputedStyle(screen.getByTestId("a")).getPropertyValue("--Avatar-size")).toBe(
            `${AVATAR.lg}px`
        );
    });

    it("a no-picture circle has a visible fill and a hairline ring (MIP-1185)", () => {
        render(<BaseAvatar data-testid="a" name="Ken" />);
        const css = getComputedStyle(screen.getByTestId("a"));
        // Joy's soft neutral is nearly the raised dialog surface in light mode.
        expect(css.backgroundColor).toBe("var(--g-bg-subtle)");
        expect(css.boxShadow).toContain("inset 0 0 0 1px var(--g-border");
        // A status tone keeps its own tint instead.
        render(<BaseAvatar data-testid="b" name="Ken" tone="success" />);
        expect(getComputedStyle(screen.getByTestId("b")).backgroundColor).not.toBe(
            "var(--g-bg-subtle)"
        );
    });

    it("defaults to the md step", () => {
        render(<BaseAvatar data-testid="a" name="Ken" />);
        expect(getComputedStyle(screen.getByTestId("a")).getPropertyValue("--Avatar-size")).toBe(
            `${AVATAR.md}px`
        );
        expect(avatarPx(undefined)).toBe(AVATAR.md);
        expect(avatarPx("xl")).toBe(AVATAR.xl);
        expect(avatarPx(18)).toBe(18);
    });

    it("accepts a responsive map of scale steps", () => {
        render(<BaseAvatar name="Ken" size={{ xs: "xxl", md: "hero" }} />);
        const css = [...document.querySelectorAll("style")].map((el) => el.textContent).join("");
        expect(css).toContain(`--Avatar-size:${AVATAR.xxl}px`);
        expect(css).toContain(`--Avatar-size:${AVATAR.hero}px`);
        expect(css).toMatch(/@media[^{]*\{[^}]*--Avatar-size:150px/);
    });

    it("shows the first letter of the name, not a bracket", () => {
        render(<BaseAvatar name="(DY) Ken Kamiya" />);
        expect(screen.getByText("D")).toBeTruthy();
        expect(screen.queryByText("(")).toBeNull();
    });

    it("lets children (an icon) win over the name", () => {
        render(
            <BaseAvatar name="Ken">
                <span data-testid="icon" />
            </BaseAvatar>
        );
        expect(screen.getByTestId("icon")).toBeTruthy();
        expect(screen.queryByText("K")).toBeNull();
    });
});

describe("UserAvatar initials", () => {
    const user = (userName: string, userId = "u1") =>
        ({ userId, userName }) as unknown as UserProps;
    const renderUser = (userName: string) =>
        render(
            <AvatarContextProvider
                value={{
                    myself: user("Me", "me"),
                    setMyself: () => {},
                    teamMemberProfiles: { u1: user(userName) },
                    setTeamMemberProfiles: () => {},
                    socket: null,
                    useCM: {} as never,
                    useUISM: {} as never,
                }}
            >
                <UserAvatar showPulseDot={false} userId="u1" />
            </AvatarContextProvider>
        );

    it("uses the first letter of '(DY) Ken Kamiya'", () => {
        renderUser("(DY) Ken Kamiya");
        expect(screen.getByText("D")).toBeTruthy();
    });

    it("uses the first character of a CJK name", () => {
        renderUser("神谷 健");
        expect(screen.getByText("神")).toBeTruthy();
    });
});

describe("no raw Joy Avatar outside components/ui/avatars", () => {
    // Files whose raw Avatars are still to be converted. Empty since the milestone sidebar
    // row moved (MIP-1172): no file outside `components/ui/avatars` may render a raw Avatar.
    const PENDING = new Set<string>([]);

    it("imports Avatar from @mui/joy nowhere outside the avatar folder", () => {
        const offenders = walk(SRC)
            .map((f) => relative(SRC, f))
            .filter((f) => !f.startsWith("components/ui/avatars/"))
            .filter((f) => {
                const text = readFileSync(join(SRC, f), "utf8");
                const joyImports = [
                    ...text.matchAll(/import\s+([^;]*?)\s+from\s+"@mui\/joy(\/Avatar)?";/gs),
                ];
                return joyImports.some(
                    ([, names, sub]) =>
                        sub === "/Avatar" || /(^|[{,\s])Avatar(\s*[,}]|$)/.test(names)
                );
            });
        expect(offenders.filter((f) => !PENDING.has(f))).toEqual([]);
        // A pending file that no longer has a raw Avatar must leave the list.
        expect(offenders.sort()).toEqual([...PENDING].sort());
    });
});
