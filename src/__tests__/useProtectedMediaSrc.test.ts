/**
 * `useProtectedMediaSrc` is the classify-and-resolve seam for a
 * hand-written `<img>` (chat message bodies rendered as plain DOM by
 * `LightMessageBody`, message attachments). Unlike BlockNote's
 * `resolveFileUrl`, it is the one place that looks at the RAW url the
 * server baked into the body.
 *
 * Regression pinned here: media uploaded before genos-api trusted the
 * proxy's forwarded scheme carries an `http://` origin. On an https page
 * that origin differs from our own media origin, so `isProtectedMediaUrl`
 * used to read the URL as a foreign CDN, render it raw (Mixed-Content
 * warning + no session-token fetch), and leave these historical chat
 * images on the fragile cookie path. The hook must upgrade the scheme
 * FIRST so both classification and the rendered `src` see the https form.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProtectedMediaSrc } from "../hooks/common/useProtectedMediaSrc";

const API = "https://api.genosai.dev";
const INSECURE_CHAT_IMAGE = `http://api.genosai.dev/media/chats/c0f39cee/inline/shot.png`;
const SECURE_CHAT_IMAGE = `${API}/media/chats/c0f39cee/inline/shot.png`;
const INSECURE_AVATAR = `http://api.genosai.dev/media/user_profiles/u1/avatar.png`;
const SECURE_AVATAR = `${API}/media/user_profiles/u1/avatar.png`;

// `resolveInsecureFileUrl` backs the protected branch — return the url it
// was handed synchronously so the test asserts WHAT it receives (the
// upgraded form) without a real fetch. `upgradeInsecureUrl` is the actual
// scheme-upgrade under test, so keep the real implementation.
const resolveInsecureFileUrl = vi.hoisted(() => vi.fn((url: string) => Promise.resolve(url)));
vi.mock("../utils/downloadUtils", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    resolveInsecureFileUrl,
}));

beforeEach(() => {
    // `isProtectedMediaUrl` gates on our own media origin, read from this
    // env at call time (production bakes it in as https).
    vi.stubEnv("VITE_MEDIA_ROOT_DJANGO", `${API}/media`);
    // The whole bug only reproduces on an https page — `upgradeInsecureUrl`
    // is a deliberate no-op on http (local dev). jsdom defaults to http, so
    // stub it the same way downloadUtils.test.ts does.
    vi.stubGlobal("location", { protocol: "https:" });
    resolveInsecureFileUrl.mockClear();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("useProtectedMediaSrc", () => {
    it("upgrades an http protected chat image and resolves it as ours", async () => {
        const { result } = renderHook(() => useProtectedMediaSrc(INSECURE_CHAT_IMAGE));

        // Protected → the src is undefined until resolution completes (the
        // hook renders nothing rather than fire an http request the browser
        // would flag as Mixed Content).
        await waitFor(() => expect(result.current).toBe(SECURE_CHAT_IMAGE));

        // The classification ran on the upgraded URL: it stayed "protected"
        // and went through the session-token fetch seam with https, not the
        // raw http URL.
        expect(resolveInsecureFileUrl).toHaveBeenCalledWith(SECURE_CHAT_IMAGE);
    });

    it("upgrades an http public avatar without a resolve fetch", () => {
        const { result } = renderHook(() => useProtectedMediaSrc(INSECURE_AVATAR));

        // Public media resolves synchronously to itself — but to the https
        // form, so the rendered <img> never carries a Mixed-Content src.
        expect(result.current).toBe(SECURE_AVATAR);
        expect(resolveInsecureFileUrl).not.toHaveBeenCalled();
    });

    it("returns undefined for an empty url", () => {
        const { result } = renderHook(() => useProtectedMediaSrc(undefined));
        expect(result.current).toBeUndefined();
    });
});
