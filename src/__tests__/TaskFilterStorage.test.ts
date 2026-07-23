import { beforeEach, describe, expect, it } from "vitest";

import { FilterProps } from "../features/tasks/types/TaskTableTypes";
import {
    clearStoredFilters,
    readStoredFilters,
    rehydrateFilters,
    rehydrateKeys,
    taskFilterStorageKey,
    writeStoredFilters,
} from "../features/tasks/utils/taskFilterStorage";

const f = (label: string): FilterProps => ({
    label,
    filterModel: { items: [] },
    lightModeColor: "#000",
    darkModeColor: "#fff",
});

const ALL = f("All");
const OPEN = f("Open");
const WIP = f("WIP");
const AVAILABLE = [ALL, OPEN, WIP];

describe("taskFilterStorageKey", () => {
    // The board hides the status filter and pins it to "All", so it must
    // not inherit the table's stored status selection.
    it("keeps the table and the board apart", () => {
        expect(taskFilterStorageKey("table", 1)).not.toBe(taskFilterStorageKey("board", 1));
    });

    // Filters are per-project: tags and milestones only exist within one
    // project, so project A's selection must not follow you into B.
    it("keeps projects apart", () => {
        expect(taskFilterStorageKey("table", 1)).not.toBe(taskFilterStorageKey("table", 2));
    });

    it("is stable for the same surface + project", () => {
        expect(taskFilterStorageKey("table", 7)).toBe(taskFilterStorageKey("table", "7"));
    });

    // No project resolved yet — persistence is off rather than writing
    // under a placeholder key that a real project would later inherit.
    it("disables persistence when no project is resolved", () => {
        expect(taskFilterStorageKey("table", null)).toBeUndefined();
        expect(taskFilterStorageKey("table", undefined)).toBeUndefined();
        expect(taskFilterStorageKey("table", "")).toBeUndefined();
    });
});

describe("readStoredFilters / writeStoredFilters", () => {
    const KEY = taskFilterStorageKey("table", 1) as string;
    beforeEach(() => localStorage.clear());

    it("round-trips a selection", () => {
        writeStoredFilters(KEY, {
            effortLevels: ["All"],
            memberKeys: ["__all__"],
            milestoneKeys: ["all"],
            priorities: ["High"],
            status: ["Open", "WIP"],
            tags: ["backend"],
        });
        expect(readStoredFilters(KEY)?.status).toEqual(["Open", "WIP"]);
        expect(readStoredFilters(KEY)?.tags).toEqual(["backend"]);
    });

    it("returns null when nothing is stored", () => {
        expect(readStoredFilters(KEY)).toBeNull();
    });

    it("survives a corrupted value instead of throwing", () => {
        localStorage.setItem(KEY, "not json{{");
        expect(readStoredFilters(KEY)).toBeNull();
    });

    it("keeps the well-formed fields of a half-corrupt blob", () => {
        localStorage.setItem(KEY, JSON.stringify({ status: ["Open"], tags: "not-an-array" }));
        const read = readStoredFilters(KEY);
        expect(read?.status).toEqual(["Open"]);
        expect(read?.tags).toBeUndefined();
    });

    it("clears", () => {
        writeStoredFilters(KEY, {
            effortLevels: [],
            memberKeys: [],
            milestoneKeys: [],
            priorities: [],
            status: ["Open"],
            tags: [],
        });
        clearStoredFilters(KEY);
        expect(readStoredFilters(KEY)).toBeNull();
    });
});

describe("rehydrateFilters", () => {
    it("resolves stored labels back to the live filter objects", () => {
        const result = rehydrateFilters(["Open", "WIP"], AVAILABLE, [ALL]);
        // Identity matters: the restored entries must be the LIVE objects,
        // since their `filterModel` is what actually drives the pipeline.
        expect(result[0]).toBe(OPEN);
        expect(result[1]).toBe(WIP);
    });

    it("drops a label that no longer exists, keeping the rest", () => {
        const result = rehydrateFilters(["Open", "deleted-tag"], AVAILABLE, [ALL]);
        expect(result).toEqual([OPEN]);
    });

    it("falls back when NOTHING survives, so the bar is never left empty", () => {
        // A tag filter stored against a different project: none of its
        // labels exist here.
        expect(rehydrateFilters(["gone-a", "gone-b"], AVAILABLE, [ALL])).toEqual([ALL]);
    });

    it("falls back when nothing was stored", () => {
        expect(rehydrateFilters(undefined, AVAILABLE, [ALL])).toEqual([ALL]);
        expect(rehydrateFilters([], AVAILABLE, [ALL])).toEqual([ALL]);
    });
});

describe("rehydrateKeys", () => {
    it("passes the sentinels through untouched", () => {
        expect(rehydrateKeys(["all"])).toEqual(["all"]);
        expect(rehydrateKeys(["none"])).toEqual(["none"]);
        expect(rehydrateKeys(["__all__"])).toEqual(["__all__"]);
        expect(rehydrateKeys(["__none__"])).toEqual(["__none__"]);
    });

    it("coerces a digit string back to a numeric milestone id", () => {
        // The menu compares milestone keys with `typeof k === "number"`,
        // so a JSON round-trip that left it a string would silently stop
        // matching.
        expect(rehydrateKeys(["42"])).toEqual([42]);
        expect(rehydrateKeys([42])).toEqual([42]);
    });

    it("does NOT coerce a userId that happens to be non-numeric", () => {
        expect(rehydrateKeys(["user-abc"])).toEqual(["user-abc"]);
    });

    it("returns null for nothing stored, so the caller keeps its default", () => {
        expect(rehydrateKeys(undefined)).toBeNull();
        expect(rehydrateKeys([])).toBeNull();
    });
});
