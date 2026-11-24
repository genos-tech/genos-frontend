import { describe, expect, it } from "vitest";

import {
    accessTokenExpiryMs,
    isDueForRefresh,
    MIN_REFRESH_DELAY_MS,
    msUntilRefresh,
    REFRESH_AHEAD_MS,
} from "../services/accessTokenExpiry";

const b64url = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const tokenWithExp = (expSeconds: number) =>
    `${b64url({ alg: "HS256" })}.${b64url({ exp: expSeconds })}.sig`;

describe("access token expiry (MIP-2242)", () => {
    const now = 1_700_000_000_000;

    it("reads exp in milliseconds", () => {
        expect(accessTokenExpiryMs(tokenWithExp(1_700_001_800))).toBe(1_700_001_800_000);
    });

    it("returns null for anything that is not a readable token", () => {
        expect(accessTokenExpiryMs(null)).toBeNull();
        expect(accessTokenExpiryMs("")).toBeNull();
        expect(accessTokenExpiryMs("not-a-jwt")).toBeNull();
        expect(accessTokenExpiryMs("a.%%%.c")).toBeNull();
        expect(accessTokenExpiryMs(`${b64url({})}.${b64url({ nope: 1 })}.sig`)).toBeNull();
    });

    it("schedules the refresh 5 minutes before a 30 minute token expires", () => {
        const token = tokenWithExp(now / 1000 + 30 * 60);
        expect(msUntilRefresh(token, now)).toBe(30 * 60 * 1000 - REFRESH_AHEAD_MS);
    });

    it("never schedules sooner than the minimum, even for an expired token", () => {
        expect(msUntilRefresh(tokenWithExp(now / 1000 - 100), now)).toBe(MIN_REFRESH_DELAY_MS);
        expect(msUntilRefresh(tokenWithExp(now / 1000 + 60), now)).toBe(MIN_REFRESH_DELAY_MS);
    });

    it("schedules nothing when the expiry is unknown", () => {
        expect(msUntilRefresh("junk", now)).toBeNull();
    });

    it("is due inside the window and not before it", () => {
        expect(isDueForRefresh(tokenWithExp(now / 1000 + 20 * 60), now)).toBe(false);
        expect(isDueForRefresh(tokenWithExp(now / 1000 + 4 * 60), now)).toBe(true);
        expect(isDueForRefresh(tokenWithExp(now / 1000 - 1), now)).toBe(true);
        expect(isDueForRefresh("junk", now)).toBe(false);
    });
});
