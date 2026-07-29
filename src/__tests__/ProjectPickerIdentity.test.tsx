/**
 * The project picker shows a project the way the sidebar does.
 *
 * The dropdown used to render a bare `projectName`, which is genuinely
 * ambiguous once a team runs two projects called "Website" under
 * different labels — and it read as a different product from the sidebar
 * three inches away. Options now carry the shared `ProjectIdentityRow`:
 * avatar, label chips, a lock when private, then the name.
 *
 * Options render through Joy's `AutocompleteOption`, not a bespoke
 * `<li>`. That is what gives them the padding, hover and selected states
 * of a Joy `Select`'s `Option` — a plain `<li>` renders unstyled — and it
 * also consumes Joy's internal `ownerState`, which a plain element would
 * forward to the DOM and warn about on EVERY option render. The leak
 * assertion below fails if someone swaps back to a bare element without
 * `stripOwnerState`.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACTeamProjects } from "../features/tasks/components/autocompletes/ACTeamProjects";
import { projectAvatarSrc } from "../features/tasks/utils/projectAvatar";
import type { ChatManagementState } from "../hooks/chats/useChatManagement";
import type { ProjectManagementState } from "../hooks/common/useProjectManagement";
import type { TaskProps } from "../types/tasks";

const usePM = {
    teamProjects: [
        {
            projectId: 1,
            projectName: "Alpha",
            projectTags: [],
            projectLabels: [
                { labelId: 7, name: "Platform", color: "#123456", textColor: "#ffffff" },
            ],
            isPrivate: false,
        },
        {
            projectId: 2,
            projectName: "Beta",
            projectTags: [],
            projectLabels: [],
            isPrivate: true,
        },
    ],
    setCurrentProject: vi.fn(),
} as unknown as ProjectManagementState;

const renderPicker = (useCM?: ChatManagementState) =>
    render(
        <CssVarsProvider>
            <ACTeamProjects
                isOpenProjectList={false}
                setIsOpenProjectList={vi.fn()}
                setTaskContent={vi.fn()}
                taskContent={{ id: 1 } as unknown as TaskProps}
                useCM={useCM}
                usePM={usePM}
            />
        </CssVarsProvider>
    );

const openOptions = () => {
    const input = screen.getAllByRole("combobox")[0];
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
};

describe("ACTeamProjects option rows", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("shows each project's name and its label chips", () => {
        renderPicker();
        openOptions();

        expect(screen.getByText("Alpha")).toBeInTheDocument();
        expect(screen.getByText("Beta")).toBeInTheDocument();
        // The label is the thing that disambiguates two same-named
        // projects — it must reach the option, not just the sidebar.
        expect(screen.getByText("Platform")).toBeInTheDocument();
    });

    it("does not forward Joy's ownerState to the DOM", () => {
        renderPicker();
        openOptions();

        const leaked = errorSpy.mock.calls.some((args) =>
            args.some((a) => typeof a === "string" && a.includes("ownerState"))
        );
        expect(leaked).toBe(false);
    });
});

describe("projectAvatarSrc", () => {
    // Absolute URLs on purpose: `buildAvatarSrc` passes http(s) through
    // untouched, so these assert WHICH chat is picked without depending
    // on VITE_MEDIA_ROOT_DJANGO (unset under vitest, which would make
    // every relative path resolve to undefined and the test vacuous).
    const chatsWith = (path: string | undefined) =>
        ({
            allChats: [
                // A DM for the same id must NOT match — only the PM chat
                // (chatType 3) carries the project's image.
                {
                    chatType: 1,
                    project: { projectId: 1 },
                    profileImagePath: "https://cdn.test/wrong-dm.png",
                },
                { chatType: 3, project: { projectId: 1 }, profileImagePath: path },
            ],
        }) as unknown as ChatManagementState;

    it("resolves the image from the project's PM chat, not another chat", () => {
        const src = projectAvatarSrc(1, chatsWith("https://cdn.test/project-1.png")?.allChats);
        expect(src).toBe("https://cdn.test/project-1.png");
    });

    it("is undefined when the PM chat has no image", () => {
        expect(projectAvatarSrc(1, chatsWith(undefined)?.allChats)).toBeUndefined();
    });

    it("is undefined for a project with no PM chat, and pre-auth", () => {
        const chats = chatsWith("https://cdn.test/project-1.png")?.allChats;
        expect(projectAvatarSrc(99, chats)).toBeUndefined();
        expect(projectAvatarSrc(1, undefined)).toBeUndefined();
        expect(projectAvatarSrc(undefined, chats)).toBeUndefined();
    });
});
