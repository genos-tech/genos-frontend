import { describe, expect, it } from "vitest";

import {
    MAX_CACHED_PROJECTS,
    NO_ROWS,
    ProjectRowsCache,
    projectRowsKey,
    rowsOfProject,
} from "../features/tasks/utils/projectRowsCache";
import { TaskTableProps } from "../types/tasks";

const row = (id: number, projectId: number | null) =>
    ({ id: String(id), projectId }) as unknown as TaskTableProps;

describe("ProjectRowsCache", () => {
    it("keeps four entries by default: with the open project that is five in memory", () => {
        const cache = new ProjectRowsCache();
        expect(MAX_CACHED_PROJECTS).toBe(5);
        for (let p = 1; p <= 5; p++) cache.put(projectRowsKey("s", p), [row(p, p)]);

        expect(cache.size).toBe(4);
        expect(cache.take(projectRowsKey("s", 1))).toBeUndefined();
        expect(cache.take(projectRowsKey("s", 2))).toBeDefined();
    });

    it("take removes the entry: the rows are the open project's now", () => {
        const cache = new ProjectRowsCache();
        const rows = [row(1, 1)];
        cache.put("a", rows);

        expect(cache.take("a")).toBe(rows);
        expect(cache.take("a")).toBeUndefined();
        expect(cache.size).toBe(0);
    });

    it("evicts the least recently stored entry first", () => {
        const cache = new ProjectRowsCache(3);
        cache.put("a", [row(1, 1)]);
        cache.put("b", [row(2, 2)]);
        cache.put("c", [row(3, 3)]);
        cache.take("a");
        cache.put("a", [row(1, 1)]);
        cache.put("d", [row(4, 4)]);

        expect(cache.keys()).toEqual(["c", "a", "d"]);
        expect(cache.take("b")).toBeUndefined();
    });

    it("a put replaces the entry and makes it the most recently used", () => {
        const cache = new ProjectRowsCache(3);
        cache.put("a", [row(1, 1)]);
        cache.put("b", [row(2, 2)]);
        const fresh = [row(9, 1)];
        cache.put("a", fresh);

        expect(cache.keys()).toEqual(["b", "a"]);
        expect(cache.take("a")).toBe(fresh);
    });

    it("drops one project in every scope, and keeps the others", () => {
        const cache = new ProjectRowsCache();
        cache.put(projectRowsKey("t1|t1", 10), [row(1, 10)]);
        cache.put(projectRowsKey("t2|t2", 10), [row(1, 10)]);
        cache.put(projectRowsKey("t1|t1", 1), [row(2, 1)]);
        cache.put(projectRowsKey("t1|t1", 100), [row(3, 100)]);

        cache.deleteProject(10);

        // 10 is gone in both scopes; 100 (which ends in "00" too) and 1 are not touched.
        expect(cache.keys()).toEqual([projectRowsKey("t1|t1", 1), projectRowsKey("t1|t1", 100)]);
    });

    it("retains only the projects it is told to", () => {
        const cache = new ProjectRowsCache();
        for (const p of [1, 2, 3]) cache.put(projectRowsKey("s", p), [row(p, p)]);

        cache.retainProjects([1, 3]);
        expect(cache.keys()).toEqual([projectRowsKey("s", 1), projectRowsKey("s", 3)]);

        cache.retainProjects([]);
        expect(cache.size).toBe(0);
    });

    it("clear empties it", () => {
        const cache = new ProjectRowsCache();
        cache.put("a", [row(1, 1)]);
        cache.clear();
        expect(cache.size).toBe(0);
    });
});

describe("rowsOfProject", () => {
    it("returns the same array when every row belongs to the project", () => {
        const rows = [row(1, 7), row(2, 7)];
        expect(rowsOfProject(rows, 7)).toBe(rows);
    });

    it("drops a row of another project and keeps a row with no project", () => {
        const kept = rowsOfProject([row(1, 7), row(2, 8), row(3, null)], 7);
        expect(kept.map((r) => r.id)).toEqual(["1", "3"]);
    });

    it("compares ids as strings", () => {
        const rows = [{ id: "1", projectId: "7" } as unknown as TaskTableProps];
        expect(rowsOfProject(rows, 7)).toBe(rows);
    });

    it("NO_ROWS is one shared empty array", () => {
        expect(NO_ROWS).toEqual([]);
    });
});
