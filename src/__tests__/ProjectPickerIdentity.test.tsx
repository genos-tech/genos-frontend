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
import { projectAvatarSrc, projectAvatarSrcMap } from "../features/tasks/utils/projectAvatar";
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
        {
            projectId: 3,
            projectName: "Gamma",
            projectTags: [],
            projectLabels: [],
            isExternal: true,
            hostTeamName: "Partner Co",
        },
    ],
    setCurrentProject: vi.fn(),
} as unknown as ProjectManagementState;

const renderPicker = (useCM?: ChatManagementState, taskContent?: Partial<TaskProps>) =>
    render(
        <CssVarsProvider>
            <ACTeamProjects
                isOpenProjectList={false}
                setIsOpenProjectList={vi.fn()}
                setTaskContent={vi.fn()}
                taskContent={{ id: 1, ...taskContent } as unknown as TaskProps}
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

describe("ACTeamProjects closed field", () => {
    // A closed Autocomplete is a text <input>, so the selected project can
    // only be its `getOptionLabel` string — the identity has to be
    // re-attached as a decorator or the row's meaning is lost the moment
    // the listbox shuts. These assert both halves of that arrangement.
    //
    // The selection is deliberately the STUB the picker's own `onChange`
    // writes onto the task — id and name, nothing else. Reading the marks
    // off it would blank them right after a pick, so they have to be
    // resolved against `teamProjects`.
    const selected = {
        project: { projectId: 3, projectName: "Gamma", projectTags: [] },
    } as unknown as Partial<TaskProps>;

    it("keeps the plain name as the input's value", () => {
        renderPicker(undefined, selected);

        expect(screen.getAllByRole("combobox")[0]).toHaveValue("Gamma");
    });

    it("carries the project's markers beside the name, without opening the list", () => {
        renderPicker(undefined, selected);

        // Sourced from the decorator, not an option row: the listbox is
        // shut, so nothing else can be rendering this. And the host team
        // only exists on the `teamProjects` record, never on the stub.
        expect(screen.getByTitle("Shared with your team by Partner Co")).toBeInTheDocument();
    });

    it("renders no marker while nothing is selected", () => {
        renderPicker();

        expect(screen.queryByTitle(/Shared with your team/)).not.toBeInTheDocument();
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

describe("projectAvatarSrcMap", () => {
    // The batch form, for hosts that render a list of projects and take
    // the avatars as a prop (the Spotlight / Genos project filter).
    const allChats = [
        // Same decoys as above: a DM for project 1 must lose to the PM
        // chat, and a PM chat with no project at all must not throw.
        {
            chatType: 1,
            project: { projectId: 1 },
            profileImagePath: "https://cdn.test/wrong-dm.png",
        },
        { chatType: 3, project: { projectId: 1 }, profileImagePath: "https://cdn.test/p1.png" },
        { chatType: 3, project: { projectId: 2 }, profileImagePath: undefined },
        { chatType: 3, profileImagePath: "https://cdn.test/orphan.png" },
    ] as unknown as ChatManagementState["allChats"];

    it("resolves every project in one pass, agreeing with the single-project form", () => {
        const avatars = projectAvatarSrcMap(allChats);
        expect(avatars.get(1)).toBe("https://cdn.test/p1.png");
        expect(avatars.get(1)).toBe(projectAvatarSrc(1, allChats));
    });

    it("omits projects the row should fall back to the generic icon for", () => {
        const avatars = projectAvatarSrcMap(allChats);
        // PM chat exists but carries no image.
        expect(avatars.has(2)).toBe(false);
        // No PM chat at all.
        expect(avatars.has(99)).toBe(false);
        // Pre-auth, before any chat has loaded.
        expect(projectAvatarSrcMap(undefined).size).toBe(0);
    });
});
