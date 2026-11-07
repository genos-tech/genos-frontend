/**
 * The four feedback primitives (MIP-1132): EmptyState, Skeleton, the toast
 * host and TabStrip. These pin the contract the app now relies on: a toast
 * is announced, hovering it pauses its timer, Undo runs once, a tab strip is
 * a real tablist that follows the arrow keys (mirrored in RTL).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmptyState } from "../components/ui/feedback/EmptyState";
import { SkeletonLines, SkeletonRows, Spinner } from "../components/ui/feedback/Skeleton";
import { TabItem, TabStrip } from "../components/ui/feedback/TabStrip";
import { Toast, ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts, MAX_VISIBLE, toast } from "../components/ui/feedback/toastStore";
import { getMessages, I18nProvider, loadLocale } from "../i18n";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

const wrap = (ui: React.ReactNode) => <CssVarsProvider>{ui}</CssVarsProvider>;

afterEach(() => {
    cleanup();
    __resetToasts();
    document.getElementById("genos-toast-region")?.remove();
    // The Arabic test switches the document to RTL; later tests must not inherit it.
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
    vi.useRealTimers();
});

describe("EmptyState", () => {
    it("shows the title, the next step and one action that fires", () => {
        const onClick = vi.fn();
        render(
            wrap(
                <EmptyState
                    action={{ label: "New note", onClick }}
                    body="Pick a note, or start a new one."
                    icon={<span data-testid="ic" />}
                    title="No note open"
                />
            )
        );
        expect(screen.getByText("No note open")).toBeTruthy();
        expect(screen.getByText("Pick a note, or start a new one.")).toBeTruthy();
        expect(screen.getByTestId("ic")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "New note" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("renders no button and no icon disc when none are given", () => {
        render(wrap(<EmptyState title="No tasks" />));
        expect(screen.queryByRole("button")).toBeNull();
        expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
    });
});

describe("Skeleton", () => {
    it("announces once as Loading and draws the requested rows", () => {
        render(wrap(<SkeletonRows avatar count={4} />));
        const status = screen.getByRole("status", { name: getMessages().common.feedback.loading });
        expect(status.getAttribute("aria-busy")).toBe("true");
        // 4 rows x (avatar + 1 line)
        expect(status.querySelectorAll(".MuiSkeleton-root").length).toBe(8);
    });

    it("lines and the inline spinner carry the same accessible name", () => {
        const loading = getMessages().common.feedback.loading;
        render(
            wrap(
                <>
                    <SkeletonLines lines={2} />
                    <Spinner />
                </>
            )
        );
        expect(screen.getByRole("status", { name: loading })).toBeTruthy();
        // A spinner is an indeterminate progressbar, named the same way.
        expect(screen.getByRole("progressbar", { name: loading })).toBeTruthy();
    });
});

describe("toast host", () => {
    it("is a polite live region, named, created once", () => {
        render(wrap(<ToastHost />));
        render(wrap(<Toast open>hello</Toast>));
        const regions = document.querySelectorAll("#genos-toast-region");
        expect(regions).toHaveLength(1);
        expect(regions[0].getAttribute("aria-live")).toBe("polite");
        expect(regions[0].getAttribute("role")).toBe("region");
        expect(regions[0].getAttribute("aria-label")).toBe(
            getMessages().common.feedback.toast.region
        );
        expect(regions[0].textContent).toContain("hello");
    });

    it("sits in one place: bottom-center, above the Spotlight layer", () => {
        render(wrap(<ToastHost />));
        const style = document.getElementById("genos-toast-region")!.style;
        expect(style.position).toBe("fixed");
        expect(style.left).toBe("50%");
        expect(style.bottom).toContain("16px");
        expect(Number(style.zIndex)).toBeGreaterThan(13300);
    });

    it("announces a failure assertively and a confirmation politely", () => {
        render(wrap(<ToastHost />));
        act(() => {
            toast.error("Could not save");
            toast.success("Saved");
        });
        expect(screen.getByRole("alert").textContent).toContain("Could not save");
        expect(screen.getByRole("status").textContent).toContain("Saved");
    });

    it("hides itself after its duration and calls onClose with the reason", () => {
        vi.useFakeTimers();
        const onClose = vi.fn();
        render(
            wrap(
                <Toast open duration={3000} onClose={onClose}>
                    bye
                </Toast>
            )
        );
        act(() => void vi.advanceTimersByTime(2999));
        expect(onClose).not.toHaveBeenCalled();
        act(() => void vi.advanceTimersByTime(2));
        expect(onClose).toHaveBeenCalledWith("timeout");
    });

    it("pauses the timer while hovered, and a null duration never hides", () => {
        vi.useFakeTimers();
        const onClose = vi.fn();
        const { rerender } = render(
            wrap(
                <Toast open duration={1000} onClose={onClose}>
                    pause me
                </Toast>
            )
        );
        const card = screen.getByRole("status");
        fireEvent.mouseEnter(card);
        act(() => void vi.advanceTimersByTime(5000));
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.mouseLeave(card);
        act(() => void vi.advanceTimersByTime(1001));
        expect(onClose).toHaveBeenCalledWith("timeout");

        onClose.mockClear();
        rerender(
            wrap(
                <Toast open duration={null} onClose={onClose}>
                    stay
                </Toast>
            )
        );
        act(() => void vi.advanceTimersByTime(60_000));
        expect(onClose).not.toHaveBeenCalled();
    });

    it("has a close button that reports 'dismiss'", () => {
        const onClose = vi.fn();
        render(
            wrap(
                <Toast open onClose={onClose}>
                    x
                </Toast>
            )
        );
        fireEvent.click(screen.getByRole("button", { name: getMessages().common.actions.close }));
        expect(onClose).toHaveBeenCalledWith("dismiss");
    });

    it("undoable: offers a localized Undo that runs once and removes the toast", () => {
        render(wrap(<ToastHost />));
        const onUndo = vi.fn();
        act(() => void toast.undoable("Task deleted", onUndo));
        const undo = screen.getByRole("button", {
            name: getMessages().common.feedback.toast.undo,
        });
        fireEvent.click(undo);
        expect(onUndo).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Task deleted")).toBeNull();
    });

    it("an action gives people longer to decide (8 s) than a plain toast (5 s)", () => {
        vi.useFakeTimers();
        render(wrap(<ToastHost />));
        act(() => {
            toast.undoable("with undo", () => {});
            toast.neutral("plain");
        });
        act(() => void vi.advanceTimersByTime(5001));
        expect(screen.queryByText("plain")).toBeNull();
        expect(screen.getByText("with undo")).toBeTruthy();
        act(() => void vi.advanceTimersByTime(3000));
        expect(screen.queryByText("with undo")).toBeNull();
    });

    it("the same id replaces instead of stacking; the stack is capped", () => {
        render(wrap(<ToastHost />));
        act(() => {
            toast.show("first", { id: "k" });
            toast.show("second", { id: "k" });
        });
        expect(screen.queryByText("first")).toBeNull();
        expect(screen.getByText("second")).toBeTruthy();
        act(() => {
            for (let i = 0; i < MAX_VISIBLE + 3; i++) toast.neutral(`n${i}`);
        });
        expect(document.querySelectorAll("[data-toast-tone]")).toHaveLength(MAX_VISIBLE);
        expect(screen.queryByText("n0")).toBeNull();
        expect(screen.getByText(`n${MAX_VISIBLE + 2}`)).toBeTruthy();
    });

    it("speaks Arabic: the region name and Undo come from the ar catalog", async () => {
        const msgs = await loadLocale("ar");
        localStorage.setItem(LOCALE_STORAGE_KEY, "ar");
        render(
            <I18nProvider>
                <CssVarsProvider>
                    <ToastHost />
                </CssVarsProvider>
            </I18nProvider>
        );
        act(() => void toast.undoable("حُذفت المهمة", () => {}));
        expect(document.getElementById("genos-toast-region")!.getAttribute("aria-label")).toBe(
            msgs.common.feedback.toast.region
        );
        expect(msgs.common.feedback.toast.undo).not.toBe(
            getMessages("en").common.feedback.toast.undo
        );
        expect(screen.getByRole("button", { name: msgs.common.feedback.toast.undo })).toBeTruthy();
        localStorage.removeItem(LOCALE_STORAGE_KEY);
    });
});

describe("TabStrip", () => {
    const tabs: TabItem[] = [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta", count: 3, attention: true },
        { id: "c", label: "Gamma", disabled: true },
        { id: "d", label: "Delta", closable: true },
    ];
    const mount = (value = "a", rtl = false) => {
        const onChange = vi.fn();
        const onClose = vi.fn();
        const utils = render(
            wrap(
                <div style={rtl ? { direction: "rtl" } : undefined}>
                    <TabStrip
                        ariaLabel="Sections"
                        closeLabel="Close tab"
                        tabs={tabs}
                        value={value}
                        onChange={onChange}
                        onClose={onClose}
                    />
                </div>
            )
        );
        return { onChange, onClose, ...utils };
    };

    beforeEach(() => {
        // jsdom has no layout; the strip only calls these for scrolling.
        window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            cb(0);
            return 0;
        }) as typeof window.requestAnimationFrame;
    });

    it("is a named tablist whose selected tab is the only tab stop", () => {
        mount("b");
        expect(screen.getByRole("tablist", { name: "Sections" })).toBeTruthy();
        const tabEls = screen.getAllByRole("tab");
        expect(tabEls).toHaveLength(4);
        expect(screen.getByRole("tab", { name: /Beta/ }).getAttribute("aria-selected")).toBe(
            "true"
        );
        expect(tabEls.filter((t) => t.tabIndex === 0)).toHaveLength(1);
        expect(screen.getByRole("tab", { name: /Beta/ }).tabIndex).toBe(0);
        expect((screen.getByRole("tab", { name: "Gamma" }) as HTMLButtonElement).disabled).toBe(
            true
        );
    });

    it("click selects, a disabled tab does not", () => {
        const { onChange } = mount();
        fireEvent.click(screen.getByRole("tab", { name: /Beta/ }));
        expect(onChange).toHaveBeenCalledWith("b");
        onChange.mockClear();
        fireEvent.click(screen.getByRole("tab", { name: "Gamma" }));
        expect(onChange).not.toHaveBeenCalled();
    });

    it("arrow keys move to the next ENABLED tab and wrap; Home/End jump", () => {
        const { onChange } = mount("b");
        const list = screen.getByRole("tablist");
        fireEvent.keyDown(list, { key: "ArrowRight" });
        expect(onChange).toHaveBeenLastCalledWith("d"); // skips disabled Gamma
        fireEvent.keyDown(list, { key: "ArrowLeft" });
        expect(onChange).toHaveBeenLastCalledWith("a");
        fireEvent.keyDown(list, { key: "End" });
        expect(onChange).toHaveBeenLastCalledWith("d");
        fireEvent.keyDown(list, { key: "Home" });
        expect(onChange).toHaveBeenLastCalledWith("a");
    });

    it("wraps from the last tab to the first", () => {
        const { onChange } = mount("d");
        fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
        expect(onChange).toHaveBeenLastCalledWith("a");
    });

    it("mirrors the arrows in right-to-left", () => {
        const { onChange } = mount("a", true);
        fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
        expect(onChange).toHaveBeenLastCalledWith("d");
    });

    it("shows a count that is accented when it needs attention, and caps at 99+", () => {
        mount();
        expect(screen.getByRole("tab", { name: /Beta/ }).textContent).toContain("3");
        cleanup();
        render(
            wrap(
                <TabStrip
                    ariaLabel="s"
                    tabs={[{ id: "x", label: "X", count: 250 }]}
                    value="x"
                    onChange={() => {}}
                />
            )
        );
        expect(screen.getByRole("tab").textContent).toContain("99+");
    });

    it("closes a closable tab by button and by Delete, without selecting it", () => {
        const { onClose, onChange } = mount("a");
        fireEvent.click(screen.getByRole("button", { name: "Close tab" }));
        expect(onClose).toHaveBeenCalledWith("d");
        expect(onChange).not.toHaveBeenCalled();
        onClose.mockClear();
        fireEvent.keyDown(screen.getByRole("tab", { name: "Delta" }), { key: "Delete" });
        expect(onClose).toHaveBeenCalledWith("d");
        onClose.mockClear();
        fireEvent.keyDown(screen.getByRole("tab", { name: "Alpha" }), { key: "Delete" });
        expect(onClose).not.toHaveBeenCalled();
    });
});
