/**
 * MIP-1194: the calendar's labels follow the app's language (they were English in Arabic), and a
 * zoomed attachment image downloads with its extension.
 */
import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import {
    formatCalendarDate,
    formatCalendarRange,
    weekdayLabels,
} from "../features/calendar/utils/monthGrid";
import { attachmentDownloadName } from "../features/tasks/utils/attachmentDownloadName";

describe("calendar labels", () => {
    it("English keeps the short weekday names, Sunday first or Monday first", () => {
        expect(weekdayLabels(0, "en")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
        expect(weekdayLabels(1, "en")).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    });

    it("every other locale gets its own weekday names, not English", () => {
        const en = weekdayLabels(0, "en");
        for (const locale of ["ja", "zh", "es", "fr", "hi", "ar"]) {
            const labels = weekdayLabels(0, locale);
            expect(labels).toHaveLength(7);
            expect(labels, locale).not.toEqual(en);
            expect(new Set(labels).size, locale).toBe(7);
        }
    });

    it("the month title and the day title are in the locale", () => {
        const day = dayjs("2026-11-08");
        expect(formatCalendarDate(day, "en", { month: "long", year: "numeric" })).toBe(
            "November 2026"
        );
        expect(formatCalendarDate(day, "ja", { month: "long", year: "numeric" })).toContain(
            "11月"
        );
        expect(formatCalendarDate(day, "ar", { month: "long", year: "numeric" })).not.toContain(
            "November"
        );
    });

    it("the week range is compact in English and localised elsewhere", () => {
        // ICU puts thin spaces around the dash; they read as the same space.
        const plain = (text: string) => text.replace(/\s/g, " ");
        expect(plain(formatCalendarRange(dayjs("2026-05-19"), dayjs("2026-05-25"), "en"))).toBe(
            "May 19 – 25, 2026"
        );
        expect(plain(formatCalendarRange(dayjs("2026-04-28"), dayjs("2026-05-04"), "en"))).toBe(
            "Apr 28 – May 4, 2026"
        );
        expect(formatCalendarRange(dayjs("2026-05-19"), dayjs("2026-05-25"), "ar")).not.toContain(
            "May"
        );
    });
});

describe("attachment download name", () => {
    it("keeps the attachment's extension", () => {
        expect(attachmentDownloadName("diagram.JPG", "20261108")).toBe("image-20261108.JPG");
        expect(attachmentDownloadName("a.b.webp", "t")).toBe("image-t.webp");
    });

    it("falls back to .png when the name has none", () => {
        expect(attachmentDownloadName("", "t")).toBe("image-t.png");
        expect(attachmentDownloadName("screenshot", "t")).toBe("image-t.png");
    });
});
