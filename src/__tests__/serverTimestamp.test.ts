import { describe, expect, it } from "vitest";

import { toServerTimestamp } from "../features/tasks/utils/serverTimestamp";

describe("toServerTimestamp", () => {
    it("turns a DRF ISO time into the form getProjectTasks sends (str(datetime))", () => {
        // Both lines are the same instant, as the local API returned them for one task.
        expect(toServerTimestamp("2026-11-02T16:13:23.294468Z")).toBe(
            "2026-11-02 16:13:23.294468+00:00"
        );
    });

    it("keeps a time that is already in the server form", () => {
        expect(toServerTimestamp("2026-11-02 16:13:23.294468+00:00")).toBe(
            "2026-11-02 16:13:23.294468+00:00"
        );
    });

    it("handles a time with no fraction (Python and DRF both drop a zero one)", () => {
        expect(toServerTimestamp("2026-11-02T16:13:23Z")).toBe("2026-11-02 16:13:23+00:00");
        expect(toServerTimestamp("2026-11-02 16:13:23+00:00")).toBe("2026-11-02 16:13:23+00:00");
    });

    it("writes another offset the way Python does", () => {
        expect(toServerTimestamp("2026-11-02T16:13:23.5+09:00")).toBe(
            "2026-11-02 16:13:23.5+09:00"
        );
        expect(toServerTimestamp("2026-11-02T16:13:23.5+0900")).toBe(
            "2026-11-02 16:13:23.5+09:00"
        );
    });

    it("leaves a zone-less time zone-less (the app's own local form)", () => {
        expect(toServerTimestamp("2026-11-02 14:05:13")).toBe("2026-11-02 14:05:13");
        expect(toServerTimestamp("2026-11-02T14:05:13")).toBe("2026-11-02 14:05:13");
    });

    it("returns null for anything that is not a time", () => {
        for (const bad of [undefined, null, "", "now", "2026-11-02", 1793636224, {}, []]) {
            expect(toServerTimestamp(bad)).toBeNull();
        }
    });

    it("orders the same way as the instants when the forms are mixed after normalising", () => {
        // The reason for the helper: callers compare `updatedAt` as plain
        // strings, and "T" sorts after " ", so a raw ISO value always beats a
        // server-form one from the same day.
        const earlier = "2026-11-02 16:13:23.294468+00:00";
        const later = toServerTimestamp("2026-11-02T16:27:23.079829Z") as string;
        expect(later > earlier).toBe(true);
        expect("2026-11-02T16:13:00Z" > "2026-11-02 23:59:59+00:00").toBe(true); // the trap
        expect(toServerTimestamp("2026-11-02T16:13:00Z")! > "2026-11-02 23:59:59+00:00").toBe(
            false
        );
    });
});
