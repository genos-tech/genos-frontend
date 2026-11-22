/**
 * Which statuses a project's rows are loaded for (MIP-2000): the pure rules, the main-thread
 * store, and `ensureProjectStatuses` (a status already held is never fetched again).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureProjectStatuses } from "../features/tasks/services/ensureProjectStatuses";
import {
    getProjectScope,
    isWidening,
    recordProjectScope,
    resetProjectScopes,
} from "../features/tasks/state/projectStatusScopeStore";
import { taskTypes } from "../features/tasks/types/TaskTableTypes";
import { withServerClosedCount } from "../features/tasks/utils/milestoneTaskProgress";
import {
    ACTIVE_STATUSES,
    initialStatusNeed,
    scopeCovers,
    STATUS_SCOPE_OFF_KEY,
    statusesNeeded,
    taskStatusScopeEnabled,
    unionScope,
} from "../features/tasks/utils/projectStatusScope";

beforeEach(() => {
    localStorage.clear();
    resetProjectScopes();
});

describe("statusesNeeded", () => {
    it("is exactly the selected ongoing statuses", () => {
        expect(statusesNeeded({ labels: ["Open", "WIP", "Blocked", "Pending"] })).toEqual([
            "Open",
            "WIP",
            "Blocked",
            "Pending",
        ]);
        expect(statusesNeeded({ labels: ["WIP", "Open"] })).toEqual(["Open", "WIP"]);
    });

    it("is every status for All, for nothing selected and for a past milestone's history", () => {
        expect(statusesNeeded({ labels: ["All"] })).toBeNull();
        expect(statusesNeeded({ labels: [] })).toBeNull();
        expect(statusesNeeded({ labels: ["Open"], showsFullHistory: true })).toBeNull();
    });

    it("is every status when Closed or Deleted is selected (closed-by-ancestor pulls in any status)", () => {
        expect(statusesNeeded({ labels: ["Open", "Closed"] })).toBeNull();
        expect(statusesNeeded({ labels: ["Closed"] })).toBeNull();
        expect(statusesNeeded({ labels: ["Deleted"] })).toBeNull();
    });

    it("treats Expired alone as every status, and Expired next to others as those others", () => {
        expect(statusesNeeded({ labels: ["Expired"] })).toBeNull();
        expect(statusesNeeded({ labels: ["Open", "Expired"] })).toEqual(["Open"]);
        expect(statusesNeeded({ labels: ["Closed", "Expired"] })).toBeNull();
    });

    it("never guesses at a label the server does not know", () => {
        expect(statusesNeeded({ labels: ["Open", "Archived"] })).toBeNull();
    });

    it("keeps the ongoing set in step with the table's own definition", () => {
        expect([...ACTIVE_STATUSES]).toEqual(taskTypes.ongoing.statuses);
    });
});

describe("scopeCovers / unionScope", () => {
    it("All covers everything, a list covers its own members only", () => {
        expect(scopeCovers(null, ["Closed"])).toBe(true);
        expect(scopeCovers(null, null)).toBe(true);
        expect(scopeCovers(["Open", "WIP"], ["Open"])).toBe(true);
        expect(scopeCovers(["Open", "WIP"], ["Closed"])).toBe(false);
        expect(scopeCovers(["Open", "WIP"], null)).toBe(false);
        expect(scopeCovers(undefined, ["Open"])).toBe(false);
    });

    it("a union with All is All; otherwise the merged list in the server's order", () => {
        expect(unionScope(["Open"], null)).toBeNull();
        expect(unionScope(null, ["Open"])).toBeNull();
        expect(unionScope(["WIP"], ["Open", "WIP"])).toEqual(["Open", "WIP"]);
    });
});

describe("initialStatusNeed", () => {
    it("is the ongoing statuses when nothing is stored", () => {
        expect(initialStatusNeed(7)).toEqual([...ACTIVE_STATUSES]);
    });

    it("follows the table's stored filter, so a user who left it on Closed pays for one load", () => {
        localStorage.setItem(
            "taskFilters:table:7",
            JSON.stringify({ status: ["Open", "Closed"] })
        );
        expect(initialStatusNeed(7)).toBeNull();
        localStorage.setItem("taskFilters:table:8", JSON.stringify({ status: ["WIP"] }));
        expect(initialStatusNeed(8)).toEqual(["WIP"]);
    });

    it("ignores a stored value it cannot read", () => {
        localStorage.setItem("taskFilters:table:7", "{not json");
        expect(initialStatusNeed(7)).toEqual([...ACTIVE_STATUSES]);
    });

    it("asks for everything while the kill switch is off", () => {
        localStorage.setItem(STATUS_SCOPE_OFF_KEY, "off");
        expect(taskStatusScopeEnabled()).toBe(false);
        expect(initialStatusNeed(7)).toBeNull();
    });
});

describe("withServerClosedCount (milestone chips while Closed rows are not loaded)", () => {
    const counted = {
        entries: [
            { status: "Open" as const, count: 2 },
            { status: "WIP" as const, count: 1 },
        ],
        total: 3,
    };

    it("adds a Closed chip from the server's count and grows the total", () => {
        const out = withServerClosedCount(counted, 40);
        expect(out.entries.map((e) => `${e.status}:${e.count}`)).toEqual([
            "Open:2",
            "WIP:1",
            "Closed:40",
        ]);
        expect(out.total).toBe(43);
    });

    it("keeps the loaded count when it is not lower, and when the server gave none", () => {
        expect(withServerClosedCount(counted, 0)).toBe(counted);
        expect(withServerClosedCount(counted, undefined)).toBe(counted);
        const withClosed = { entries: [{ status: "Closed" as const, count: 5 }], total: 5 };
        expect(withServerClosedCount(withClosed, 3)).toBe(withClosed);
        expect(withServerClosedCount(withClosed, 9).total).toBe(9);
    });
});

describe("the project scope store", () => {
    it("is unknown until a load answers, then follows the answer and keeps the counts", () => {
        expect(getProjectScope(1).loaded).toBeUndefined();
        recordProjectScope(1, {
            statuses: ["Open", "WIP"],
            statusCounts: { Open: 3, WIP: 2, Closed: 780 },
        });
        expect(getProjectScope(1).loaded).toEqual(["Open", "WIP"]);
        expect(getProjectScope(1).counts?.Closed).toBe(780);
        // An all-status answer carries no counts: the last ones stay.
        recordProjectScope(1, { statuses: null, statusCounts: null });
        expect(getProjectScope(1).loaded).toBeNull();
        expect(getProjectScope(1).counts?.Closed).toBe(780);
    });

    it("is per project", () => {
        recordProjectScope(1, { statuses: ["Open"], statusCounts: null });
        expect(getProjectScope(2).loaded).toBeUndefined();
    });
});

describe("ensureProjectStatuses", () => {
    it("fetches nothing before the first load has answered", async () => {
        const fetchMore = vi.fn(async () => {});
        await ensureProjectStatuses(1, null, fetchMore);
        expect(fetchMore).not.toHaveBeenCalled();
    });

    it("turning Closed on fetches once; off, and on again, fetch nothing", async () => {
        recordProjectScope(1, {
            statuses: ["Open", "WIP", "Blocked", "Pending"],
            statusCounts: null,
        });
        // The fetch lands and the worker reports what it now holds.
        const fetchMore = vi.fn(async () => {
            recordProjectScope(1, { statuses: null, statusCounts: null });
        });
        await ensureProjectStatuses(1, null, fetchMore); // Closed on
        await ensureProjectStatuses(1, ["Open", "WIP", "Blocked", "Pending"], fetchMore); // off
        await ensureProjectStatuses(1, null, fetchMore); // on again
        expect(fetchMore).toHaveBeenCalledTimes(1);
    });

    it("two views asking for the same thing at once fetch once", async () => {
        recordProjectScope(1, { statuses: ["Open"], statusCounts: null });
        let land: () => void = () => {};
        const fetchMore = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    land = () => {
                        recordProjectScope(1, { statuses: null, statusCounts: null });
                        resolve();
                    };
                })
        );
        const first = ensureProjectStatuses(1, null, fetchMore);
        const second = ensureProjectStatuses(1, null, fetchMore);
        expect(isWidening(getProjectScope(1))).toBe(true);
        land();
        await Promise.all([first, second]);
        expect(fetchMore).toHaveBeenCalledTimes(1);
        expect(isWidening(getProjectScope(1))).toBe(false);
    });

    it("never leaves the skeleton up when the fetch fails", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        recordProjectScope(1, { statuses: ["Open"], statusCounts: null });
        await ensureProjectStatuses(1, null, async () => {
            throw new Error("offline");
        });
        expect(isWidening(getProjectScope(1))).toBe(false);
        expect(getProjectScope(1).loaded).toEqual(["Open"]);
        error.mockRestore();
        // A later attempt tries again.
        const fetchMore = vi.fn(async () => {});
        await ensureProjectStatuses(1, null, fetchMore);
        expect(fetchMore).toHaveBeenCalledTimes(1);
    });
});
