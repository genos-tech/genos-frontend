import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    detectBrowserTimezone,
    shouldReportTimezone,
    useReportBrowserTimezone,
} from "../hooks/common/useReportBrowserTimezone";

const get = vi.fn();
const patch = vi.fn();
let hasApi = true;

vi.mock("../services/api", () => ({
    authApi: () => (hasApi ? { get, patch } : null),
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "token" }),
}));

beforeEach(() => {
    hasApi = true;
    get.mockResolvedValue({ data: { timezone: "" } });
    patch.mockResolvedValue({ data: { timezone: "Asia/Tokyo" } });
});

afterEach(() => vi.clearAllMocks());

describe("shouldReportTimezone", () => {
    it("reports when the server has never been told", () => {
        expect(shouldReportTimezone({ browser: "Asia/Tokyo", stored: "" })).toBe(true);
    });

    it("reports when the browser disagrees with the server", () => {
        expect(shouldReportTimezone({ browser: "Europe/Paris", stored: "Asia/Tokyo" })).toBe(true);
    });

    it("stays quiet when they already agree", () => {
        // The rule that matters at scale: without it, every app boot for
        // every user is a needless UPDATE.
        expect(shouldReportTimezone({ browser: "Asia/Tokyo", stored: "Asia/Tokyo" })).toBe(false);
    });

    it("stays quiet when the browser won't say", () => {
        expect(shouldReportTimezone({ browser: null, stored: "" })).toBe(false);
        expect(shouldReportTimezone({ browser: null, stored: "Asia/Tokyo" })).toBe(false);
    });
});

describe("detectBrowserTimezone", () => {
    it("returns the IANA name the browser reports", () => {
        // jsdom resolves a real zone (UTC under vitest), so assert the
        // shape rather than a specific city.
        expect(typeof detectBrowserTimezone()).toBe("string");
    });

    it("returns null instead of throwing when Intl misbehaves", () => {
        const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation((() => {
            throw new Error("nope");
        }) as never);
        expect(detectBrowserTimezone()).toBeNull();
        spy.mockRestore();
    });
});

describe("useReportBrowserTimezone", () => {
    it("PATCHes the browser zone when the server has none", async () => {
        vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
            resolvedOptions: () => ({ timeZone: "Asia/Tokyo" }),
        } as never);

        renderHook(() => useReportBrowserTimezone());

        await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
        expect(patch).toHaveBeenCalledWith("/user/preferences/timezone/", {
            timezone: "Asia/Tokyo",
        });
    });

    it("does not PATCH when the server already agrees", async () => {
        vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
            resolvedOptions: () => ({ timeZone: "Asia/Tokyo" }),
        } as never);
        get.mockResolvedValue({ data: { timezone: "Asia/Tokyo" } });

        renderHook(() => useReportBrowserTimezone());

        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(patch).not.toHaveBeenCalled();
    });

    it("stays silent when the GET fails — server time keeps being used", async () => {
        vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
            resolvedOptions: () => ({ timeZone: "Asia/Tokyo" }),
        } as never);
        get.mockRejectedValue(new Error("offline"));

        renderHook(() => useReportBrowserTimezone());

        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(patch).not.toHaveBeenCalled();
    });

    it("does nothing at all when unauthenticated", async () => {
        hasApi = false;
        renderHook(() => useReportBrowserTimezone());
        await Promise.resolve();
        expect(get).not.toHaveBeenCalled();
        expect(patch).not.toHaveBeenCalled();
    });
});
