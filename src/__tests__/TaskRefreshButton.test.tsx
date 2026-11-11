/**
 * MIP-1411. The Refresh Tasks button used to do its work and say nothing: no sign it was working,
 * finished, or ignored. It now works like the Inbox's Sync button: a spinner in the same button
 * (busy, not disabled), the answer as one toast with one id. It stays busy until the rows are
 * back AND the PR column (re-synced by the same click, MIP-1409) has answered.
 *
 * The real toast host and the real re-sync signal; the PR cells are simulated by whatever
 * subscribes to the signal and registers work, as `PrStatusCell` does.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts } from "../components/ui/feedback/toastStore";
import {
    _resetPrResyncForTests,
    beginPrResyncWork,
    getPrResyncRequest,
    PR_RESYNC_MANUAL_COOLDOWN_MS,
    PR_RESYNC_WORK_TIMEOUT_MS,
    subscribePrResync,
} from "../features/integrations/services/prResync";
import { TaskRefreshButton } from "../features/tasks/components/header/TaskRefreshButton";

const mount = (onRefresh: () => Promise<void>) =>
    render(
        <CssVarsProvider>
            <TaskRefreshButton onRefresh={onRefresh} />
            <ToastHost />
        </CssVarsProvider>
    );

const button = () => screen.getByRole("button", { name: "Refresh Tasks" });
const busy = () => button().getAttribute("aria-busy");

/** A deferred rows reload. */
const reload = () => {
    let done: () => void = () => {};
    let fail: (e: unknown) => void = () => {};
    const promise = new Promise<void>((resolve, reject) => {
        done = resolve;
        fail = reject;
    });
    return { promise, done, fail, onRefresh: vi.fn(() => promise) };
};

/** PR cells on screen: each click gets `n` pieces of work, finished by the test. */
let finishers: Array<(ok: boolean) => void> = [];
let unsubscribe = () => {};
const cells = (n: number) => {
    unsubscribe();
    unsubscribe = subscribePrResync(() => {
        const id = getPrResyncRequest().id;
        for (let i = 0; i < n; i++) finishers.push(beginPrResyncWork(id));
    });
};

const toastText = () => document.body.textContent ?? "";

beforeEach(() => {
    __resetToasts();
    _resetPrResyncForTests();
    finishers = [];
    unsubscribe = () => {};
});

afterEach(() => {
    unsubscribe();
    _resetPrResyncForTests();
    vi.useRealTimers();
});

describe("TaskRefreshButton", () => {
    it("is a labelled icon button", () => {
        mount(async () => {});
        expect(button().textContent).toBe("");
        expect(busy()).toBe("false");
    });

    it("spins while the rows reload, stays focusable, and says 'up to date' when done", async () => {
        const r = reload();
        mount(r.onRefresh);
        await userEvent.setup().click(button());

        await waitFor(() => expect(busy()).toBe("true"));
        expect((button() as HTMLButtonElement).disabled).toBe(false);
        expect(toastText()).not.toContain("up to date");

        await act(async () => r.done());
        await waitFor(() => expect(busy()).toBe("false"));
        expect(toastText()).toContain("Tasks are up to date");
        expect(r.onRefresh).toHaveBeenCalledTimes(1);
    });

    it("a second press while it works does not start the work again", async () => {
        const r = reload();
        mount(r.onRefresh);
        const user = userEvent.setup();
        await user.click(button());
        await user.click(button());
        await user.click(button());
        expect(r.onRefresh).toHaveBeenCalledTimes(1);
        await act(async () => r.done());
        await waitFor(() => expect(busy()).toBe("false"));
    });

    it("stays busy after the rows are back, until the PR column has answered", async () => {
        cells(2);
        const r = reload();
        mount(r.onRefresh);
        await userEvent.setup().click(button());
        await waitFor(() => expect(finishers).toHaveLength(2));

        await act(async () => r.done());
        // The rows are in; the PR column is still asking GitHub.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
        });
        expect(busy()).toBe("true");
        expect(toastText()).not.toContain("up to date");

        await act(async () => finishers[0](true));
        expect(busy()).toBe("true");
        await act(async () => finishers[1](true));
        await waitFor(() => expect(busy()).toBe("false"));
        expect(toastText()).toContain("Tasks are up to date");
    });

    it("says so when some PR statuses could not be updated (the rows are fine)", async () => {
        cells(2);
        const r = reload();
        mount(r.onRefresh);
        await userEvent.setup().click(button());
        await waitFor(() => expect(finishers).toHaveLength(2));
        await act(async () => {
            r.done();
            finishers[0](true);
            finishers[1](false);
        });

        await waitFor(() => expect(busy()).toBe("false"));
        expect(toastText()).toContain(
            "Tasks refreshed, but some PR statuses couldn't be updated."
        );
        expect(toastText()).not.toContain("Tasks are up to date");
    });

    it("says so when the rows could not be reloaded, and is not stuck busy", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const r = reload();
        mount(r.onRefresh);
        await userEvent.setup().click(button());
        await act(async () => r.fail(new Error("network")));

        await waitFor(() => expect(busy()).toBe("false"));
        expect(toastText()).toContain("Couldn't refresh the tasks. Try again.");
        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });

    it("a failed reload is told even when the PR column also failed (the rows come first)", async () => {
        cells(1);
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const r = reload();
        mount(r.onRefresh);
        await userEvent.setup().click(button());
        await waitFor(() => expect(finishers).toHaveLength(1));
        await act(async () => {
            r.fail(new Error("network"));
            finishers[0](false);
        });
        await waitFor(() => expect(busy()).toBe("false"));
        expect(toastText()).toContain("Couldn't refresh the tasks. Try again.");
        expect(toastText()).not.toContain("PR statuses");
        consoleError.mockRestore();
    });

    it("with no PR column on screen it is just the rows", async () => {
        const r = reload();
        mount(r.onRefresh);
        await userEvent.setup().click(button());
        await act(async () => r.done());
        await waitFor(() => expect(busy()).toBe("false"));
        expect(toastText()).toContain("Tasks are up to date");
    });

    it("pressing again replaces the answer instead of stacking another", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const onRefresh = vi.fn(async () => {});
        mount(onRefresh);
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        await user.click(button());
        await waitFor(() => expect(busy()).toBe("false"));
        vi.advanceTimersByTime(PR_RESYNC_MANUAL_COOLDOWN_MS);
        await user.click(button());
        await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(busy()).toBe("false"));

        expect((toastText().match(/Tasks are up to date/g) ?? []).length).toBe(1);
    });

    it("a press within the cooldown still reloads the rows, and does not ask the PR column again", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        cells(1);
        const onRefresh = vi.fn(async () => {});
        mount(onRefresh);
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        await user.click(button());
        await waitFor(() => expect(finishers).toHaveLength(1));
        await act(async () => finishers[0](true));
        await waitFor(() => expect(busy()).toBe("false"));

        await user.click(button()); // 0 ms later: the PR column is not asked again
        await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(busy()).toBe("false"));
        expect(finishers).toHaveLength(1);
        expect(toastText()).toContain("Tasks are up to date");
    });

    it("does not spin forever when a PR request never answers: it gives up and says so", async () => {
        vi.useFakeTimers();
        cells(1);
        mount(vi.fn(async () => {}));
        fireEvent.click(button());
        await act(async () => {
            await vi.advanceTimersByTimeAsync(PR_RESYNC_WORK_TIMEOUT_MS - 1);
        });
        expect(busy()).toBe("true");

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2);
        });
        expect(busy()).toBe("false");
        expect(toastText()).toContain("PR statuses couldn't be updated");
    });
});
