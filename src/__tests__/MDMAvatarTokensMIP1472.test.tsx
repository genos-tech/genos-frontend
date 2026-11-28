/**
 * MIP-1472: MDMAvatar asks for roles, not for the mode (no `isDark`, rgba, hsl or hex), and the
 * group / project chat pictures share one presentational component.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GroupChatAvatar, ProjectChatAvatar } from "../components/ui/avatars/ChatKindAvatar";
import { MDMAvatar } from "../components/ui/avatars/MDMAvatar";
import type { MDMMemberProps } from "../types/chat";

const src = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");
const code = (rel: string) => src(rel).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("no mode branching or literal colors in the avatars", () => {
    it.each([
        "components/ui/avatars/MDMAvatar.tsx",
        "components/ui/avatars/ChatKindAvatar.tsx",
        "components/ui/avatars/GMAvatar.tsx",
        "components/ui/avatars/ProjectAvatar.tsx",
    ])("%s", (file) => {
        const text = code(file);
        expect(text).not.toMatch(/\bisDark\b/);
        expect(text).not.toMatch(/useColorScheme/);
        expect(text).not.toMatch(/rgba?\(|hsla?\(|#[0-9a-f]{3,8}\b/i);
    });

    it("GMAvatar and ProjectAvatar draw their picture through the shared components", () => {
        expect(code("components/ui/avatars/GMAvatar.tsx")).toMatch(/<GroupChatAvatar/);
        expect(code("components/ui/avatars/ProjectAvatar.tsx")).toMatch(/<ProjectChatAvatar/);
    });
});

const members = (n: number): MDMMemberProps[] =>
    Array.from({ length: n }, (_, i) => ({
        userId: `u${i}`,
        userName: `User ${i}`,
        avatarImgPath: "",
    })) as MDMMemberProps[];

describe("MDMAvatar", () => {
    it("with no members: the people icon in the info tone", () => {
        const { container } = render(
            <CssVarsProvider>
                <MDMAvatar members={[]} />
            </CssVarsProvider>
        );
        expect(container.querySelector('svg[data-testid="PeopleRoundedIcon"]')).not.toBeNull();
    });

    it.each([
        [2, "UU"],
        [3, "UUU"],
        // Four or more: two faces and the rest, so the shown faces and N add up to the total.
        [4, "UU+2"],
        [10, "UU+8"],
    ])("%i members read %s", (n, text) => {
        const { container } = render(
            <CssVarsProvider>
                <MDMAvatar members={members(n)} />
            </CssVarsProvider>
        );
        expect(container.textContent).toBe(text);
    });

    it("a deleted account is neither drawn nor counted", () => {
        const people = members(4);
        people[0].userName = "Deleted user";
        const { container } = render(
            <CssVarsProvider>
                <MDMAvatar members={people} />
            </CssVarsProvider>
        );
        expect(container.textContent).toBe("UUU");
    });
});

describe("the chat kind avatars", () => {
    it("show their icon with no picture and the picture when there is one", () => {
        const { container, rerender } = render(
            <CssVarsProvider>
                <GroupChatAvatar />
                <ProjectChatAvatar />
            </CssVarsProvider>
        );
        expect(container.querySelector('svg[data-testid="GroupsIcon"]')).not.toBeNull();
        expect(container.querySelector('svg[data-testid="AssignmentIcon"]')).not.toBeNull();
        rerender(
            <CssVarsProvider>
                <GroupChatAvatar src="https://m.example/g.png" />
            </CssVarsProvider>
        );
        expect(container.querySelector("img")?.getAttribute("src")).toBe(
            "https://m.example/g.png"
        );
    });
});
