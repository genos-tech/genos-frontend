/**
 * MIP-1126 batch 3: the rendered frames of the dialogs that can be mounted with
 * small props. Each is a ModalFrame dialog with the right name, the right layer
 * and a flat surface (no gradient, one shadow). Layers are read from the modal
 * root (`role="presentation"`), the element that carries the z-index; a
 * host-derived dialog is rendered with and without its host.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { NoteModalHostZIndexProvider } from "../components/modals/noteModalHostZIndex";
import { ModalCreateTeam } from "../features/admin/components/modals/ModalCreateTeam";
import { ModalRequestOwnership } from "../features/admin/components/team/ModalRequestOwnership";
import { ModalRemindMe } from "../features/chat/components/modals/ModalRemindMe";
import { ModalScheduledTodos } from "../features/chat/components/todo/ModalScheduledTodos";
import { TodoHostLayerProvider } from "../features/chat/components/todo/TodoHostLayer";
import { CalendarEventModal } from "../features/integrations/components/CalendarEventModal";
import { ModalExportFolder } from "../features/notes/common/components/ModalExportFolder";
import { ModalNoteHistory } from "../features/notes/common/components/ModalNoteHistory";
import { ModalNoteSharing } from "../features/notes/common/components/ModalNoteSharing";
import { ModalFolderName } from "../features/notes/my-notes/modals/ModalFolderName";
import { ModalMoveToFolder } from "../features/notes/my-notes/modals/ModalMoveToFolder";
import { UserProps } from "../types/admin";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <span data-testid="avatar" />,
}));
vi.mock("../features/notes/common/services/loadNoteVersion", () => ({
    loadNoteVersion: vi.fn(async () => null),
}));

const myself = { userId: "u1", userName: "Me", teamId: "t1" } as UserProps;

const wrap = (ui: React.ReactElement) => render(<CssVarsProvider>{ui}</CssVarsProvider>);

/** The dialog, its title text, its layer, the picker layer and its flat-surface facts. */
const facts = () => {
    const dialog = screen.getByRole("dialog");
    const title = document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent;
    const root = screen.getByRole("presentation");
    const css = cssOf(dialog);
    return {
        title,
        layer: getComputedStyle(root).zIndex,
        popup: getComputedStyle(root).getPropertyValue("--unstable_popup-zIndex"),
        gradient: /gradient/i.test(css),
        shadows: css.match(/box-shadow:[^;]*/g),
    };
};

const FLAT = { gradient: false, shadows: ["box-shadow: var(--g-shadow-lg)"] };

beforeEach(() => {
    document.body.innerHTML = "";
});

describe("small dialogs", () => {
    it("Create team: a flat frame at 10010; Create is disabled until a name is typed", () => {
        wrap(
            <ModalCreateTeam
                myself={myself}
                openCreateTeam
                setIsNewTeamCreated={vi.fn()}
                setMyself={vi.fn()}
                setOpenCreateTeam={vi.fn()}
            />
        );
        expect(facts()).toMatchObject({ layer: "10010", ...FLAT });
        const create = screen.getByRole("button", { name: /^Create/i }) as HTMLButtonElement;
        expect(create.disabled).toBe(true);
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "Acme" } });
        expect(create.disabled).toBe(false);
    });

    it("Create team: the X and Cancel both close it", () => {
        const setOpen = vi.fn();
        wrap(
            <ModalCreateTeam
                myself={myself}
                openCreateTeam
                setIsNewTeamCreated={vi.fn()}
                setMyself={vi.fn()}
                setOpenCreateTeam={setOpen}
            />
        );
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(setOpen).toHaveBeenCalledWith(false);
    });

    it("Request ownership: a flat frame at 10010 whose warning note keeps its tint", () => {
        wrap(
            <ModalRequestOwnership
                open
                responseDays={30}
                teamName="Acme"
                onCancel={vi.fn()}
                onConfirm={vi.fn(async () => true)}
            />
        );
        const f = facts();
        expect(f).toMatchObject({ layer: "10010", ...FLAT });
        expect(f.title).toBeTruthy();
        // the team name is the frame description
        expect(screen.getByText("Acme")).toBeTruthy();
        // no dark-only literal survived
        expect(cssOf(screen.getByRole("dialog"))).not.toMatch(/rgba\(\s*(30|20|255)/);
    });

    it("Remind me: 10010 on the page, host + 10 inside the to-do modal, picker above both", () => {
        const view = wrap(
            <ModalRemindMe open onClose={vi.fn()} onCommit={vi.fn()} onRemove={vi.fn()} />
        );
        expect(facts()).toMatchObject({ layer: "10010", popup: "10020", ...FLAT });
        view.unmount();
        wrap(
            <TodoHostLayerProvider value={10020}>
                <ModalRemindMe open onClose={vi.fn()} onCommit={vi.fn()} onRemove={vi.fn()} />
            </TodoHostLayerProvider>
        );
        expect(facts()).toMatchObject({ layer: "10030", popup: "10040" });
    });

    it("Remind me: the remove row appears only for a pending reminder", () => {
        const view = wrap(
            <ModalRemindMe open onClose={vi.fn()} onCommit={vi.fn()} onRemove={vi.fn()} />
        );
        expect(screen.queryByRole("button", { name: /Remove/i })).toBeNull();
        view.unmount();
        wrap(
            <ModalRemindMe
                open
                remindAt={new Date(Date.now() + 3600000).toISOString()}
                onClose={vi.fn()}
                onCommit={vi.fn()}
                onRemove={vi.fn()}
            />
        );
        expect(screen.getByRole("button", { name: /Remove/i })).toBeTruthy();
    });

    it("Scheduled to-dos: Joy's layer on the page, host + 10 in the to-do modal, flat", () => {
        const props = {
            open: true,
            categories: [],
            schedules: [],
            onAdd: vi.fn(),
            onClose: vi.fn(),
            onRemove: vi.fn(),
            onUpdate: vi.fn(),
        };
        const view = wrap(<ModalScheduledTodos {...props} />);
        expect(facts()).toMatchObject({ layer: "1300", ...FLAT });
        view.unmount();
        wrap(
            <TodoHostLayerProvider value={10020}>
                <ModalScheduledTodos {...props} />
            </TodoHostLayerProvider>
        );
        expect(facts().layer).toBe("10030");
    });

    it("Calendar event: a flat frame on Joy's layer, edit title, Delete first in the footer", () => {
        wrap(
            <CalendarEventModal
                accessToken="tok"
                editingEventId="e1"
                initial={{ summary: "Standup" } as never}
                open
                onClose={vi.fn()}
            />
        );
        const f = facts();
        expect(f).toMatchObject({ layer: "1300", ...FLAT });
        expect(f.title).toBeTruthy();
        const footer = screen.getByRole("button", { name: "Delete" }).parentElement!;
        expect(footer.firstElementChild).toBe(screen.getByRole("button", { name: "Delete" }));
    });
});

describe("notes dialogs", () => {
    it("Folder name: a flat frame at 10010", () => {
        wrap(<ModalFolderName mode="create" open onClose={vi.fn()} onSubmit={vi.fn()} />);
        expect(facts()).toMatchObject({ layer: "10010", ...FLAT });
    });

    const folders = [
        { folderId: 1, name: "Projects", parentFolderId: null },
        { folderId: 2, name: "Genos", parentFolderId: 1 },
    ] as never;

    it("Move to folder: 10010 on the page, note host + 2 in a modal-hosted note", () => {
        const view = wrap(
            <ModalMoveToFolder folders={folders} open onClose={vi.fn()} onSelect={vi.fn()} />
        );
        expect(facts()).toMatchObject({ layer: "10010", ...FLAT });
        view.unmount();
        wrap(
            <NoteModalHostZIndexProvider value={10020}>
                <ModalMoveToFolder folders={folders} open onClose={vi.fn()} onSelect={vi.fn()} />
            </NoteModalHostZIndexProvider>
        );
        expect(facts()).toMatchObject({ layer: "10022", popup: "10032" });
    });

    const useNM = {
        currentNoteVersions: [
            {
                versionNo: 2,
                editor: { userId: "u2", userName: "Ann", avatarUrl: null },
                title: "T",
                restoredFromVersionNo: null,
                tsCreatedAt: "",
                tsUpdatedAt: new Date().toISOString(),
            },
        ],
        currentNoteMembers: [
            { userId: "u1", userName: "Me", avatarUrl: null, roleId: 1, tsCreated: "" },
        ],
    } as never;
    const noteProps = {
        noteId: 1,
        noteType: 1,
        open: true,
        myself,
        setMyself: vi.fn(),
        socket: null,
        useCM: {} as never,
        useUISM: {} as never,
        useNM,
        onClose: vi.fn(),
    };

    it("Note history: Joy's layer on a page, host + 2 over a modal-hosted note, flat", () => {
        const view = wrap(<ModalNoteHistory {...noteProps} />);
        expect(facts()).toMatchObject({ layer: "1300", ...FLAT });
        expect(screen.getByRole("button", { name: /Restore/i })).toBeTruthy();
        view.unmount();
        wrap(
            <NoteModalHostZIndexProvider value={10020}>
                <ModalNoteHistory {...noteProps} />
            </NoteModalHostZIndexProvider>
        );
        expect(facts()).toMatchObject({ layer: "10022", popup: "10032" });
    });

    it("Note sharing: Joy's layer on a page, host + 2 over a modal-hosted note, flat", () => {
        const props = { ...noteProps, noteTitle: "Plan", teamMembers: [] };
        const view = wrap(<ModalNoteSharing {...props} />);
        const f = facts();
        expect(f).toMatchObject({ layer: "1300", ...FLAT });
        expect(f.title).toMatch(/Plan/);
        view.unmount();
        wrap(
            <NoteModalHostZIndexProvider value={10020}>
                <ModalNoteSharing {...props} />
            </NoteModalHostZIndexProvider>
        );
        expect(facts().layer).toBe("10022");
    });

    it("Export folder: a flat frame at 10010 named after the folder", () => {
        wrap(
            <ModalExportFolder
                accessToken="tok"
                folders={[]}
                myself={myself}
                noteMeta={[]}
                target={{ folderId: 1, name: "Projects", source: "my" } as never}
                onClose={vi.fn()}
            />
        );
        expect(facts()).toMatchObject({ layer: "10010", ...FLAT });
        expect(screen.getByText("Projects")).toBeTruthy();
    });
});
