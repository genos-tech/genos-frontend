/**
 * MIP-1125: the one confirmation dialog.
 *
 * Every delete / leave / "are you sure" in the app is this component, so the
 * behaviour that matters is pinned once, here: focus starts on the SAFE
 * action for a destructive dialog; Esc and the backdrop close it unless work
 * is under way; the typed phrase gates Confirm; busy blocks a second run and
 * any dismissal; a throw keeps it open with the reason; the destructive
 * button is flat red, never the brand gradient; and it renders in `ar`.
 */
import { CacheProvider } from "@emotion/react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { ConfirmDialog } from "../components/ui/modal/ConfirmDialog";
import { applyDocumentLocale, I18nProvider, loadLocale } from "../i18n";
import { getRtlCache } from "../theme/rtlCache";

afterEach(() => {
    cleanup();
    applyDocumentLocale("en");
    document.documentElement.dir = "";
    window.localStorage.removeItem("genos-locale");
});

type Props = Parameters<typeof ConfirmDialog>[0];

const mount = (over: Partial<Props> = {}) => {
    const props: Props = {
        open: true,
        title: "Delete this task?",
        description: "This cannot be undone.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        destructive: true,
        onConfirm: vi.fn(async () => {}),
        onClose: vi.fn(),
        ...over,
    };
    const view = render(
        <CssVarsProvider>
            <ConfirmDialog {...props} />
        </CssVarsProvider>
    );
    return { props, ...view };
};

const deferred = () => {
    let resolve!: (v?: unknown) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const confirmBtn = (name = "Delete") => screen.getByRole("button", { name }) as HTMLButtonElement;
const cancelBtn = () => screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement;
const dialogEl = () => document.querySelector("[data-tone]") as HTMLElement;

describe("ConfirmDialog", () => {
    it("shows title, description, entity name and both buttons; named and described", () => {
        mount({ entityName: "Fix the login bug" });
        const d = screen.getByRole("alertdialog");
        expect(d.textContent).toContain("Fix the login bug");
        const name = document.getElementById(d.getAttribute("aria-labelledby")!)!;
        expect(name.textContent).toBe("Delete this task?");
        const desc = document.getElementById(d.getAttribute("aria-describedby")!)!;
        expect(desc.textContent).toBe("This cannot be undone.");
        expect(confirmBtn()).toBeTruthy();
        expect(cancelBtn()).toBeTruthy();
    });

    it("destructive is an alertdialog, non-destructive a dialog; the marker follows", () => {
        const a = mount();
        expect(dialogEl().getAttribute("data-tone")).toBe("danger");
        expect(screen.getByRole("alertdialog")).toBeTruthy();
        a.unmount();
        mount({ destructive: false });
        expect(dialogEl().getAttribute("data-tone")).toBe("brand");
        expect(screen.getByRole("dialog")).toBeTruthy();
        expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    describe("initial focus and focus trap", () => {
        it("destructive: focus starts on Cancel, the safe action", () => {
            mount();
            expect(document.activeElement).toBe(cancelBtn());
        });

        it("non-destructive: focus starts on the confirm button", () => {
            mount({ destructive: false, confirmLabel: "Convert" });
            expect(document.activeElement).toBe(confirmBtn("Convert"));
        });

        it("Enter on the initially focused destructive dialog keeps the data", () => {
            // The browser turns Enter on a focused button into a click on it.
            const { props } = mount();
            fireEvent.click(document.activeElement as HTMLElement);
            expect(props.onClose).toHaveBeenCalledTimes(1);
            expect(props.onConfirm).not.toHaveBeenCalled();
        });

        it("focus stays inside the dialog", () => {
            mount();
            expect(dialogEl().contains(document.activeElement)).toBe(true);
        });
    });

    describe("dismissal", () => {
        it("Esc closes without running the action", () => {
            const { props } = mount();
            fireEvent.keyDown(dialogEl(), { key: "Escape" });
            expect(props.onClose).toHaveBeenCalledTimes(1);
            expect(props.onConfirm).not.toHaveBeenCalled();
        });

        it("Cancel and a backdrop click close without running the action", () => {
            const { props } = mount();
            fireEvent.click(cancelBtn());
            fireEvent.click(document.querySelector(".MuiModal-backdrop")!);
            expect(props.onClose).toHaveBeenCalledTimes(2);
            expect(props.onConfirm).not.toHaveBeenCalled();
        });

        it("there is no close X (Cancel is the way out)", () => {
            mount();
            expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
        });
    });

    describe("busy", () => {
        it("while onConfirm runs: confirm shows progress, everything is blocked, one run only", async () => {
            const d = deferred();
            const { props } = mount({ onConfirm: vi.fn(() => d.promise) });
            await act(async () => {
                fireEvent.click(confirmBtn());
            });
            // Joy marks a loading button; it is also not clickable.
            expect(confirmBtn().disabled).toBe(true);
            expect(confirmBtn().className).toMatch(/loading/i);
            expect(cancelBtn().disabled).toBe(true);
            await act(async () => {
                fireEvent.click(confirmBtn());
            });
            fireEvent.click(cancelBtn());
            fireEvent.keyDown(dialogEl(), { key: "Escape" });
            fireEvent.click(document.querySelector(".MuiModal-backdrop")!);
            expect(props.onConfirm).toHaveBeenCalledTimes(1);
            expect(props.onClose).not.toHaveBeenCalled();
            await act(async () => {
                d.resolve();
                await d.promise;
            });
            // Settled: dismissible again, and (default) the caller closes it.
            expect(cancelBtn().disabled).toBe(false);
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it("a second Confirm past the disabled button does not run it again", async () => {
            const d = deferred();
            const { props } = mount({ onConfirm: vi.fn(() => d.promise) });
            const btn = confirmBtn();
            await act(async () => {
                fireEvent.click(btn);
            });
            const reactKey = Object.keys(btn).find((k) => k.startsWith("__reactProps"))!;
            await act(async () => {
                (btn as unknown as Record<string, { onClick: () => void }>)[reactKey].onClick();
            });
            expect(props.onConfirm).toHaveBeenCalledTimes(1);
            await act(async () => {
                d.resolve();
                await d.promise;
            });
        });

        it("the busy prop (caller runs the action) blocks the same things", () => {
            const { props } = mount({ busy: true });
            expect(confirmBtn().disabled).toBe(true);
            expect(cancelBtn().disabled).toBe(true);
            fireEvent.keyDown(dialogEl(), { key: "Escape" });
            fireEvent.click(cancelBtn());
            expect(props.onClose).not.toHaveBeenCalled();
        });
    });

    describe("outcome", () => {
        it("default: runs the action once and leaves closing to the caller", async () => {
            const { props } = mount();
            await act(async () => {
                fireEvent.click(confirmBtn());
            });
            expect(props.onConfirm).toHaveBeenCalledTimes(1);
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it("closeOnConfirm: closes once the action settles", async () => {
            const { props } = mount({ closeOnConfirm: true });
            await act(async () => {
                fireEvent.click(confirmBtn());
            });
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        it("closeOnConfirm: a `false` result keeps it open", async () => {
            const { props } = mount({ closeOnConfirm: true, onConfirm: vi.fn(async () => false) });
            await act(async () => {
                fireEvent.click(confirmBtn());
            });
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it("a throw keeps it open, shows why, and allows retry or cancel", async () => {
            const { props } = mount({
                closeOnConfirm: true,
                onConfirm: vi.fn(async () => {
                    throw new Error("The server said no.");
                }),
            });
            await act(async () => {
                fireEvent.click(confirmBtn());
            });
            expect(props.onClose).not.toHaveBeenCalled();
            expect(screen.getByRole("alert").textContent).toContain("The server said no.");
            expect(cancelBtn().disabled).toBe(false);
            expect(confirmBtn().disabled).toBe(false);
        });

        it("a throw without a message falls back to the generic error", async () => {
            mount({
                onConfirm: vi.fn(async () => {
                    throw "nope";
                }),
            });
            await act(async () => {
                fireEvent.click(confirmBtn());
            });
            expect(screen.getByRole("alert").textContent).toMatch(/\S/);
        });

        it("shows a caller-owned error, and confirmDisabled disables Confirm", () => {
            mount({ error: "Delete the sub-notes first.", confirmDisabled: true });
            expect(screen.getByRole("alert").textContent).toContain("Delete the sub-notes first.");
            expect(confirmBtn().disabled).toBe(true);
        });
    });

    describe("typed confirmation", () => {
        const phrase = {
            confirmPhrase: "Q3 launch",
            confirmPhraseLabel: "Type Q3 launch to confirm",
        };
        const field = () => screen.getByLabelText("Type Q3 launch to confirm") as HTMLInputElement;

        it("Confirm is disabled until the exact phrase is typed; the field is labelled", () => {
            mount(phrase);
            expect(confirmBtn().disabled).toBe(true);
            fireEvent.change(field(), { target: { value: "Q3 launc" } });
            expect(confirmBtn().disabled).toBe(true);
            fireEvent.change(field(), { target: { value: "q3 launch" } });
            expect(confirmBtn().disabled).toBe(true);
            fireEvent.change(field(), { target: { value: "Q3 launch" } });
            expect(confirmBtn().disabled).toBe(false);
        });

        it("focus starts in the field, and the field is not spell-checked or autofilled", () => {
            mount(phrase);
            expect(document.activeElement).toBe(field());
            expect(field().getAttribute("spellcheck")).toBe("false");
            expect(field().getAttribute("autocomplete")).toBe("off");
        });

        it("a wrong phrase never runs the action, not even on Enter", async () => {
            const { props } = mount(phrase);
            fireEvent.change(field(), { target: { value: "nope" } });
            await act(async () => {
                fireEvent.keyDown(field(), { key: "Enter" });
            });
            expect(props.onConfirm).not.toHaveBeenCalled();
        });

        it("the right phrase runs it on click and on Enter", async () => {
            const { props } = mount(phrase);
            fireEvent.change(field(), { target: { value: "Q3 launch" } });
            await act(async () => {
                fireEvent.click(confirmBtn());
            });
            await act(async () => {
                fireEvent.keyDown(field(), { key: "Enter" });
            });
            expect(props.onConfirm).toHaveBeenCalledTimes(2);
        });

        it("falls back to the phrase as the label", () => {
            mount({ confirmPhrase: "DELETE" });
            expect(screen.getByLabelText("DELETE")).toBeTruthy();
        });

        it("is cleared when the dialog is dismissed, so reopening starts locked", () => {
            const { props, rerender } = mount(phrase);
            fireEvent.change(field(), { target: { value: "Q3 launch" } });
            fireEvent.click(cancelBtn());
            expect(props.onClose).toHaveBeenCalled();
            rerender(
                <CssVarsProvider>
                    <ConfirmDialog {...props} open={false} />
                </CssVarsProvider>
            );
            rerender(
                <CssVarsProvider>
                    <ConfirmDialog {...props} open />
                </CssVarsProvider>
            );
            expect(confirmBtn().disabled).toBe(true);
        });
    });

    it("closed from outside: reopening starts clean (no old phrase, no old error)", async () => {
        const phrase = "Q3 launch";
        const { props, rerender } = mount({
            confirmPhrase: phrase,
            onConfirm: vi.fn(async () => {
                throw new Error("The server said no.");
            }),
        });
        fireEvent.change(screen.getByLabelText(phrase), { target: { value: phrase } });
        await act(async () => {
            fireEvent.click(confirmBtn());
        });
        expect(screen.getByRole("alert")).toBeTruthy();
        const view = (open: boolean) => (
            <CssVarsProvider>
                <ConfirmDialog {...props} open={open} />
            </CssVarsProvider>
        );
        rerender(view(false));
        rerender(view(true));
        expect(screen.queryByRole("alert")).toBeNull();
        expect((screen.getByLabelText(phrase) as HTMLInputElement).value).toBe("");
        expect(confirmBtn().disabled).toBe(true);
    });

    describe("look", () => {
        it("the destructive button is flat danger.solid with its own foreground, no gradient", () => {
            mount();
            const css = cssOf(confirmBtn());
            expect(css).toContain("background: var(--g-danger-solid)");
            expect(css).toContain("color: var(--g-danger-solid-fg)");
            expect(css).not.toMatch(/gradient/i);
            expect(css).not.toMatch(/box-shadow/i);
        });

        it("the cancel button is never red", () => {
            mount();
            expect(cssOf(cancelBtn())).not.toContain("danger");
        });

        it("the dialog itself is flat in both variants", () => {
            const a = mount();
            expect(cssOf(dialogEl())).not.toMatch(/gradient/i);
            a.unmount();
            mount({ destructive: false });
            expect(cssOf(dialogEl())).not.toMatch(/gradient/i);
        });
    });

    describe("stacking comes from the host", () => {
        const z = () => getComputedStyle(screen.getByRole("presentation")).zIndex;

        it("defaults to 10010; takes an exact layer; lifts over a host", () => {
            const a = mount();
            expect(z()).toBe("10010");
            a.unmount();
            const b = mount({ zIndex: 13250 });
            expect(z()).toBe("13250");
            b.unmount();
            mount({ hostZIndex: 10020 });
            expect(z()).toBe("10022");
        });
    });

    it("does not leak clicks or keys to the component that opened it", () => {
        const onClick = vi.fn();
        const onKeyDown = vi.fn();
        render(
            <CssVarsProvider>
                <div onClick={onClick} onKeyDown={onKeyDown}>
                    <ConfirmDialog
                        cancelLabel="Cancel"
                        confirmLabel="Delete"
                        title="T"
                        destructive
                        open
                        onClose={() => {}}
                        onConfirm={() => {}}
                    />
                </div>
            </CssVarsProvider>
        );
        fireEvent.click(cancelBtn());
        fireEvent.click(confirmBtn());
        fireEvent.keyDown(confirmBtn(), { key: "Enter" });
        expect(onClick).not.toHaveBeenCalled();
        expect(onKeyDown).not.toHaveBeenCalled();
    });

    it("renders in Arabic (RTL): same focus, same Esc, no physical alignment", async () => {
        await loadLocale("ar");
        window.localStorage.setItem("genos-locale", "ar");
        applyDocumentLocale("ar");
        const onClose = vi.fn();
        render(
            <CacheProvider value={getRtlCache()}>
                <CssVarsProvider>
                    <I18nProvider>
                        <ConfirmDialog
                            cancelLabel="إلغاء"
                            confirmLabel="حذف"
                            description="لا يمكن التراجع."
                            entityName="مهمة"
                            title="حذف المهمة؟"
                            destructive
                            open
                            onClose={onClose}
                            onConfirm={() => {}}
                        />
                    </I18nProvider>
                </CssVarsProvider>
            </CacheProvider>
        );
        expect(document.documentElement.dir).toBe("rtl");
        expect(screen.getByRole("alertdialog").textContent).toContain("حذف المهمة؟");
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "إلغاء" }));
        expect(getComputedStyle(dialogEl()).direction).toBe("rtl");
        expect(cssOf(dialogEl())).not.toMatch(/text-align:\s*(left|right)/);
        fireEvent.keyDown(dialogEl(), { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
