/**
 * MIP-2357: the note share dialog can carry a warning line above its members, for a note whose
 * readers matter to its owner's job (a scheduled dashboard page). A plain note has none.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModalNoteSharing } from "../features/notes/common/components/ModalNoteSharing";

const base = () =>
    ({
        open: true,
        onClose: vi.fn(),
        noteType: 1,
        noteId: 11,
        noteTitle: "Milestone X dashboard",
        myself: { userId: "u1", teamId: "t1", userName: "Ken", userEmail: "k@example.com" },
        setMyself: vi.fn(),
        socket: null,
        useCM: {},
        useUISM: {},
        teamMembers: [],
        useNM: { currentNoteMembers: [], grantNoteRole: vi.fn(), revokeNoteRole: vi.fn() },
    }) as unknown as React.ComponentProps<typeof ModalNoteSharing>;

const renderDialog = (extra: Partial<React.ComponentProps<typeof ModalNoteSharing>> = {}) =>
    render(
        <CssVarsProvider>
            <ModalNoteSharing {...base()} {...extra} />
        </CssVarsProvider>
    );

describe("the share dialog's notice", () => {
    it("shows the warning above the members when one is given", () => {
        renderDialog({ notice: "Everyone you add is checked at every run." });
        expect(screen.getByRole("note")).toHaveTextContent(
            "Everyone you add is checked at every run."
        );
    });

    it("shows none for a plain note", () => {
        renderDialog();
        expect(screen.queryByRole("note")).toBeNull();
        // It is the dialog all the same.
        expect(screen.getByRole("dialog")).toBeTruthy();
    });
});
