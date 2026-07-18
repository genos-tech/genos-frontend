import { describe, expect, it } from "vitest";

import {
    EMPTY_TAG_ID_SET,
    makeTagFilter,
    pruneSelection,
    selectVisibleTagChips,
    VISIBLE_CHIP_CAP,
} from "../../features/chat/utils/gmTagFilters";
import { AllChatProps } from "../../types/chat";
import { PersonalTag } from "../../types/personalTags";

// The tag filter only reads `chatId` — cast a partial to the full shape,
// same convention as the activityChipFilters fixtures.
const chat = (chatId: string): AllChatProps => ({ chatId, chatType: 2 }) as AllChatProps;

const tag = (tagId: number, over: Partial<PersonalTag> = {}): PersonalTag => ({
    color: "#ff2323",
    isDefaultVisible: false,
    name: `tag${tagId}`,
    sortOrder: 0,
    tagId,
    textColor: "white",
    ...over,
});

describe("makeTagFilter", () => {
    const assignments = { a: [1, 2], b: [2], c: [3] };

    it("passes everything when the selection is empty", () => {
        const filter = makeTagFilter(EMPTY_TAG_ID_SET, assignments);
        expect(filter(chat("a"))).toBe(true);
        expect(filter(chat("zzz"))).toBe(true);
    });

    it("OR-composes across selected tags", () => {
        // Selecting tags 1 and 3 must pass a chat carrying EITHER —
        // never require both on one chat (that's the Activity filter's
        // AND semantics, wrong for a single tags facet).
        const filter = makeTagFilter(new Set([1, 3]), assignments);
        expect(filter(chat("a"))).toBe(true); // has 1
        expect(filter(chat("c"))).toBe(true); // has 3
        expect(filter(chat("b"))).toBe(false); // has only 2
    });

    it("rejects chats with no assignments at all", () => {
        const filter = makeTagFilter(new Set([1]), assignments);
        expect(filter(chat("untagged"))).toBe(false);
    });

    it("treats unknown/deleted tag ids as non-matching (no crash)", () => {
        const filter = makeTagFilter(new Set([999]), assignments);
        expect(filter(chat("a"))).toBe(false);
    });
});

describe("selectVisibleTagChips", () => {
    it("shows the pinned set (sortOrder, then name) when any tag is pinned", () => {
        const tags = [
            tag(1, { isDefaultVisible: true, name: "zeta", sortOrder: 1 }),
            tag(2, { isDefaultVisible: true, name: "alpha", sortOrder: 1 }),
            tag(3, { isDefaultVisible: true, sortOrder: 0 }),
            tag(4), // unpinned — excluded even if in the recency list
        ];
        const visible = selectVisibleTagChips(tags, [4], EMPTY_TAG_ID_SET);
        expect(visible.map((t) => t.tagId)).toEqual([3, 2, 1]);
    });

    it("falls back to the recency-derived server order when nothing is pinned", () => {
        const tags = [tag(1), tag(2), tag(3)];
        const visible = selectVisibleTagChips(tags, [2, 1], EMPTY_TAG_ID_SET);
        expect(visible.map((t) => t.tagId)).toEqual([2, 1]);
    });

    it("drops recency ids whose tag no longer exists and caps the row", () => {
        const tags = Array.from({ length: 10 }, (_, i) => tag(i + 1));
        const recency = [99, ...tags.map((t) => t.tagId)]; // 99 = deleted
        const visible = selectVisibleTagChips(tags, recency, EMPTY_TAG_ID_SET);
        expect(visible).toHaveLength(VISIBLE_CHIP_CAP);
        expect(visible[0].tagId).toBe(1);
    });

    it("always unions currently-selected tags into the row", () => {
        // Tag 5 is neither pinned nor recent, but it's actively
        // filtering — it must stay visible so it can be deselected.
        const tags = [tag(1, { isDefaultVisible: true }), tag(5)];
        const visible = selectVisibleTagChips(tags, [], new Set([5]));
        expect(visible.map((t) => t.tagId)).toEqual([1, 5]);
    });

    it("does not duplicate a selected tag already in the default set", () => {
        const tags = [tag(1, { isDefaultVisible: true })];
        const visible = selectVisibleTagChips(tags, [], new Set([1]));
        expect(visible.map((t) => t.tagId)).toEqual([1]);
    });
});

describe("pruneSelection", () => {
    it("returns the SAME instance when nothing was pruned (identity gate)", () => {
        const selected: ReadonlySet<number> = new Set([1, 2]);
        expect(pruneSelection(selected, [tag(1), tag(2)])).toBe(selected);
        expect(pruneSelection(EMPTY_TAG_ID_SET, [])).toBe(EMPTY_TAG_ID_SET);
    });

    it("drops ids whose tag was deleted", () => {
        const selected: ReadonlySet<number> = new Set([1, 2, 3]);
        const pruned = pruneSelection(selected, [tag(2)]);
        expect([...pruned]).toEqual([2]);
    });
});
