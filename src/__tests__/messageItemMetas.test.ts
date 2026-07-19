import { describe, expect, it } from "vitest";

import { computeMessageItemMetas } from "../features/chat/utils/messageItemMetas";

// Fixed dates well over a year in the past so `extractMMDD` yields the
// deterministic "Mon. D, YYYY" form (never "Today"/"Yesterday").
const msg = (tsSent: string, userId = 1) => ({ sender: { userId }, tsSent });

describe("computeMessageItemMetas", () => {
    it("returns an empty array for no messages", () => {
        expect(computeMessageItemMetas([], false, 1)).toEqual([]);
    });

    it("shows a date separator on the first message and on each local-day change", () => {
        const metas = computeMessageItemMetas(
            [
                msg("2020-01-01 10:00:00"),
                msg("2020-01-01 23:59:00"),
                msg("2020-01-02 00:01:00"),
                msg("2020-03-05 09:00:00"),
            ],
            false,
            1
        );
        expect(metas.map((m) => m.showDateSeparator)).toEqual([true, false, true, true]);
        expect(metas[0].dateLabel).toBe("Jan. 1, 2020");
        expect(metas[1].dateLabel).toBe("");
        expect(metas[2].dateLabel).toBe("Jan. 2, 2020");
        expect(metas[3].dateLabel).toBe("Mar. 5, 2020");
    });

    it("groups consecutive same-sender messages within 10 minutes", () => {
        const metas = computeMessageItemMetas(
            [
                msg("2020-01-01 10:00:00", 1),
                msg("2020-01-01 10:05:00", 1), // same sender, 5 min → grouped
                msg("2020-01-01 10:20:00", 1), // same sender, 15 min → not grouped
                msg("2020-01-01 10:21:00", 2), // different sender → not grouped
            ],
            false,
            1
        );
        expect(metas.map((m) => m.isSimpleBubble)).toEqual([false, true, false, false]);
    });

    it("never groups PM main-pane bubbles (task cards) but does group PM threads", () => {
        const messages = [msg("2020-01-01 10:00:00", 1), msg("2020-01-01 10:01:00", 1)];
        expect(computeMessageItemMetas(messages, false, 3)[1].isSimpleBubble).toBe(false);
        expect(computeMessageItemMetas(messages, true, 3)[1].isSimpleBubble).toBe(true);
    });

    it("pads only the last row extra so the newest bubble clears the editor", () => {
        const metas = computeMessageItemMetas(
            [msg("2020-01-01 10:00:00"), msg("2020-01-01 10:01:00")],
            false,
            1
        );
        expect(metas[0].paddingBottom).toBeCloseTo(0.3);
        expect(metas[1].paddingBottom).toBeCloseTo(3.3);
        expect(metas.every((m) => m.paddingTop === 0.3)).toBe(true);
    });
});
