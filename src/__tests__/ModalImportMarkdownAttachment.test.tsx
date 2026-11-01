/**
 * ModalImportMarkdown with an `initialFile` (an uploaded attachment).
 *
 * The file is seeded inside the `[open]` effect, which would otherwise
 * wipe it; the text comes from an authenticated fetch; and the destination
 * can be any of My Notes / a Team folder / a task / a chat, each routed to
 * the right `useNM.handleCreateNew*` call.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    ImportInitialFile,
    ModalImportMarkdown,
} from "../features/notes/common/components/ModalImportMarkdown";
import { NoteManagementState } from "../hooks/notes/useNoteManagement";
import { UserProps } from "../types/admin";

const fetchMediaText = vi.fn();
vi.mock("../utils/downloadUtils", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../utils/downloadUtils")>()),
    fetchMediaText: (...args: unknown[]) => fetchMediaText(...args),
}));

// The real converter drags in BlockNote; the dialog only needs "some body".
vi.mock("../features/notes/common/services/noteMarkdown", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/notes/common/services/noteMarkdown")>()),
    markdownToNoteBlocks: vi.fn(async (md: string) => [{ type: "paragraph", md }]),
}));

const loadTeamTaskList = vi.fn();
vi.mock("../features/tasks/services/loadTaskSearchList", () => ({
    loadTeamTaskList: (...args: unknown[]) => loadTeamTaskList(...args),
}));

const CHANNEL = "11111111-2222-3333-4444-555555555555";
vi.mock("../features/channel/hooks/useChannelList", () => ({
    useChannelList: () => ({
        channels: [{ id: CHANNEL, kind: 2, title: "Design" }],
        unreadByKind: {},
        totalUnread: 0,
        isLoading: false,
    }),
}));

const myself = { userId: "u1", teamId: "t1" } as UserProps;
const FILE: ImportInitialFile = {
    url: "https://api.genosai.dev/media/chats/c/m/abc.txt",
    name: "plan.md",
};

const makeNM = () =>
    ({
        myNoteFolders: [{ folderId: 5, parentFolderId: null, name: "Work" }],
        teamNoteFolders: [
            // Read-only parent with a writable child: the child must stay.
            { folderId: 20, parentFolderId: null, name: "Handbook", myRoleId: 3 },
            { folderId: 21, parentFolderId: 20, name: "Onboarding", myRoleId: 2 },
            { folderId: 22, parentFolderId: null, name: "Locked", myRoleId: 3 },
            { folderId: 23, parentFolderId: null, name: "Eng", myRoleId: 1 },
        ],
        taskNoteMeta: [],
        chatNoteMeta: [],
        getMyNoteFolders: vi.fn(),
        getTeamNoteFolders: vi.fn(),
        handleCreateNewMyNote: vi.fn().mockResolvedValue(true),
        handleCreateNewTaskNote: vi.fn().mockResolvedValue({ noteId: 9, taskId: 3, projectId: 1 }),
        handleCreateNewChatNote: vi.fn().mockResolvedValue({ noteId: 8 }),
    }) as unknown as NoteManagementState & Record<string, ReturnType<typeof vi.fn>>;

const renderModal = (
    useNM: NoteManagementState,
    props: Partial<React.ComponentProps<typeof ModalImportMarkdown>> = {}
) =>
    render(
        <CssVarsProvider>
            <ModalImportMarkdown
                context={{ kind: "my" }}
                initialFile={FILE}
                myself={myself}
                open={true}
                useNM={useNM}
                onClose={() => {}}
                {...props}
            />
        </CssVarsProvider>
    );

const titleInput = () => screen.getByRole("textbox") as HTMLInputElement;
const importButton = () => screen.getByRole("button", { name: "Import" });

const pickKind = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
    // The first combobox is the kind Select; the second the destination.
    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: label }));
};

describe("ModalImportMarkdown with an initialFile", () => {
    beforeEach(() => {
        fetchMediaText.mockReset();
        fetchMediaText.mockResolvedValue("# Plan\n\nbody");
        loadTeamTaskList.mockReset();
        loadTeamTaskList.mockResolvedValue([
            {
                projectId: 7,
                projectName: "Genos",
                taskId: 42,
                displayId: "GEN-42",
                title: "Fix login",
            },
        ]);
    });

    it("keeps the preseeded file and title through the open-reset and fetches its text", async () => {
        renderModal(makeNM());

        expect(screen.getByText(/plan\.md/)).toBeInTheDocument();
        expect(titleInput().value).toBe("plan");
        await waitFor(() => expect(importButton()).toBeEnabled());
        expect(fetchMediaText).toHaveBeenCalledWith(FILE.url);
        // No local file chooser, and no whole-folder mode, in this mode.
        expect(screen.queryByRole("tab")).toBeNull();
        expect(screen.queryByText("Choose a .md file…")).toBeNull();
    });

    it("shows an error and stays disabled when the file cannot be read", async () => {
        fetchMediaText.mockRejectedValue(new Error("404"));
        renderModal(makeNM());

        expect(await screen.findByText("Couldn't read that file.")).toBeInTheDocument();
        expect(importButton()).toBeDisabled();
    });

    it("imports into My Notes (root) by default", async () => {
        const useNM = makeNM();
        const user = userEvent.setup();
        renderModal(useNM);
        await waitFor(() => expect(importButton()).toBeEnabled());

        await user.click(importButton());

        expect(useNM.handleCreateNewMyNote).toHaveBeenCalledWith(null, null, {
            title: "plan",
            body: [{ type: "paragraph", md: "# Plan\n\nbody" }],
        });
        expect(
            await screen.findByText(/Imported as a note in My Notes \(root\)/)
        ).toBeInTheDocument();
    });

    it("offers only writable team folders, keeping a writable child of a read-only parent", async () => {
        const useNM = makeNM();
        const user = userEvent.setup();
        renderModal(useNM);
        await pickKind(user, "Team Notes");

        await user.click(screen.getAllByRole("combobox")[1]);
        const labels = screen.getAllByRole("option").map((o) => o.textContent);
        expect(labels).toEqual(["Eng", "Handbook › Onboarding"]);
    });

    it("imports into a team folder through the my-note handler (it picks the team bucket)", async () => {
        const useNM = makeNM();
        const user = userEvent.setup();
        renderModal(useNM);
        await waitFor(() => expect(importButton()).toBeEnabled());
        await pickKind(user, "Team Notes");
        await user.click(screen.getAllByRole("combobox")[1]);
        await user.click(await screen.findByRole("option", { name: "Eng" }));

        await user.click(importButton());

        expect(useNM.handleCreateNewMyNote).toHaveBeenCalledWith(
            null,
            23,
            expect.objectContaining({ title: "plan" })
        );
    });

    it("lists tasks that hold no notes yet and imports into the picked one", async () => {
        const useNM = makeNM();
        const user = userEvent.setup();
        renderModal(useNM);
        await waitFor(() => expect(importButton()).toBeEnabled());
        await pickKind(user, "Task note");
        await user.click(screen.getAllByRole("combobox")[1]);
        await user.click(await screen.findByRole("option", { name: "Genos › GEN-42 Fix login" }));

        await user.click(importButton());

        expect(useNM.handleCreateNewTaskNote).toHaveBeenCalledWith(
            null,
            7,
            42,
            undefined,
            expect.objectContaining({ title: "plan" })
        );
    });

    it("imports into a chat using the v3 channel UUID", async () => {
        const useNM = makeNM();
        const user = userEvent.setup();
        renderModal(useNM, {
            initialFile: {
                ...FILE,
                defaultDestination: { kind: "chat", channelId: CHANNEL, chatType: 0 },
            },
        });
        await waitFor(() => expect(importButton()).toBeEnabled());

        await user.click(importButton());

        expect(useNM.handleCreateNewChatNote).toHaveBeenCalledWith(
            null,
            2,
            CHANNEL,
            false,
            0,
            undefined,
            expect.objectContaining({ title: "plan" })
        );
    });

    it("reports a failed create instead of claiming success", async () => {
        const useNM = makeNM();
        (useNM.handleCreateNewMyNote as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        const user = userEvent.setup();
        renderModal(useNM);
        await waitFor(() => expect(importButton()).toBeEnabled());

        await user.click(importButton());

        expect(
            await screen.findByText("Import failed — the note wasn't created.")
        ).toBeInTheDocument();
        expect(screen.queryByText(/Imported as a note in/)).toBeNull();
    });

    it("on the task's own host, closes and hands the note to the host", async () => {
        const useNM = makeNM();
        const onClose = vi.fn();
        const onTaskNoteCreated = vi.fn();
        const user = userEvent.setup();
        renderModal(useNM, {
            context: { kind: "task", projectId: 7, taskId: 42 },
            initialFile: {
                ...FILE,
                defaultDestination: { kind: "task", projectId: 7, taskId: 42 },
            },
            skipOpenTab: true,
            onClose,
            onTaskNoteCreated,
        });
        await waitFor(() => expect(importButton()).toBeEnabled());

        await user.click(importButton());

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(useNM.handleCreateNewTaskNote).toHaveBeenCalledWith(
            null,
            7,
            42,
            undefined,
            expect.objectContaining({ skipOpenTab: true })
        );
        expect(onTaskNoteCreated).toHaveBeenCalledWith(expect.objectContaining({ noteId: 9 }));
    });
});
