/**
 * MIP-1584: "Delete permanently". The service posts the typed confirmation the server insists on and
 * turns a refusal into a `ForceDeleteError`; the dialog keeps its red button disabled until the
 * phrase is typed, shows why the server refused, and closes only on success.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForceDeleteDialog } from "../components/ui/modal/ForceDeleteDialog";
import {
    forceDeleteAllMyMessages,
    ForceDeleteError,
    forceDeleteTask,
} from "../services/forceDelete";

vi.mock("axios", () => ({
    default: {
        post: vi.fn(),
        isAxiosError: (e: unknown) => (e as { isAxiosError?: boolean })?.isAxiosError === true,
    },
}));

const post = vi.mocked(axios.post);
const ok = (data: object) => Promise.resolve({ data });

describe("forceDelete service", () => {
    beforeEach(() => post.mockReset());

    it("posts the typed confirmation to the task route with the token", async () => {
        post.mockReturnValue(ok({ deleted: true, kind: "task", id: "7", removed: {}, left: {} }));
        await forceDeleteTask("tok", 7);
        const [url, body, config] = post.mock.calls[0];
        expect(String(url)).toMatch(/\/api\/v3\/tasks\/7\/force-delete\/$/);
        expect(body).toEqual({ confirm: "delete-permanently" });
        expect(config?.headers).toMatchObject({ Authorization: "Bearer tok" });
    });

    it("turns a server refusal into a ForceDeleteError with its status and code", async () => {
        const err = Object.assign(new Error("no"), {
            isAxiosError: true,
            response: {
                status: 409,
                data: { code: "has_subtasks", error: "Delete the sub-tasks." },
            },
        });
        post.mockImplementationOnce(async () => {
            throw err;
        });
        const got = await forceDeleteTask("tok", 7).catch((e: unknown) => e);
        expect(got).toBeInstanceOf(ForceDeleteError);
        expect(got).toMatchObject({ status: 409, code: "has_subtasks" });
    });

    it("refuses without a token and never calls the server", async () => {
        await expect(forceDeleteTask(null, 7)).rejects.toBeInstanceOf(ForceDeleteError);
        expect(post).not.toHaveBeenCalled();
    });

    it("loops 'all my messages' until nothing remains", async () => {
        post.mockReturnValueOnce(ok({ removed: { messages: 2 }, remaining: 1 }));
        post.mockReturnValueOnce(ok({ removed: { messages: 1 }, remaining: 0 }));
        expect(await forceDeleteAllMyMessages("tok", "chan")).toBe(3);
        expect(post).toHaveBeenCalledTimes(2);
    });
});

const renderDialog = (onConfirm: () => Promise<unknown>, onClose = vi.fn()) =>
    render(
        <CssVarsProvider>
            <ForceDeleteDialog
                description="gone for good"
                title="Delete it?"
                open
                onClose={onClose}
                onConfirm={onConfirm}
            />
        </CssVarsProvider>
    );

describe("ForceDeleteDialog", () => {
    it("keeps Confirm disabled until the phrase is typed, then runs the delete and closes", async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined);
        const onClose = vi.fn();
        renderDialog(onConfirm, onClose);
        const confirm = screen.getByRole("button", { name: "Delete permanently" });
        expect(confirm).toBeDisabled();
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
        expect(confirm).toBeEnabled();
        fireEvent.click(confirm);
        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("shows why the server refused and stays open", async () => {
        const onClose = vi.fn();
        renderDialog(() => Promise.reject(new ForceDeleteError(403, "forbidden", "no")), onClose);
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
        fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
        await screen.findByText(/Only its creator or the project owner/);
        expect(onClose).not.toHaveBeenCalled();
    });
});
