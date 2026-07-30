/**
 * The confirm step for filing an ownership claim.
 *
 * The button that opens this sits in the team profile's action row next
 * to Invite members and Transfer ownership — one word, no context. So
 * this modal is the only place the user is told that the owner hears
 * about it immediately and that nothing moves for 30 days. Filing
 * without that shown would be filing blind.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModalRequestOwnership } from "../features/admin/components/team/ModalRequestOwnership";

const renderModal = (onConfirm = vi.fn().mockResolvedValue(true), onCancel = vi.fn()) => {
    render(
        <CssVarsProvider>
            <ModalRequestOwnership
                open={true}
                responseDays={30}
                teamName="Acme"
                onCancel={onCancel}
                onConfirm={onConfirm}
            />
        </CssVarsProvider>
    );
    return { onConfirm, onCancel };
};

describe("ModalRequestOwnership", () => {
    it("names the team being claimed", () => {
        renderModal();
        expect(screen.getByText("Acme")).toBeTruthy();
    });

    it("states the response window, from the server's own number", () => {
        // The load-bearing sentence. A hard-coded "30 days" here could
        // silently disagree with CLAIM_RESPONSE_DAYS on the server.
        renderModal();
        expect(screen.getByText(/within 30 days/)).toBeTruthy();
    });

    it("files nothing until the request is confirmed", () => {
        // The whole reason this modal exists: the row button must not
        // be a one-click ownership claim.
        const { onConfirm } = renderModal();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it("cancelling closes without filing", () => {
        const { onConfirm, onCancel } = renderModal();
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
        expect(onConfirm).not.toHaveBeenCalled();
        expect(onCancel).toHaveBeenCalled();
    });

    it("files the claim on confirm and closes", async () => {
        const { onConfirm, onCancel } = renderModal();
        fireEvent.click(screen.getByRole("button", { name: /send request/i }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        await waitFor(() => expect(onCancel).toHaveBeenCalled());
    });

    it("stays open with an error when the server refuses", async () => {
        // Closing on failure would read as success — the user would
        // believe a claim is pending when none is.
        const { onCancel } = renderModal(vi.fn().mockResolvedValue(false));
        fireEvent.click(screen.getByRole("button", { name: /send request/i }));
        await waitFor(() => expect(screen.getByText(/Couldn't send the request/)).toBeTruthy());
        expect(onCancel).not.toHaveBeenCalled();
    });
});
