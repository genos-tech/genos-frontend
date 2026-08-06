/**
 * Loading protected `/media/` with the session's own credential rather
 * than whatever `refresh` cookie the browser feels like attaching.
 *
 * The bug this fixes: a recipient saw an image render as its filename,
 * with `{"detail": "Not found."}` from the API — the per-file media ACL
 * refusing a cookie that identified a different user than the app was
 * signed in as. A cookie that is blocked outright (third-party blocking,
 * which production's `SameSite=None` invites) produces the same symptom.
 *
 * What's pinned here is mostly the boundaries, because the risk in this
 * change is not "does the happy path work" but "can it make a currently
 * working image stop working". Every failure path must hand back the
 * original URL.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearMediaCache,
    isProtectedMediaUrl,
    mediaAuthHeaders,
    resolveProtectedMediaUrl,
    setMediaAccessToken,
} from "../utils/mediaAuth";

const API = "https://api.genosai.dev";
const CHAT_IMAGE = `${API}/media/chats/11111111-2222-3333-4444-555555555555/inline/abc-shot.png`;

const mockFetchOk = (bytes = 4) =>
    vi.fn(async () => ({
        ok: true,
        blob: async () => ({ size: bytes, type: "image/png" }) as unknown as Blob,
    })) as unknown as typeof fetch;

beforeEach(() => {
    setMediaAccessToken(null);
    clearMediaCache();
    vi.stubGlobal(
        "URL",
        Object.assign(URL, {
            createObjectURL: vi.fn(() => "blob:made-up"),
            revokeObjectURL: vi.fn(),
        })
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("isProtectedMediaUrl", () => {
    it("covers the attachment trees the API gates", () => {
        expect(isProtectedMediaUrl(CHAT_IMAGE)).toBe(true);
        expect(isProtectedMediaUrl(`${API}/media/chats/x/messages/1/file.bin`)).toBe(true);
        expect(isProtectedMediaUrl(`${API}/media/task_attachments/42/plan.pdf`)).toBe(true);
        expect(isProtectedMediaUrl(`${API}/media/notes/personal/7/diary.md`)).toBe(true);
    });

    it("leaves the public prefixes alone", () => {
        // Mirrors PUBLIC_MEDIA_PREFIXES in genos-api media_views.py. These
        // render dozens of times per viewport and need no session, so
        // routing them through a fetch would trade the browser's image
        // cache for blobs and buy nothing.
        expect(isProtectedMediaUrl(`${API}/media/user_profiles/u1/avatar.png`)).toBe(false);
        expect(isProtectedMediaUrl(`${API}/media/team_emoji/global/party.gif`)).toBe(false);
        expect(isProtectedMediaUrl(`${API}/media/team_profiles/t/logo.png`)).toBe(false);
        expect(isProtectedMediaUrl(`${API}/media/gm_profiles/g/x.png`)).toBe(false);
        expect(isProtectedMediaUrl(`${API}/media/channel_profiles/c/x.png`)).toBe(false);
        expect(isProtectedMediaUrl(`${API}/media/project_profiles/p/x.png`)).toBe(false);
    });

    it("ignores anything that isn't a media URL", () => {
        expect(isProtectedMediaUrl("blob:already-local")).toBe(false);
        expect(isProtectedMediaUrl("data:image/png;base64,AAA")).toBe(false);
        expect(isProtectedMediaUrl(`${API}/api/v3/channels/`)).toBe(false);
        expect(isProtectedMediaUrl(`${API}/media/`)).toBe(false);
        expect(isProtectedMediaUrl("")).toBe(false);
    });
});

describe("resolveProtectedMediaUrl", () => {
    it("fetches with the session token and renders the blob", async () => {
        const fetchMock = mockFetchOk();
        vi.stubGlobal("fetch", fetchMock);
        setMediaAccessToken("tok-1");

        expect(await resolveProtectedMediaUrl(CHAT_IMAGE)).toBe("blob:made-up");
        expect(fetchMock).toHaveBeenCalledWith(
            CHAT_IMAGE,
            expect.objectContaining({
                headers: { Authorization: "Bearer tok-1" },
                credentials: "include",
            })
        );
    });

    it("passes the URL through untouched when there is no token", async () => {
        const fetchMock = mockFetchOk();
        vi.stubGlobal("fetch", fetchMock);
        // Before the app has pushed a token in, the cookie is all there is
        // — which is exactly the pre-existing behavior.
        expect(await resolveProtectedMediaUrl(CHAT_IMAGE)).toBe(CHAT_IMAGE);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("passes public media through without a fetch", async () => {
        const fetchMock = mockFetchOk();
        vi.stubGlobal("fetch", fetchMock);
        setMediaAccessToken("tok-1");
        const avatar = `${API}/media/user_profiles/u1/avatar.png`;
        expect(await resolveProtectedMediaUrl(avatar)).toBe(avatar);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("falls back to the URL when the API refuses", async () => {
        // The 404/401 case. Falling back means the browser still gets to
        // try the cookie, so this can only ever improve on today.
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ ok: false, status: 404 }))
        );
        setMediaAccessToken("tok-1");
        expect(await resolveProtectedMediaUrl(CHAT_IMAGE)).toBe(CHAT_IMAGE);
    });

    it("falls back to the URL when the fetch throws", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                throw new Error("offline");
            })
        );
        setMediaAccessToken("tok-1");
        expect(await resolveProtectedMediaUrl(CHAT_IMAGE)).toBe(CHAT_IMAGE);
    });

    it("downloads each image once", async () => {
        const fetchMock = mockFetchOk();
        vi.stubGlobal("fetch", fetchMock);
        setMediaAccessToken("tok-1");
        await Promise.all([
            resolveProtectedMediaUrl(CHAT_IMAGE),
            resolveProtectedMediaUrl(CHAT_IMAGE),
        ]);
        await resolveProtectedMediaUrl(CHAT_IMAGE);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("drops cached blobs when the session changes", async () => {
        // The important correctness case: serving the previous user's
        // attachments out of an in-memory cache after an account switch
        // would put back, on the client, the cross-user leak the per-file
        // ACL closed on the server.
        vi.stubGlobal("fetch", mockFetchOk());
        setMediaAccessToken("tok-1");
        await resolveProtectedMediaUrl(CHAT_IMAGE);

        setMediaAccessToken("tok-2");
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:made-up");

        await resolveProtectedMediaUrl(CHAT_IMAGE);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch).toHaveBeenLastCalledWith(
            CHAT_IMAGE,
            expect.objectContaining({ headers: { Authorization: "Bearer tok-2" } })
        );
    });

    it("keeps the cache when the same token is pushed again", async () => {
        // The bootstrap re-pushes on every render; that must not evict.
        vi.stubGlobal("fetch", mockFetchOk());
        setMediaAccessToken("tok-1");
        await resolveProtectedMediaUrl(CHAT_IMAGE);
        setMediaAccessToken("tok-1");
        await resolveProtectedMediaUrl(CHAT_IMAGE);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("revokes everything on sign-out", async () => {
        vi.stubGlobal("fetch", mockFetchOk());
        setMediaAccessToken("tok-1");
        await resolveProtectedMediaUrl(CHAT_IMAGE);
        setMediaAccessToken(null);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:made-up");
    });
});

describe("mediaAuthHeaders", () => {
    it("is empty without a session and a Bearer header with one", () => {
        expect(mediaAuthHeaders()).toEqual({});
        setMediaAccessToken("tok-9");
        expect(mediaAuthHeaders()).toEqual({ Authorization: "Bearer tok-9" });
    });
});
