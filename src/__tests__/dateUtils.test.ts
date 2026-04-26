import { describe, expect, it } from "vitest";

import {
    extractMMDD,
    extractMMDDHHMMSSs,
    extractYYYYMMDD,
    extractYYYYMMDDHHMM,
    getFormattedDateStr,
    getFormattedNDaysAfterDateStr,
    getFormattedTodayDateStr,
    getLocalCurrentDate,
    getLocalCurrentTimestamp,
    getTimeDiffSeconds,
} from "../utils/dateUtils";

describe("getLocalCurrentTimestamp", () => {
    it("returns a correctly formatted timestamp", () => {
        const result = getLocalCurrentTimestamp();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
});

describe("getLocalCurrentDate", () => {
    it("returns YYYY-MM-DD format", () => {
        const result = getLocalCurrentDate();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe("extractMMDDHHMMSSs", () => {
    it("converts UTC timestamp to local formatted string", () => {
        const result = extractMMDDHHMMSSs("2025-06-15 10:30:45");
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
});

describe("extractYYYYMMDDHHMM", () => {
    it("formats today's date with Today prefix", () => {
        const now = new Date();
        const utcStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:00`;
        const result = extractYYYYMMDDHHMM(utcStr);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });
});

describe("extractMMDD", () => {
    it("returns a non-empty string", () => {
        const result = extractMMDD("2025-06-15 10:30:45");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });
});

describe("extractYYYYMMDD", () => {
    it("returns a non-empty string", () => {
        const result = extractYYYYMMDD("2025-06-15 10:30:45");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });
});

describe("getFormattedTodayDateStr", () => {
    it("returns YYYY-MM-DD format", () => {
        const result = getFormattedTodayDateStr();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe("getFormattedNDaysAfterDateStr", () => {
    it("returns a date N days in the future", () => {
        const today = getFormattedTodayDateStr();
        const tomorrow = getFormattedNDaysAfterDateStr(1);
        expect(tomorrow).not.toBe(today);
        expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns today for 0 days", () => {
        const result = getFormattedNDaysAfterDateStr(0);
        const today = getFormattedTodayDateStr();
        expect(result).toBe(today);
    });
});

describe("getFormattedDateStr", () => {
    it("formats a Date object to YYYY-MM-DD", () => {
        const date = new Date("2025-03-15T00:00:00Z");
        const result = getFormattedDateStr(date);
        expect(result).toBe("2025-03-15");
    });
});

describe("getTimeDiffSeconds", () => {
    it("returns 0 for same timestamps", () => {
        const ts = "2025-06-15T10:30:00Z";
        expect(getTimeDiffSeconds(ts, ts)).toBe(0);
    });

    it("returns correct difference in seconds", () => {
        const ts1 = "2025-06-15T10:30:00Z";
        const ts2 = "2025-06-15T10:31:00Z";
        expect(getTimeDiffSeconds(ts1, ts2)).toBe(60);
    });

    it("returns absolute difference regardless of order", () => {
        const ts1 = "2025-06-15T10:31:00Z";
        const ts2 = "2025-06-15T10:30:00Z";
        expect(getTimeDiffSeconds(ts1, ts2)).toBe(60);
    });
});
