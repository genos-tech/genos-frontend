/**
 * Tag-filter selection vs. a rebuilt option list.
 *
 * The bug: creating a tag never reached the filter bar's Tags dropdown. Only one
 * effect fetches `currentProject.projectTags` (TaskSidebarMain's, keyed on the
 * active projectId) and creating a tag doesn't change the project, so nothing
 * re-ran it — the new tag appeared only after a page reload.
 *
 * Making it re-run (`useTM.tagsRevision`) exposes the second half: the option
 * list now churns mid-session, under a selection the user already made.
 * `TaskFilterMenu` used to blanket-reset the tag selection to "All" on any new
 * option-list identity, which was invisible while the list loaded once per
 * project but would silently discard an active filter on every tag edit. These
 * tests pin the remap that replaced it — regressing it either eats the user's
 * filter or leaves a deleted tag selected, matching nothing.
 */

import { describe, expect, it } from "vitest";

import { FilterProps } from "../features/tasks/types/TaskTableTypes";
import {
    remapTagSelection,
    sameTagSelection,
    tagSelectionDefault,
} from "../features/tasks/utils/tagFilterSelection";

// Mirrors what DraggableTaskTable / SprintBoard build from `projectTags`: a
// leading "All" entry, then one entry per tag carrying a `concatTags` predicate.
const all: FilterProps = {
    label: "All",
    labelKey: "all",
    filterModel: { items: [] },
    lightModeColor: "#6b7280",
    darkModeColor: "#9ca3af",
};

const tag = (name: string, color = "#111111"): FilterProps => ({
    label: name,
    filterModel: {
        items: [{ field: "concatTags", operator: "contains", value: `/${name}/` }],
    },
    lightModeColor: color,
    darkModeColor: color,
});

const options = (...names: string[]) => [all, ...names.map((n) => tag(n))];

describe("tagSelectionDefault", () => {
    it("is the leading All entry when the project has tags", () => {
        expect(tagSelectionDefault(options("bug"))).toEqual([all]);
    });

    it("is empty when the project has no tags", () => {
        // NOT `[undefined]` — `applyFilters` reads `tags[0].label`.
        expect(tagSelectionDefault([])).toEqual([]);
    });
});

describe("remapTagSelection", () => {
    it("keeps a selection whose tags all survive", () => {
        const before = options("bug", "chore");
        const after = options("bug", "chore", "design"); // a tag was created
        const remapped = remapTagSelection([before[1]], after);
        expect(remapped.map((f) => f.label)).toEqual(["bug"]);
    });

    it("returns the FRESH objects, not the ones passed in", () => {
        // A recoloured tag has to redraw in its new palette, and its
        // `filterModel` predicate must be the current one.
        const before = [all, tag("bug", "#ff0000")];
        const after = [all, tag("bug", "#00ff00")];
        const remapped = remapTagSelection([before[1]], after);
        expect(remapped[0]).toBe(after[1]);
        expect(remapped[0].lightModeColor).toBe("#00ff00");
    });

    it("drops a deleted tag and keeps the rest", () => {
        const before = options("bug", "chore");
        const remapped = remapTagSelection([before[1], before[2]], options("chore"));
        expect(remapped.map((f) => f.label)).toEqual(["chore"]);
    });

    it("drops a renamed tag rather than matching the old name", () => {
        // Tag filtering compares `concatTags` by NAME, so keeping the stale
        // label would leave a filter selected that matches no rows at all.
        const before = options("bug");
        const remapped = remapTagSelection([before[1]], options("defect"));
        expect(remapped.map((f) => f.label)).toEqual(["All"]);
    });

    it("falls back to All when every selected tag is gone", () => {
        const before = options("bug", "chore");
        const remapped = remapTagSelection([before[1], before[2]], options("design"));
        expect(remapped).toEqual([all]);
    });

    it("leaves an All selection on All", () => {
        expect(remapTagSelection([all], options("bug"))).toEqual([all]);
    });

    it("promotes an empty selection to All once tags exist", () => {
        // The project had no tags, so the selection was `[]`; its first tag
        // has just been created.
        expect(remapTagSelection([], options("bug"))).toEqual([all]);
    });

    it("clears the selection when the last tag is deleted", () => {
        // No options left means no dropdown row to deselect from, so a
        // leftover selection would be permanently stuck.
        const before = options("bug");
        expect(remapTagSelection([before[1]], [])).toEqual([]);
    });

    it("preserves the selection order the user built", () => {
        const before = options("a", "b", "c");
        const remapped = remapTagSelection([before[3], before[1]], options("a", "b", "c"));
        expect(remapped.map((f) => f.label)).toEqual(["c", "a"]);
    });
});

describe("sameTagSelection", () => {
    it("is true for a pure identity refresh", () => {
        // The gate on re-running `applyFilters`: a tag edit that didn't touch
        // the selection must not churn the table or rewrite storage.
        const before = options("bug", "chore");
        const after = options("bug", "chore");
        expect(sameTagSelection(remapTagSelection([before[1]], after), [before[1]])).toBe(true);
    });

    it("is false when a tag was pruned", () => {
        const before = options("bug", "chore");
        const selection = [before[1], before[2]];
        expect(sameTagSelection(remapTagSelection(selection, options("chore")), selection)).toBe(
            false
        );
    });

    it("is false when the lengths differ", () => {
        expect(sameTagSelection([all], [])).toBe(false);
    });

    it("compares by label, not by object identity", () => {
        // Otherwise every refetch — which always yields new objects — would
        // read as a change.
        expect(sameTagSelection([tag("bug", "#111")], [tag("bug", "#222")])).toBe(true);
    });

    it("is order-sensitive", () => {
        expect(sameTagSelection([tag("a"), tag("b")], [tag("b"), tag("a")])).toBe(false);
    });

    it("is true for two empty selections", () => {
        expect(sameTagSelection([], [])).toBe(true);
    });
});
