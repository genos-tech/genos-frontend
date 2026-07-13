/**
 * NoteAccessRequestPanel — the "request access" surface shown in place
 * of the note editor when a shared note URL answers 403.
 *
 * Covers:
 *   - the send button emits `note_access_request` with the note ref
 *     (only ids — the server resolves title/owner; a role-less client
 *     can't know them);
 *   - after sending, the panel flips to the "request sent" state and
 *     the button disappears (no double-fire);
 *   - with no socket, an error is shown instead of a silent no-op.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Socket } from "socket.io-client";
import { describe, expect, it, vi } from "vitest";

import { NoteAccessRequestPanel } from "../features/notes/common/components/NoteAccessRequestPanel";

const makeSocket = () => ({ emit: vi.fn() }) as unknown as Socket;

const renderPanel = (socket: Socket | null) =>
    render(
        <CssVarsProvider>
            <NoteAccessRequestPanel noteId={42} noteType={1} socket={socket} />
        </CssVarsProvider>
    );

describe("NoteAccessRequestPanel", () => {
    it("emits note_access_request with the note ref and flips to sent", () => {
        const socket = makeSocket();
        renderPanel(socket);

        fireEvent.click(screen.getByRole("button", { name: "Request Access" }));

        expect(socket.emit).toHaveBeenCalledTimes(1);
        expect(socket.emit).toHaveBeenCalledWith("note_access_request", {
            note_type: 1,
            note_id: 42,
        });
        // Sent state: confirmation copy in, button gone.
        expect(screen.getByText("Request sent")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Request Access" })).toBeNull();
    });

    it("shows an error instead of silently no-oping without a socket", () => {
        renderPanel(null);
        fireEvent.click(screen.getByRole("button", { name: "Request Access" }));
        expect(screen.getByText("Socket not found.")).toBeInTheDocument();
        // Still requestable once the socket reconnects.
        expect(screen.getByRole("button", { name: "Request Access" })).toBeInTheDocument();
    });
});
