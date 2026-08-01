/**
 * The email-digest opt-out (F2 of the email notification series):
 * `useDigestPreference` now carries BOTH digests through the same
 * endpoint — the agent digest (`digest_enabled`) and the email digest
 * (`email_digest_enabled`) — with independent optimistic setters, and
 * stays null (⇒ disabled switch) for the email key against an older
 * backend that doesn't return it.
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
    get.mockResolvedValue({ data: { digest_enabled: true, email_digest_enabled: true } });
    patch.mockResolvedValue({ data: {} });
});

afterEach(() => vi.clearAllMocks());

describe("useDigestPreference email digest", () => {
    it("hydrates both digests from one GET", async () => {
        const { result } = renderHook(() => useDigestPreference());
        await waitFor(() => expect(result.current.digestEnabled).toBe(true));
        expect(result.current.emailDigestEnabled).toBe(true);
    });

    it("stays null against an older backend without the key", async () => {
        get.mockResolvedValue({ data: { digest_enabled: true } });
        const { result } = renderHook(() => useDigestPreference());
        await waitFor(() => expect(result.current.digestEnabled).toBe(true));
        // Null ⇒ the panel renders the switch disabled instead of
        // showing a value the server never confirmed.
        expect(result.current.emailDigestEnabled).toBeNull();
    });

    it("PATCHes only the email key, optimistically", async () => {
        const { result } = renderHook(() => useDigestPreference());
        await waitFor(() => expect(result.current.emailDigestEnabled).toBe(true));
        act(() => result.current.setEmailDigestEnabled(false));
        expect(result.current.emailDigestEnabled).toBe(false);
        // The agent digest is untouched by the email toggle.
        expect(result.current.digestEnabled).toBe(true);
        expect(patch).toHaveBeenCalledWith("/user/preferences/digest/", {
            email_digest_enabled: false,
        });
    });
});
