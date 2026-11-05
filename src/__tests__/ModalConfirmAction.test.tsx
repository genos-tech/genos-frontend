/**
 * MIP-1042 follow-up: a confirmation in the app's own dialog style, not the
 * browser's `confirm()`.
 *
 * `ModalConfirmAction` is the non-destructive sibling of ModalLeaveConfirm (the
 * same dark card, icon tile, title, text and Cancel / primary buttons, in the
 * brand colours that Join / Create project use). Behaviour pinned here: Confirm
 * runs the action and then closes; Cancel, Esc and a click outside close
 * without running it; while the action runs nothing can dismiss or repeat it;
 * and a thrown action keeps the dialog open with the error.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModalConfirmAction } from "../components/ui/misc/ModalConfirmAction";

afterEach(cleanup);

const baseProps = () => ({
    open: true,
    title: "Convert this task to a milestone?",
    description: "Its sub-tasks stay under it.",
    confirmLabel: "Convert to milestone",
    cancelLabel: "Cancel",
    onConfirm: vi.fn(async () => {}),
    onClose: vi.fn(),
});

const mount = (over: Partial<ReturnType<typeof baseProps>> & Record<string, unknown> = {}) => {
    const props = { ...baseProps(), ...over };
    const view = render(
        <CssVarsProvider>
            <ModalConfirmAction {...(props as never)} />
        </CssVarsProvider>
    );
    return { props, ...view };
};

/** A promise the test settles by hand, to look at the dialog mid-action. */
const deferred = () => {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

describe("ModalConfirmAction", () => {
    it("shows the title, the text, the name and both buttons in a dialog", () => {
        mount({ entityName: "Q3 launch" });
        const dialog = screen.getByRole("dialog");
        expect(dialog.textContent).toContain("Convert this task to a milestone?");
        expect(dialog.textContent).toContain("Its sub-tasks stay under it.");
        expect(dialog.textContent).toContain("Q3 launch");
        expect(screen.getByRole("button", { name: "Convert to milestone" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    });

    it("renders nothing while closed", () => {
        mount({ open: false });
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("never calls the browser's confirm", () => {
        const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
        const { props } = mount();
        fireEvent.click(screen.getByRole("button", { name: "Convert to milestone" }));
        expect(spy).not.toHaveBeenCalled();
        expect(props.onConfirm).toHaveBeenCalled();
        spy.mockRestore();
    });

    it("Confirm runs the action once, then closes", async () => {
        const { props } = mount();
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Convert to milestone" }));
        });
        expect(props.onConfirm).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("Cancel closes without running the action", () => {
        const { props } = mount();
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(props.onConfirm).not.toHaveBeenCalled();
    });

    it("Esc closes without running the action", () => {
        const { props } = mount();
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(props.onConfirm).not.toHaveBeenCalled();
    });

    it("while the action runs: no second run, no dismissing, and the dialog stays up", async () => {
        const d = deferred();
        const { props } = mount({ onConfirm: vi.fn(() => d.promise) });
        const confirm = screen.getByRole("button", { name: "Convert to milestone" });
        await act(async () => {
            fireEvent.click(confirm);
        });
        // A second click, Cancel and Esc are all ignored.
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Convert to milestone" }));
        });
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(props.onConfirm).toHaveBeenCalledTimes(1);
        expect(props.onClose).not.toHaveBeenCalled();
        expect(
            (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled
        ).toBe(true);
        // It closes once the action settles.
        await act(async () => {
            d.resolve();
            await d.promise;
        });
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("a second Confirm while the first runs does not run it again (even past the disabled button)", async () => {
        const d = deferred();
        const { props } = mount({ onConfirm: vi.fn(() => d.promise) });
        const confirm = screen.getByRole("button", { name: "Convert to milestone" });
        await act(async () => {
            fireEvent.click(confirm);
        });
        // Joy disables the button; reach the handler directly, as Enter on a
        // still-focused button or a stray event would.
        const reactKey = Object.keys(confirm).find((k) => k.startsWith("__reactProps"))!;
        await act(async () => {
            (confirm as unknown as Record<string, { onClick: () => void }>)[reactKey].onClick();
        });
        expect(props.onConfirm).toHaveBeenCalledTimes(1);
        await act(async () => {
            d.resolve();
            await d.promise;
        });
    });

    it("a thrown action keeps the dialog open and shows why", async () => {
        const { props } = mount({
            onConfirm: vi.fn(async () => {
                throw new Error("The server said no.");
            }),
        });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Convert to milestone" }));
        });
        expect(props.onClose).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog").textContent).toContain("The server said no.");
        // And the person can try again or cancel.
        expect(
            (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled
        ).toBe(false);
    });

    it("stacks at the layer it is given (above a modal-hosted preview), else at 10010", () => {
        const { unmount } = mount({ zIndex: 13210 });
        expect(getComputedStyle(screen.getByRole("presentation")).zIndex).toBe("13210");
        unmount();
        mount();
        expect(getComputedStyle(screen.getByRole("presentation")).zIndex).toBe("10010");
    });
});
