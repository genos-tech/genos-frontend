/**
 * The email-digest opt-out (F2 of the email notification series):
 * `useDigestPreference` carries the email digest (`email_digest_enabled`)
 * with an optimistic setter, and stays null (⇒ disabled switch) against
 * a backend that doesn't return it. (The AI digest was retired, MIP-1968.)
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDigestPreference } from "../hooks/common/useDigestPreference";

const get = vi.fn();
const patch = vi.fn();

vi.mock("../services/api", () => ({
    authApi: () => ({ get, patch }),
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "token" }),
}));

beforeEach(() => {
    get.mockResolvedValue({ data: { email_digest_enabled: true } });
    patch.mockResolvedValue({ data: {} });
});

afterEach(() => vi.clearAllMocks());

describe("useDigestPreference email digest", () => {
    it("hydrates the email digest from one GET", async () => {
        const { result } = renderHook(() => useDigestPreference());
        await waitFor(() => expect(result.current.emailDigestEnabled).toBe(true));
    });

    it("stays null against an older backend without the key", async () => {
        get.mockResolvedValue({ data: {} });
        const { result } = renderHook(() => useDigestPreference());
        await waitFor(() => expect(get).toHaveBeenCalled());
        // Null ⇒ the panel renders the switch disabled instead of
        // showing a value the server never confirmed.
        expect(result.current.emailDigestEnabled).toBeNull();
    });

    it("PATCHes only the email key, optimistically", async () => {
        const { result } = renderHook(() => useDigestPreference());
        await waitFor(() => expect(result.current.emailDigestEnabled).toBe(true));
        act(() => result.current.setEmailDigestEnabled(false));
        expect(result.current.emailDigestEnabled).toBe(false);
        expect(patch).toHaveBeenCalledWith("/user/preferences/digest/", {
            email_digest_enabled: false,
        });
    });
});
