import { describe, expect, it } from "vitest";

import {
    dateOnly,
    googleEndToInclusive,
    inclusiveToGoogleEnd,
} from "../features/integrations/utils/allDayDates";

describe("all-day date helpers", () => {
    it("converts Google's exclusive end to the inclusive last day", () => {
        expect(googleEndToInclusive("2026-07-15")).toBe("2026-07-14");
    });

    it("converts the inclusive last day back to Google's exclusive end", () => {
        expect(inclusiveToGoogleEnd("2026-07-14")).toBe("2026-07-15");
    });

    it("round-trips without drift", () => {
        for (const d of ["2026-07-14", "2026-01-01", "2026-12-31", "2024-02-29"]) {
            expect(googleEndToInclusive(inclusiveToGoogleEnd(d))).toBe(d);
        }
    });

    it("crosses month / year / leap boundaries correctly", () => {
        expect(googleEndToInclusive("2026-08-01")).toBe("2026-07-31");
        expect(inclusiveToGoogleEnd("2026-12-31")).toBe("2027-01-01");
        expect(inclusiveToGoogleEnd("2024-02-28")).toBe("2024-02-29"); // leap year
    });

    it("extracts the date part of a datetime-local or bare date", () => {
        expect(dateOnly("2026-07-14T09:30")).toBe("2026-07-14");
        expect(dateOnly("2026-07-14")).toBe("2026-07-14");
    });
});
