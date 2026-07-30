/**
 * Saved Filter round trip — `buildSavedFilterPayload` / `resolveSavedFilter`.
 *
 * The rule these exist to pin down is STATUS across the two surfaces that
 * share the filter bar:
 *
 *   - The sprint board HIDES the status dimension and pins it to "All",
 *     because its columns *are* the status view. So a board-saved filter
 *     must omit status (recording the pinned "All" would silently widen a
 *     table view to include Closed/Deleted rows) …
 *   - … and applying a TABLE-saved filter on the board must not impose the
 *     status it carries, because the board gives the user no control to
 *     see or clear it — only Reset would.
 *
 * Everything else is the identity-only contract already covered for
 * localStorage, re-asserted here because a Saved Filter crosses users.
 */

import { describe, expect, it } from "vitest";

import {
    predefinedEffortLevelFilters,
    predefinedPriorityFilters,
    predefinedStatusFilters,
    taskTypes,
    type FilterProps,
} from "../features/tasks/types/TaskTableTypes";
import {
    buildSavedFilterPayload,
    resolveSavedFilter,
    savedFilterMatchesSelection,
} from "../features/tasks/utils/savedFilterPayload";

const defaultStatusFilters = predefinedStatusFilters.filter((f) =>
    taskTypes.ongoing.statuses.includes(f.label)
);

const tagFilter = (label: string): FilterProps => ({
    label,
    filterModel: { items: [{ field: "concatTags", operator: "contains", value: `/${label}/` }] },
    lightModeColor: "#6b7280",
    darkModeColor: "#9ca3af",
});
const predefinedTagsFilters: FilterProps[] = [tagFilter("All"), tagFilter("Frontend")];

const byLabel = (list: FilterProps[], label: string): FilterProps =>
    list.find((f) => f.label === label)!;

const opts = (hideStatusFilter = false) => ({
    hideStatusFilter,
    predefinedStatusFilters,
    defaultStatusFilters,
    predefinedTagsFilters,
    predefinedPriorityFilters,
    predefinedEffortLevelFilters,
});

const selection = {
    status: [byLabel(predefinedStatusFilters, "Open"), byLabel(predefinedStatusFilters, "WIP")],
    tags: [tagFilter("Frontend")],
    priorities: [byLabel(predefinedPriorityFilters, "High")],
    effortLevels: [byLabel(predefinedEffortLevelFilters, "All")],
    milestoneKeys: [12, "none"] as (string | number)[],
    memberKeys: ["u1"],
};

describe("buildSavedFilterPayload", () => {
    it("stores labels and keys, never the FilterProps objects", () => {
        const payload = buildSavedFilterPayload(selection);
        expect(payload).toEqual({
            status: ["Open", "WIP"],
            tags: ["Frontend"],
            priorities: ["High"],
            effortLevels: ["All"],
            milestoneKeys: [12, "none"],
            memberKeys: ["u1"],
        });
        // No predicate or palette data anywhere in the blob — it would
        // pin a stale copy of app logic for every project member.
        const serialized = JSON.stringify(payload);
        expect(serialized).not.toContain("filterModel");
        expect(serialized).not.toContain("darkModeColor");
    });

    it("omits status entirely when the surface hides that dimension", () => {
        const payload = buildSavedFilterPayload({ ...selection, hideStatusFilter: true });
        expect(payload).not.toHaveProperty("status");
        // Every other dimension still saved.
        expect(payload.tags).toEqual(["Frontend"]);
        expect(payload.memberKeys).toEqual(["u1"]);
    });
});

describe("resolveSavedFilter", () => {
    it("round-trips a table-saved selection", () => {
        const resolved = resolveSavedFilter(buildSavedFilterPayload(selection), opts());
        expect(resolved.status.map((f) => f.label)).toEqual(["Open", "WIP"]);
        expect(resolved.tags.map((f) => f.label)).toEqual(["Frontend"]);
        expect(resolved.priorities.map((f) => f.label)).toEqual(["High"]);
        expect(resolved.effortLevels.map((f) => f.label)).toEqual(["All"]);
        expect(resolved.milestoneKeys).toEqual([12, "none"]);
        expect(resolved.memberKeys).toEqual(["u1"]);
    });

    it("rehydrates against the LIVE lists, not the stored copy", () => {
        // The resolved objects must be the app's current definitions, so a
        // filter whose predicate changed picks up the new one.
        const resolved = resolveSavedFilter({ priorities: ["High"] }, opts());
        expect(resolved.priorities[0]).toBe(byLabel(predefinedPriorityFilters, "High"));
    });

    it("pins status to All on a surface that hides it, whatever the filter carries", () => {
        // The direction that bites: a table-saved filter applied on the
        // board would otherwise impose a status the board can't show or
        // clear.
        const resolved = resolveSavedFilter({ status: ["Open", "WIP"] }, opts(true));
        expect(resolved.status.map((f) => f.label)).toEqual(["All"]);
    });

    it("falls back to the ongoing default when status is absent", () => {
        // A board-saved filter applied on the TABLE asserts nothing about
        // status, so the table's own default applies rather than "All"
        // (which would pull in Closed/Deleted).
        const resolved = resolveSavedFilter({ tags: ["Frontend"] }, opts());
        expect(resolved.status).toEqual(defaultStatusFilters);
        expect(resolved.status.map((f) => f.label)).not.toContain("All");
    });

    it("drops labels that no longer exist", () => {
        // A teammate's filter naming a since-deleted project tag.
        const resolved = resolveSavedFilter({ tags: ["Deleted tag"] }, opts());
        expect(resolved.tags.map((f) => f.label)).toEqual(["All"]);
    });

    it("keeps the labels that survive when only some are stale", () => {
        const resolved = resolveSavedFilter({ status: ["Open", "Nonexistent"] }, opts());
        expect(resolved.status.map((f) => f.label)).toEqual(["Open"]);
    });

    it("never resolves to an empty selection", () => {
        // An empty selection is invalid to the bar and renders as an empty
        // table, so every dimension has a fallback.
        const resolved = resolveSavedFilter({}, opts());
        expect(resolved.status.length).toBeGreaterThan(0);
        expect(resolved.tags.length).toBeGreaterThan(0);
        expect(resolved.priorities.map((f) => f.label)).toEqual(["All"]);
        expect(resolved.effortLevels.map((f) => f.label)).toEqual(["All"]);
        expect(resolved.milestoneKeys).toEqual(["all"]);
        expect(resolved.memberKeys).toEqual(["__all__"]);
    });

    it("tolerates a project with no tags loaded yet", () => {
        const resolved = resolveSavedFilter(
            { tags: ["Frontend"] },
            { ...opts(), predefinedTagsFilters: [] }
        );
        expect(resolved.tags).toEqual([]);
    });

    it("coerces numeric milestone ids that lost their type to JSON", () => {
        const resolved = resolveSavedFilter({ milestoneKeys: ["12", "none"] }, opts());
        expect(resolved.milestoneKeys).toEqual([12, "none"]);
    });

    it("passes member sentinels through untouched", () => {
        expect(resolveSavedFilter({ memberKeys: ["__none__"] }, opts()).memberKeys).toEqual([
            "__none__",
        ]);
    });

    it("board→table→board keeps status pinned and everything else intact", () => {
        const boardPayload = buildSavedFilterPayload({ ...selection, hideStatusFilter: true });
        const onTable = resolveSavedFilter(boardPayload, opts());
        expect(onTable.status).toEqual(defaultStatusFilters);
        expect(onTable.tags.map((f) => f.label)).toEqual(["Frontend"]);

        const backOnBoard = resolveSavedFilter(boardPayload, opts(true));
        expect(backOnBoard.status.map((f) => f.label)).toEqual(["All"]);
        expect(backOnBoard.memberKeys).toEqual(["u1"]);
    });
});

describe("savedFilterMatchesSelection", () => {
    const current = buildSavedFilterPayload(selection);

    it("matches the selection its own payload describes", () => {
        expect(savedFilterMatchesSelection(current, current, opts())).toBe(true);
    });

    it("stops matching once any dimension differs", () => {
        // The "user edited a filter on top of an applied one" case: the
        // badge has to drop, so this must go false on a single change.
        const edited = buildSavedFilterPayload({
            ...selection,
            priorities: [byLabel(predefinedPriorityFilters, "Low")],
        });
        expect(savedFilterMatchesSelection(current, edited, opts())).toBe(false);
    });

    it("ignores ORDER within a dimension", () => {
        // The bar preserves click order, so a hand-built selection can
        // list the same statuses in a different sequence and still be the
        // same filter — this is what makes "the selection coincidentally
        // equals a saved filter" work in practice.
        const reversed = buildSavedFilterPayload({
            ...selection,
            status: [...selection.status].reverse(),
            milestoneKeys: ["none", 12],
        });
        expect(savedFilterMatchesSelection(current, reversed, opts())).toBe(true);
    });

    it("does not match a subset or a superset", () => {
        const fewer = buildSavedFilterPayload({
            ...selection,
            status: [byLabel(predefinedStatusFilters, "Open")],
        });
        expect(savedFilterMatchesSelection(current, fewer, opts())).toBe(false);
        expect(savedFilterMatchesSelection(fewer, current, opts())).toBe(false);
    });

    it("matches a board-saved filter right after it is applied on the table", () => {
        // It omits `status`, resolves to the table's default, and the bar's
        // selection then holds that default — so the comparison has to run
        // against the RESOLVED form, not the raw blob.
        const boardSaved = buildSavedFilterPayload({ ...selection, hideStatusFilter: true });
        const afterApplyingOnTable = buildSavedFilterPayload({
            ...selection,
            status: defaultStatusFilters,
        });
        expect(savedFilterMatchesSelection(boardSaved, afterApplyingOnTable, opts())).toBe(true);
    });

    it("ignores status entirely on a surface that hides it", () => {
        // Both sides omit the dimension there, so two filters differing
        // ONLY in status are the same filter on the board.
        const a = { ...selection, status: [byLabel(predefinedStatusFilters, "Open")] };
        const b = { ...selection, status: [byLabel(predefinedStatusFilters, "Closed")] };
        const boardOpts = opts(true);
        expect(
            savedFilterMatchesSelection(
                buildSavedFilterPayload({ ...a, hideStatusFilter: true }),
                buildSavedFilterPayload({ ...b, hideStatusFilter: true }),
                boardOpts
            )
        ).toBe(true);
    });

    it("matches a filter naming a since-deleted tag against what it really applies", () => {
        // Resolves without the dead label, so it matches the selection the
        // user actually ends up with instead of never matching at all.
        const withDeadTag = { ...current, tags: ["Gone"] };
        const afterApply = buildSavedFilterPayload({ ...selection, tags: [tagFilter("All")] });
        expect(savedFilterMatchesSelection(withDeadTag, afterApply, opts())).toBe(true);
    });

    it("treats numeric and string milestone ids as equal", () => {
        // JSON round-trips ids as strings; they must not read as a change.
        const asStrings = { ...current, milestoneKeys: ["12", "none"] };
        expect(savedFilterMatchesSelection(asStrings, current, opts())).toBe(true);
    });
});

describe("buildSavedFilterPayload — malformed selections must not be fatal", () => {
    // This runs on every render of the filter bar (the applied-filter badge
    // derives from it), so a corrupt selection has to degrade rather than
    // throw — an uncaught TypeError here takes down the whole Tasks feature
    // through its error boundary. That is exactly what happened: a Reset in
    // a project with no tags put `[undefined]` into the tag selection.
    it("skips holes instead of throwing on undefined entries", () => {
        const payload = buildSavedFilterPayload({
            ...selection,
            tags: [undefined as unknown as FilterProps],
        });
        expect(payload.tags).toEqual([]);
    });

    it("survives a hole in any dimension", () => {
        const hole = [undefined as unknown as FilterProps];
        const payload = buildSavedFilterPayload({
            status: hole,
            tags: hole,
            priorities: hole,
            effortLevels: hole,
            milestoneKeys: [],
            memberKeys: [],
        });
        expect(payload).toEqual({
            status: [],
            tags: [],
            priorities: [],
            effortLevels: [],
            milestoneKeys: [],
            memberKeys: [],
        });
    });

    it("keeps the real entries alongside a hole", () => {
        const payload = buildSavedFilterPayload({
            ...selection,
            status: [
                byLabel(predefinedStatusFilters, "Open"),
                undefined as unknown as FilterProps,
                byLabel(predefinedStatusFilters, "WIP"),
            ],
        });
        expect(payload.status).toEqual(["Open", "WIP"]);
    });

    it("tolerates a project with no tags at all", () => {
        // The legitimate version of the same shape: `[]`, not `[undefined]`.
        const payload = buildSavedFilterPayload({ ...selection, tags: [] });
        expect(payload.tags).toEqual([]);
        // …and it still round-trips.
        expect(
            savedFilterMatchesSelection(payload, payload, { ...opts(), predefinedTagsFilters: [] })
        ).toBe(true);
    });
});
