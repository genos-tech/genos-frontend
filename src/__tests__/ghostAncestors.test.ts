/**
 * `deriveGhostAncestors` — the Member filter's tree-repair for the task table.
 *
 * `matches` are the rows assigned to the filtered member. When a matching
 * subtask's parent isn't a match, the parent (and its parents) must still be
 * rendered — dimmed — so the dependency chain is legible. These tests pin the
 * four shapes that matter: a full ghost chain, a ghost-only intermediate, a
 * match nested under a match (no ghosts), and a parent missing from the tree.
 */

import { describe, expect, it } from "vitest";

import { deriveGhostAncestors } from "../features/tasks/utils/ghostAncestors";
import type { TaskTableProps } from "../types/tasks";

const task = (id: string, parentTaskId: string | null): TaskTableProps =>
    ({ id, parentTaskId }) as unknown as TaskTableProps;

// r (root) → a → b → c
const ALL = [task("r", null), task("a", "r"), task("b", "a"), task("c", "b")];
const ids = (rows: TaskTableProps[]) => rows.map((r) => String(r.id)).sort();

describe("deriveGhostAncestors", () => {
    it("returns nothing when there are no matches", () => {
        const g = deriveGhostAncestors([], ALL);
        expect(g.ghostIds.size).toBe(0);
        expect(g.ancestorIds.size).toBe(0);
        expect(g.ghostRoots).toEqual([]);
        expect(g.ghostChildren).toEqual([]);
    });

    it("splices the full ancestor chain when only a deep leaf matches", () => {
        // Only `c` is assigned to the member. r → a → b are all ghosts.
        const g = deriveGhostAncestors([task("c", "b")], ALL);
        expect([...g.ghostIds].sort()).toEqual(["a", "b", "r"]);
        expect([...g.ancestorIds].sort()).toEqual(["a", "b", "r"]);
        expect(ids(g.ghostRoots)).toEqual(["r"]);
        expect(ids(g.ghostChildren)).toEqual(["a", "b"]);
    });

    it("treats a matching ancestor as a match, not a ghost", () => {
        // Both `a` (mid) and `c` (leaf) match. `r` and `b` are ghosts; `a` is
        // a match so it must NOT be a ghost, but it IS still force-expanded
        // (it's an ancestor of `c`).
        const g = deriveGhostAncestors([task("a", "r"), task("c", "b")], ALL);
        expect([...g.ghostIds].sort()).toEqual(["b", "r"]);
        expect([...g.ancestorIds].sort()).toEqual(["a", "b", "r"]);
        expect(ids(g.ghostRoots)).toEqual(["r"]);
        expect(ids(g.ghostChildren)).toEqual(["b"]);
    });

    it("produces no ghosts when a match's whole chain also matches", () => {
        const g = deriveGhostAncestors([task("r", null), task("a", "r"), task("b", "a")], ALL);
        expect(g.ghostIds.size).toBe(0);
        // r and a are still ancestors (of a/b), so they force-expand.
        expect([...g.ancestorIds].sort()).toEqual(["a", "r"]);
    });

    it("ends the walk when a parent is absent from the tree", () => {
        // `orphan`'s parent `gone` isn't in allTasks (e.g. cross-project).
        const g = deriveGhostAncestors([task("orphan", "gone")], ALL);
        // `gone` is recorded as an ancestor id but yields no ghost row.
        expect(g.ghostIds.size).toBe(0);
        expect([...g.ancestorIds]).toEqual(["gone"]);
        expect(g.ghostRoots).toEqual([]);
        expect(g.ghostChildren).toEqual([]);
    });

    it("dedupes ancestors shared by two matches", () => {
        // Siblings `a`→`b`(match) and `a`→`d`(match) share ghost ancestors r, a.
        const withSibling = [...ALL, task("d", "a")];
        const g = deriveGhostAncestors([task("b", "a"), task("d", "a")], withSibling);
        expect([...g.ghostIds].sort()).toEqual(["a", "r"]);
        expect(ids(g.ghostChildren)).toEqual(["a"]);
        expect(ids(g.ghostRoots)).toEqual(["r"]);
    });
});
