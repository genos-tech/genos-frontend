/**
 * MIP-2000: the `loadProjectTasks` wrapper (what each caller asks for, and one request per
 * project at a time), the skeleton gate, and the store the answers feed.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MilestoneSwitchGate } from "../features/tasks/components/table/MilestoneSwitchGate";
import { loadProjectTasks } from "../features/tasks/services/loadProjectTasks";
import { primeProjectScopeFromStore } from "../features/tasks/services/primeProjectScope";
import {
    beginScopeWidening,
    endScopeWidening,
    getProjectScope,
    recordProjectScope,
    resetProjectScopes,
} from "../features/tasks/state/projectStatusScopeStore";
import { STATUS_SCOPE_OFF_KEY } from "../features/tasks/utils/projectStatusScope";
import type { UserProps } from "../types/admin";

const request = vi.fn();
vi.mock("../db/workers/channels", () => ({
    tasksChannel: { request: (...args: unknown[]) => request(...args) },
}));

const me = { userId: "u", teamId: "t" } as UserProps;
const ACTIVE = ["Open", "WIP", "Blocked", "Pending"];

/** A worker that answers each request when told to, with the statuses it was asked for. */
const controlledWorker = () => {
    const pending: Array<() => void> = [];
    request.mockImplementation(
        (_name: string, payload: { statuses: string[] | null }) =>
            new Promise((resolve) => {
                pending.push(() =>
                    resolve({
                        statuses: payload.statuses,
                        statusCounts: payload.statuses ? { Closed: 780 } : null,
                    })
                );
            })
    );
    return { answerNext: () => pending.shift()?.() };
};

beforeEach(() => {
    request.mockReset();
    localStorage.clear();
    resetProjectScopes();
});

describe("loadProjectTasks", () => {
    it("asks for the ongoing statuses when the caller says nothing", async () => {
        request.mockResolvedValue({ statuses: ACTIVE, statusCounts: { Closed: 780 } });
        await loadProjectTasks(me, 1, "tok");
        expect(request).toHaveBeenCalledWith(
            "loadProjectTasks",
            expect.objectContaining({ projectId: 1, statuses: ACTIVE })
        );
    });

    it("asks for what the table's stored filter shows, so a boot on Closed is one load", async () => {
        localStorage.setItem("taskFilters:table:2", JSON.stringify({ status: ["All"] }));
        request.mockResolvedValue({ statuses: null, statusCounts: null });
        await loadProjectTasks(me, 2, "tok");
        expect(request.mock.calls[0][1].statuses).toBeNull();
    });

    it("asks for every status when the caller does, and when the kill switch is off", async () => {
        request.mockResolvedValue({ statuses: null, statusCounts: null });
        await loadProjectTasks(me, 3, "tok", null);
        expect(request.mock.calls[0][1].statuses).toBeNull();

        localStorage.setItem(STATUS_SCOPE_OFF_KEY, "off");
        await loadProjectTasks(me, 4, "tok");
        expect(request.mock.calls[1][1].statuses).toBeNull();
    });

    it("tells the store what the worker now holds, and the server's counts", async () => {
        request.mockResolvedValue({ statuses: ACTIVE, statusCounts: { Closed: 780 } });
        await loadProjectTasks(me, 5, "tok");
        expect(getProjectScope(5).loaded).toEqual(ACTIVE);
        expect(getProjectScope(5).counts?.Closed).toBe(780);
    });

    it("callers whose statuses a running request covers share it", async () => {
        const worker = controlledWorker();
        const a = loadProjectTasks(me, 6, "tok");
        const b = loadProjectTasks(me, 6, "tok", ["Open"]);
        worker.answerNext();
        await Promise.all([a, b]);
        expect(request).toHaveBeenCalledTimes(1);
    });

    it("a caller that needs more waits for the running request, then loads once for it", async () => {
        const worker = controlledWorker();
        const first = loadProjectTasks(me, 7, "tok"); // ongoing statuses
        const second = loadProjectTasks(me, 7, "tok", null); // all of them
        const third = loadProjectTasks(me, 7, "tok", null); // joins the second
        // Only the first request is out: two loads of one project never run side by side.
        expect(request).toHaveBeenCalledTimes(1);
        worker.answerNext();
        await first;
        await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
        expect(request.mock.calls[1][1].statuses).toBeNull();
        worker.answerNext();
        await Promise.all([second, third]);
        expect(request).toHaveBeenCalledTimes(2);
        expect(getProjectScope(7).loaded).toBeNull();
    });

    it("does not run a second request when the first already left the store holding enough", async () => {
        const worker = controlledWorker();
        // The worker holds every status already (an earlier session loaded Closed): the
        // first answer says so, whatever it was asked for.
        request.mockImplementation(
            () =>
                new Promise((resolve) => {
                    worker.answerNext = () => resolve({ statuses: null, statusCounts: null });
                })
        );
        const first = loadProjectTasks(me, 8, "tok");
        const second = loadProjectTasks(me, 8, "tok", null);
        worker.answerNext();
        await Promise.all([first, second]);
        expect(request).toHaveBeenCalledTimes(1);
    });

    it("a plain refresh after a FAILED widening asks for the statuses the view wanted (the banner's Retry)", async () => {
        beginScopeWidening(10, null); // Closed turned on ...
        endScopeWidening(10); // ... and the fetch failed
        request.mockResolvedValue({ statuses: null, statusCounts: null });
        await loadProjectTasks(me, 10, "tok");
        expect(request.mock.calls[0][1].statuses).toBeNull();
    });

    it("does nothing without a token", async () => {
        await loadProjectTasks(me, 9, null);
        expect(request).not.toHaveBeenCalled();
    });
});

describe("MilestoneSwitchGate while a status is being fetched", () => {
    it("hides the rows behind the skeleton but keeps them mounted", () => {
        const { rerender } = render(
            <MilestoneSwitchGate skeleton={<div>loading skeleton</div>}>
                <div>the rows</div>
            </MilestoneSwitchGate>
        );
        expect(screen.queryByText("loading skeleton")).toBeNull();
        const rows = screen.getByText("the rows");
        rerender(
            <MilestoneSwitchGate skeleton={<div>loading skeleton</div>} forcePending>
                <div>the rows</div>
            </MilestoneSwitchGate>
        );
        expect(screen.getByText("loading skeleton")).toBeTruthy();
        // Same node, hidden: React did not render the rows again.
        expect(screen.getByText("the rows")).toBe(rows);
        expect(rows.parentElement?.style.display).toBe("none");
    });
});

describe("primeProjectScopeFromStore", () => {
    it("tells the store what the stored rows hold before any load has answered", async () => {
        request.mockResolvedValue({ known: true, statuses: ACTIVE });
        await primeProjectScopeFromStore(20);
        expect(getProjectScope(20).loaded).toEqual(ACTIVE);
    });

    it("leaves an unknown project unknown, and never overrides a load's answer", async () => {
        request.mockResolvedValue({ known: false, statuses: null });
        await primeProjectScopeFromStore(21);
        expect(getProjectScope(21).loaded).toBeUndefined();

        recordProjectScope(22, { statuses: null, statusCounts: null });
        request.mockResolvedValue({ known: true, statuses: ACTIVE });
        await primeProjectScopeFromStore(22);
        expect(getProjectScope(22).loaded).toBeNull();
    });

    it("a failed read blocks nothing", async () => {
        request.mockRejectedValue(new Error("no worker"));
        await expect(primeProjectScopeFromStore(23)).resolves.toBeUndefined();
        expect(getProjectScope(23).loaded).toBeUndefined();
    });
});

describe("the skeleton stays up until the rows are read", () => {
    it("a load answering does not end a widening; its own end does", () => {
        beginScopeWidening(30, null);
        recordProjectScope(30, { statuses: null, statusCounts: null });
        expect(getProjectScope(30).pending).toBeNull();
        endScopeWidening(30);
        expect(getProjectScope(30).pending).toBeUndefined();
    });
});
