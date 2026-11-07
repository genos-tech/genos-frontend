// The security log is kept for 365 days (`SECURITY_EVENT_RETENTION_DAYS`, default 365, never
// under 90). The screen's own text used to say "a year" / "1 年". The retention is a number
// people may rely on, so both languages say it as that number.

import { describe, expect, it } from "vitest";

import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";

const find = (node: unknown, key: string): Record<string, unknown> | undefined => {
    if (!node || typeof node !== "object") return undefined;
    const obj = node as Record<string, unknown>;
    if (key in obj && obj[key] && typeof obj[key] === "object") {
        return obj[key] as Record<string, unknown>;
    }
    for (const value of Object.values(obj)) {
        const hit = find(value, key);
        if (hit) return hit;
    }
    return undefined;
};

describe("the security log's retention text", () => {
    it("says 365 days in English", () => {
        const blurb = String(find(en, "securityLog")?.blurb);
        expect(blurb).toContain("365 days");
        expect(blurb).not.toMatch(/a year|one year/i);
    });

    it("says 365 days in Japanese", () => {
        const blurb = String(find(ja, "securityLog")?.blurb);
        expect(blurb).toContain("365 日");
        expect(blurb).not.toContain("1 年");
    });
});
