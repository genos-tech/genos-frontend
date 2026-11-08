/**
 * `useUndoableAction` (MIP-1274): delete with an Undo window. The contract that
 * matters: Undo sends NOTHING; the real call is sent once, when the window
 * ends; and a pending delete is never lost (navigation, a second delete, the
 * page closing, the toast being dismissed), and never lies (a failed commit
 * puts the item back and says so).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts, MAX_VISIBLE, toast } from "../components/ui/feedback/toastStore";
import { UndoableRouteFlush } from "../components/ui/feedback/UndoableRouteFlush";
import {
    __resetUndoables,
    flushUndoables,
    runUndoable,
    useUndoableAction,
    useUndoHidden,
    type UndoableRun,
} from "../hooks/common/useUndoableAction";
import { getMessages } from "../i18n";

const UNDO = getMessages().common.feedback.toast.undo;
const WINDOW = 8000;

const make = (over: Partial<UndoableRun> & { key: string }) => {
    const commit = vi.fn(() => Promise.resolve());
    const onRestore = vi.fn();
    const onCommitted = vi.fn();
    const run: UndoableRun = {
        message: `${over.key} deleted`,
        errorMessage: `${over.key} failed`,
        commit,
        onRestore,
        onCommitted,
        ...over,
    };
    return { run, commit, onRestore, onCommitted };
};

const Hidden = () => {
    const hidden = useUndoHidden();
    return <div data-testid="hidden">{[...hidden].sort().join(",")}</div>;
};

const Runner = ({ spec }: { spec: UndoableRun }) => {
    const run = useUndoableAction();
    return (
        <button type="button" onClick={() => run(spec)}>
            delete
        </button>
    );
};

const mount = (ui?: React.ReactNode) =>
    render(
        <CssVarsProvider>
            <MemoryRouter>
                <ToastHost />
                <UndoableRouteFlush />
                <Hidden />
                {ui}
            </MemoryRouter>
        </CssVarsProvider>
    );

const hiddenText = () => screen.getByTestId("hidden").textContent;
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    cleanup();
    __resetUndoables();
    __resetToasts();
    document.getElementById("genos-toast-region")?.remove();
    document.getElementById("genos-banner-region")?.remove();
    vi.useRealTimers();
});

describe("useUndoableAction", () => {
    it("hides the item at once and shows 'deleted' with an Undo button", () => {
        const { run } = make({ key: "a" });
        mount();
        act(() => runUndoable(run));
        expect(hiddenText()).toBe("a");
        expect(screen.getByText("a deleted")).toBeTruthy();
        expect(screen.getByRole("button", { name: UNDO })).toBeTruthy();
    });

    it("Undo inside the window sends nothing, restores once, and keeps nothing hidden", async () => {
        const { run, commit, onRestore, onCommitted } = make({ key: "a" });
        mount();
        act(() => runUndoable(run));
        fireEvent.click(screen.getByRole("button", { name: UNDO }));
        await tick(WINDOW * 3);
        expect(commit).not.toHaveBeenCalled();
        expect(onCommitted).not.toHaveBeenCalled();
        expect(onRestore).toHaveBeenCalledTimes(1);
        expect(hiddenText()).toBe("");
        expect(screen.queryByText("a deleted")).toBeNull();
    });

    it("the window ends: commits exactly once, the item stays hidden, the toast goes", async () => {
        const { run, commit, onRestore, onCommitted } = make({ key: "a" });
        mount();
        act(() => runUndoable(run));
        await tick(WINDOW - 100);
        expect(commit).not.toHaveBeenCalled();
        await tick(200);
        expect(commit).toHaveBeenCalledTimes(1);
        expect(onCommitted).toHaveBeenCalledTimes(1);
        expect(onRestore).not.toHaveBeenCalled();
        expect(hiddenText()).toBe("a");
        expect(screen.queryByText("a deleted")).toBeNull();
        await tick(WINDOW * 3);
        expect(commit).toHaveBeenCalledTimes(1);
    });

    it("hovering the toast pauses the window: nothing is sent while a person is reaching for Undo", async () => {
        const { run, commit } = make({ key: "a" });
        mount();
        act(() => runUndoable(run));
        const card = screen.getByText("a deleted").closest("[data-toast-tone]") as HTMLElement;
        fireEvent.mouseEnter(card);
        await tick(WINDOW * 3);
        expect(commit).not.toHaveBeenCalled();
        fireEvent.mouseLeave(card);
        await tick(WINDOW + 100);
        expect(commit).toHaveBeenCalledTimes(1);
    });

    it("closing the toast with its x commits (it is not an Undo)", async () => {
        const { run, commit, onRestore } = make({ key: "a" });
        mount();
        act(() => runUndoable(run));
        fireEvent.click(screen.getByRole("button", { name: getMessages().common.actions.close }));
        await tick(0);
        expect(commit).toHaveBeenCalledTimes(1);
        expect(onRestore).not.toHaveBeenCalled();
    });

    it("unmounting the component that started it does not lose the delete", async () => {
        const { run, commit } = make({ key: "a" });
        const view = mount(<Runner spec={run} />);
        fireEvent.click(screen.getByRole("button", { name: "delete" }));
        // Same tree minus the runner: its component is gone, the toast host is not.
        view.rerender(
            <CssVarsProvider>
                <MemoryRouter>
                    <ToastHost />
                    <Hidden />
                </MemoryRouter>
            </CssVarsProvider>
        );
        await tick(WINDOW + 100);
        expect(commit).toHaveBeenCalledTimes(1);
    });

    it("a route change commits at once, once", async () => {
        const { run, commit } = make({ key: "a" });
        const Go = () => {
            const navigate = useNavigate();
            return (
                <button type="button" onClick={() => navigate("/elsewhere")}>
                    go
                </button>
            );
        };
        mount(<Go />);
        act(() => runUndoable(run));
        expect(commit).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "go" }));
        await tick(0);
        expect(commit).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("a deleted")).toBeNull();
        await tick(WINDOW * 2);
        expect(commit).toHaveBeenCalledTimes(1);
    });

    it("a second delete commits the first one; only the second can be undone", async () => {
        const a = make({ key: "a" });
        const b = make({ key: "b" });
        mount();
        act(() => runUndoable(a.run));
        act(() => runUndoable(b.run));
        await tick(0);
        expect(a.commit).toHaveBeenCalledTimes(1);
        expect(b.commit).not.toHaveBeenCalled();
        expect(hiddenText()).toBe("a,b");
        expect(screen.queryByText("a deleted")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: UNDO }));
        await tick(WINDOW * 2);
        expect(b.commit).not.toHaveBeenCalled();
        expect(b.onRestore).toHaveBeenCalledTimes(1);
        expect(a.commit).toHaveBeenCalledTimes(1);
        expect(a.onRestore).not.toHaveBeenCalled();
        expect(hiddenText()).toBe("a");
    });

    it("two in a row that are both left alone are each committed exactly once", async () => {
        const a = make({ key: "a" });
        const b = make({ key: "b" });
        mount();
        act(() => runUndoable(a.run));
        await tick(1000);
        act(() => runUndoable(b.run));
        await tick(WINDOW + 100);
        expect(a.commit).toHaveBeenCalledTimes(1);
        expect(b.commit).toHaveBeenCalledTimes(1);
    });

    it("a commit that fails restores the item, unhides it and shows an error", async () => {
        const failing = vi.fn(() => Promise.reject(new Error("boom")));
        const { run, onRestore, onCommitted } = make({ key: "a", commit: failing });
        const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        mount();
        act(() => runUndoable(run));
        await tick(WINDOW + 100);
        expect(failing).toHaveBeenCalledTimes(1);
        expect(onRestore).toHaveBeenCalledTimes(1);
        expect(onCommitted).not.toHaveBeenCalled();
        expect(hiddenText()).toBe("");
        expect(screen.getByText("a failed")).toBeTruthy();
        spy.mockRestore();
    });

    it("the page going away commits through onExit (not commit), once, however many events fire", async () => {
        const onExit = vi.fn();
        const { run, commit } = make({ key: "a", onExit });
        mount();
        act(() => runUndoable(run));
        window.dispatchEvent(new Event("pagehide"));
        window.dispatchEvent(new Event("beforeunload"));
        await tick(WINDOW * 2);
        expect(onExit).toHaveBeenCalledTimes(1);
        expect(commit).not.toHaveBeenCalled();
    });

    it("without onExit the page going away runs commit", async () => {
        const { run, commit } = make({ key: "a" });
        mount();
        act(() => runUndoable(run));
        window.dispatchEvent(new Event("pagehide"));
        await tick(WINDOW * 2);
        expect(commit).toHaveBeenCalledTimes(1);
    });

    it("the same key twice (a double click) is one delete; a deleted key cannot run again", async () => {
        const a = make({ key: "a" });
        const again = make({ key: "a" });
        mount();
        act(() => runUndoable(a.run));
        act(() => runUndoable(again.run));
        await tick(WINDOW + 100);
        act(() => runUndoable(again.run));
        await tick(WINDOW + 100);
        expect(a.commit).toHaveBeenCalledTimes(1);
        expect(again.commit).not.toHaveBeenCalled();
    });

    it("flushUndoables commits what is pending", async () => {
        const { run, commit } = make({ key: "a" });
        mount();
        act(() => runUndoable(run));
        act(() => flushUndoables("navigate"));
        await tick(0);
        expect(commit).toHaveBeenCalledTimes(1);
    });

    it("Ctrl+Z undoes the pending delete when no text field has focus", async () => {
        const { run, commit, onRestore } = make({ key: "a" });
        mount(<input aria-label="field" />);
        act(() => runUndoable(run));
        fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
        await tick(WINDOW * 2);
        expect(commit).not.toHaveBeenCalled();
        expect(onRestore).toHaveBeenCalledTimes(1);
        expect(hiddenText()).toBe("");
    });

    it("Ctrl+Z inside a text field is the field's own undo and leaves the delete pending", async () => {
        const { run, commit, onRestore } = make({ key: "a" });
        mount(<input aria-label="field" />);
        act(() => runUndoable(run));
        fireEvent.keyDown(screen.getByLabelText("field"), { key: "z", ctrlKey: true });
        expect(onRestore).not.toHaveBeenCalled();
        await tick(WINDOW + 100);
        expect(commit).toHaveBeenCalledTimes(1);
    });
});

describe("toast onClose (what the deferred delete hangs on)", () => {
    it("reports why a toast left: timeout, dismiss, action, replaced, evicted; once each", () => {
        const seen: string[] = [];
        mount();
        act(() => void toast.show("t", { id: "t", duration: 1000, onClose: (r) => seen.push(r) }));
        act(() => void vi.advanceTimersByTime(1100));
        act(() => void toast.show("d", { id: "d", onClose: (r) => seen.push(r) }));
        act(() => toast.dismiss("d"));
        act(() => void toast.undoable("u", () => {}, { onClose: (r) => seen.push(r) }));
        fireEvent.click(screen.getByRole("button", { name: UNDO }));
        act(() => void toast.show("r1", { id: "r", onClose: (r) => seen.push(r) }));
        act(() => void toast.show("r2", { id: "r" }));
        // Fill the stack with toasts that all have an action, so the oldest one is evicted.
        act(() => {
            toast.undoable("first", () => {}, { onClose: (r) => seen.push(`first:${r}`) });
            for (let i = 0; i < MAX_VISIBLE; i++) toast.undoable(`n${i}`, () => {});
        });
        expect(seen).toEqual(["timeout", "dismiss", "action", "replaced", "first:evicted"]);
    });
});
