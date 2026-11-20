/**
 * MIP-1705: the delete-group dialog. Two choices: "Delete" (soft, hides the group, kept
 * recoverable) is chosen and works at once; "Delete permanently" erases everything, so its button
 * stays off until the group's name is typed.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModalDeleteChat } from "../features/chat/components/modals/ModalDeleteChat";
import { en } from "../i18n/locales/en";

const copy = en.common.deleteChat;

const show = (onConfirm = vi.fn().mockResolvedValue(true), onCancel = vi.fn()) => {
    const view = render(
        <CssVarsProvider>
            <ModalDeleteChat
                chatName="Launch crew"
                open
                onCancel={onCancel}
                onConfirm={onConfirm}
            />
        </CssVarsProvider>
    );
    return { onConfirm, onCancel, ...view };
};

const confirmButton = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("the delete-group dialog", () => {
    it("starts on the soft choice, names the group, and says what each choice does", () => {
        show();

        expect(screen.getByText(copy.title)).toBeTruthy();
        expect(screen.getByText("Launch crew")).toBeTruthy();
        expect((screen.getByLabelText(copy.softLabel) as HTMLInputElement).checked).toBe(true);
        expect((screen.getByLabelText(copy.hardLabel) as HTMLInputElement).checked).toBe(false);
        expect(screen.getByText(copy.softHint)).toBeTruthy();
        expect(screen.getByText(copy.hardHint)).toBeTruthy();
        expect(screen.getByText(copy.description)).toBeTruthy();
    });

    it("a soft delete needs no typing and is sent as soft", async () => {
        const { onConfirm } = show();

        fireEvent.click(confirmButton(copy.confirmSoft));

        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("soft"));
    });

    it("a permanent delete is off until the group's name is typed, then sent as hard", async () => {
        const { onConfirm } = show();
        fireEvent.click(screen.getByLabelText(copy.hardLabel));

        const button = confirmButton(copy.confirmHard);
        expect(button.disabled).toBe(true);
        fireEvent.click(button);
        expect(onConfirm).not.toHaveBeenCalled();

        const field = screen.getByLabelText(copy.typeNameLabel);
        fireEvent.change(field, { target: { value: "Launch cre" } });
        expect(confirmButton(copy.confirmHard).disabled).toBe(true);

        fireEvent.change(field, { target: { value: "Launch crew" } });
        expect(confirmButton(copy.confirmHard).disabled).toBe(false);
        fireEvent.click(confirmButton(copy.confirmHard));

        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("hard"));
    });

    it("choosing the soft one again takes the name field away", () => {
        show();
        fireEvent.click(screen.getByLabelText(copy.hardLabel));
        expect(screen.queryByLabelText(copy.typeNameLabel)).toBeTruthy();

        fireEvent.click(screen.getByLabelText(copy.softLabel));

        expect(screen.queryByLabelText(copy.typeNameLabel)).toBeNull();
    });

    it("a refused delete shows the reason and stays open", async () => {
        const { onConfirm } = show(vi.fn().mockResolvedValue(false));

        fireEvent.click(confirmButton(copy.confirmSoft));

        await waitFor(() => expect(screen.getByText(copy.genericError)).toBeTruthy());
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(screen.getByText(copy.title)).toBeTruthy();
    });

    it("Cancel sends nothing", () => {
        const { onConfirm, onCancel } = show();

        fireEvent.click(screen.getByRole("button", { name: copy.cancel }));

        expect(onCancel).toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it("every opening starts on the safe choice again", () => {
        const { rerender, onConfirm } = show();
        fireEvent.click(screen.getByLabelText(copy.hardLabel));
        const again = (open: boolean) =>
            rerender(
                <CssVarsProvider>
                    <ModalDeleteChat
                        chatName="Launch crew"
                        open={open}
                        onCancel={vi.fn()}
                        onConfirm={onConfirm}
                    />
                </CssVarsProvider>
            );

        again(false);
        again(true);

        expect((screen.getByLabelText(copy.softLabel) as HTMLInputElement).checked).toBe(true);
    });
});
