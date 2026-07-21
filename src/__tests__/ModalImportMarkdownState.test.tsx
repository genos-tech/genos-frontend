/**
 * ModalImportMarkdown — the dialog's per-open state reset.
 *
 * The note header mounts this dialog continuously and rebuilds its
 * `context` object literal on every render, so the reset effect must key
 * on `open` alone. Depending on `context` too would re-run the reset on
 * any unrelated parent re-render and wipe the file/title the user had
 * already picked, mid-dialog.
 *
 * Also covers the destination picker being header-only: opened from a
 * sidebar folder row the destination is the row itself.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    ImportMarkdownContext,
    ModalImportMarkdown,
} from "../features/notes/common/components/ModalImportMarkdown";
import { NoteManagementState } from "../hooks/notes/useNoteManagement";
import { ChatNoteMetaProps, TaskNoteMetaProps } from "../types/notes";

const taskMeta = [
    {
        noteType: 2,
        noteId: 1,
        parentNoteId: null,
        projectId: 7,
        taskId: 42,
        projectName: "Genos",
        taskTitle: "Fix login",
        displayId: "GEN-42",
        title: "note",
        tsUpdated: "",
    },
    {
        noteType: 2,
        noteId: 2,
        parentNoteId: null,
        projectId: 7,
        taskId: 43,
        projectName: "Genos",
        taskTitle: "Ship it",
        displayId: "GEN-43",
        title: "note",
        tsUpdated: "",
    },
] as TaskNoteMetaProps[];

const useNM = {
    myNoteFolders: [],
    taskNoteMeta: taskMeta,
    chatNoteMeta: [] as ChatNoteMetaProps[],
} as unknown as NoteManagementState;

const renderModal = (context: ImportMarkdownContext, allowDestinationChange: boolean) =>
    render(
        <CssVarsProvider>
            <ModalImportMarkdown
                allowDestinationChange={allowDestinationChange}
                context={context}
                open={true}
                useNM={useNM}
                onClose={() => {}}
            />
        </CssVarsProvider>
    );

const rerenderModal = (
    rerender: ReturnType<typeof renderModal>["rerender"],
    context: ImportMarkdownContext,
    allowDestinationChange: boolean
) =>
    rerender(
        <CssVarsProvider>
            <ModalImportMarkdown
                allowDestinationChange={allowDestinationChange}
                context={context}
                open={true}
                useNM={useNM}
                onClose={() => {}}
            />
        </CssVarsProvider>
    );

// The only free-text field in the dialog.
const titleInput = () => screen.getByRole("textbox") as HTMLInputElement;

describe("ModalImportMarkdown", () => {
    it("keeps the typed title when the parent re-renders with a fresh context object", () => {
        const { rerender } = renderModal({ kind: "task", projectId: 7, taskId: 42 }, true);

        fireEvent.change(titleInput(), { target: { value: "Release plan" } });
        expect(titleInput().value).toBe("Release plan");

        // Same destination, new object identity — exactly what the note
        // header hands down on every render.
        rerenderModal(rerender, { kind: "task", projectId: 7, taskId: 42 }, true);

        expect(titleInput().value).toBe("Release plan");
    });

    it("offers task destinations on the header path", () => {
        renderModal({ kind: "task", projectId: 7, taskId: 42 }, true);

        // Seeded to the surface the dialog was opened from. (The label
        // shows on both the Select's own button and its option row.)
        expect(screen.getAllByText("Genos › Fix login GEN-42").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Genos › Ship it GEN-43").length).toBeGreaterThan(0);
    });

    it("shows no destination control when opened from a sidebar folder row", () => {
        renderModal({ kind: "task", projectId: 7, taskId: 42 }, false);

        expect(screen.queryByText("Folder")).toBeNull();
        expect(screen.queryByText("Genos › Fix login GEN-42")).toBeNull();
    });
});
