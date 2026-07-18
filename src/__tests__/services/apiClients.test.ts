import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    askAgentStream,
    decideAgent,
    fetchAgentFeatures,
    fetchAgentModels,
    fetchAgentSessionDetail,
    fetchAgentSessions,
    fetchAgentUsage,
    fetchNoteSummary,
    fetchThreadSummary,
} from "../../services/agentApi";
import { authApi } from "../../services/api";
import {
    addMentionGroupMembers,
    createMentionGroup,
    deleteMentionGroup,
    listMentionGroups,
    removeMentionGroupMember,
    updateMentionGroup,
} from "../../services/mentionGroupsApi";
import { searchSpotlight } from "../../services/searchApi";
import { v3ApiBaseURL } from "../../services/v3Api";

// ---------------------------------------------------------------------------
// Mock the axios `api` layer used by searchApi + mentionGroupsApi.
// `authApi(token)` returns either a stubbed axios instance or null (no token).
// ---------------------------------------------------------------------------
vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

const mockedAuthApi = authApi as unknown as ReturnType<typeof vi.fn>;

// The agentApi module reads VITE_API_BASE_URL at module-load time into a
// module-level `API_BASE`, so we derive expected URLs from the live env
// value rather than hardcoding a host. This is correct today and robust if
// the test env's base URL changes.
const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

// ---------------------------------------------------------------------------
// fetch helpers for agentApi (native fetch, NDJSON streaming).
// ---------------------------------------------------------------------------

// Builds a Response-like object whose body.getReader() yields the given
// string chunks in order, then done. Avoids the real ReadableStream API.
function streamResponse(chunks: string[], opts: { ok?: boolean; status?: number } = {}) {
    const enc = new TextEncoder();
    let i = 0;
    return {
        ok: opts.ok ?? true,
        status: opts.status ?? 200,
        body: {
            getReader: () => ({
                read: async () =>
                    i < chunks.length
                        ? { value: enc.encode(chunks[i++]), done: false }
                        : { value: undefined, done: true },
                releaseLock: () => {},
            }),
        },
    } as unknown as Response;
}

// JSON (non-streaming) Response-like object.
function jsonResponse(data: unknown, opts: { ok?: boolean; status?: number } = {}) {
    return {
        ok: opts.ok ?? true,
        status: opts.status ?? 200,
        json: async () => data,
        text: async () => JSON.stringify(data),
    } as unknown as Response;
}

// A streaming handler bag with vi.fn()s for every callback.
function makeHandlers() {
    return {
        onSources: vi.fn(),
        onDelta: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onToolError: vi.fn(),
        onPendingApproval: vi.fn(),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// ===========================================================================
// mentionGroupsApi
// ===========================================================================
describe("mentionGroupsApi", () => {
    describe("listMentionGroups", () => {
        it("GETs /mention-group/ with the team_id and unwraps mentionGroups", async () => {
            const groups = [{ groupId: 1, groupName: "Eng" }];
            const get = vi.fn().mockResolvedValue({ data: { mentionGroups: groups } });
            mockedAuthApi.mockReturnValue({ get });

            const result = await listMentionGroups("tok", "team a&b");

            expect(authApi).toHaveBeenCalledWith("tok");
            // teamId is URL-encoded.
            expect(get).toHaveBeenCalledWith("/mention-group/?team_id=team%20a%26b");
            expect(result).toBe(groups);
        });

        it("returns [] when the response has no mentionGroups key", async () => {
            const get = vi.fn().mockResolvedValue({ data: {} });
            mockedAuthApi.mockReturnValue({ get });
            expect(await listMentionGroups("tok", "t")).toEqual([]);
        });

        it("returns [] when there is no access token (authApi null)", async () => {
            mockedAuthApi.mockReturnValue(null);
            const result = await listMentionGroups("", "t");
            expect(result).toEqual([]);
        });

        it("returns [] and logs on request error", async () => {
            const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const get = vi.fn().mockRejectedValue(new Error("boom"));
            mockedAuthApi.mockReturnValue({ get });

            const result = await listMentionGroups("tok", "t");

            expect(result).toEqual([]);
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });

    describe("createMentionGroup", () => {
        it("POSTs /mention-group/ with the payload and returns data", async () => {
            const created = { groupId: 7, groupName: "Design" };
            const post = vi.fn().mockResolvedValue({ data: created });
            mockedAuthApi.mockReturnValue({ post });

            const payload = {
                team_id: "t",
                group_name: "Design",
                description: "d",
                created_by: "u1",
            };
            const result = await createMentionGroup("tok", payload);

            expect(post).toHaveBeenCalledWith("/mention-group/", payload);
            expect(result).toBe(created);
        });

        it("returns null when no token", async () => {
            mockedAuthApi.mockReturnValue(null);
            expect(
                await createMentionGroup("", {
                    team_id: "t",
                    group_name: "g",
                    created_by: "u",
                })
            ).toBeNull();
        });

        it("returns null and logs on error", async () => {
            const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const post = vi.fn().mockRejectedValue(new Error("nope"));
            mockedAuthApi.mockReturnValue({ post });

            const result = await createMentionGroup("tok", {
                team_id: "t",
                group_name: "g",
                created_by: "u",
            });

            expect(result).toBeNull();
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });

    describe("updateMentionGroup", () => {
        it("PUTs /mention-group/ with the payload and returns data", async () => {
            const updated = { groupId: 3, groupName: "Renamed" };
            const put = vi.fn().mockResolvedValue({ data: updated });
            mockedAuthApi.mockReturnValue({ put });

            const payload = { group_id: 3, group_name: "Renamed" };
            const result = await updateMentionGroup("tok", payload);

            expect(put).toHaveBeenCalledWith("/mention-group/", payload);
            expect(result).toBe(updated);
        });

        it("returns null when no token", async () => {
            mockedAuthApi.mockReturnValue(null);
            expect(await updateMentionGroup("", { group_id: 1 })).toBeNull();
        });

        it("returns null on error", async () => {
            const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const put = vi.fn().mockRejectedValue(new Error("x"));
            mockedAuthApi.mockReturnValue({ put });
            expect(await updateMentionGroup("tok", { group_id: 1 })).toBeNull();
            errSpy.mockRestore();
        });
    });

    describe("deleteMentionGroup", () => {
        it("DELETEs /mention-group/ with group_id and returns true", async () => {
            const del = vi.fn().mockResolvedValue({ data: {} });
            mockedAuthApi.mockReturnValue({ delete: del });

            const result = await deleteMentionGroup("tok", 42);

            expect(del).toHaveBeenCalledWith("/mention-group/?group_id=42");
            expect(result).toBe(true);
        });

        it("returns false when no token", async () => {
            mockedAuthApi.mockReturnValue(null);
            expect(await deleteMentionGroup("", 1)).toBe(false);
        });

        it("returns false and logs on error", async () => {
            const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const del = vi.fn().mockRejectedValue(new Error("fail"));
            mockedAuthApi.mockReturnValue({ delete: del });

            const result = await deleteMentionGroup("tok", 9);

            expect(result).toBe(false);
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });

    describe("addMentionGroupMembers", () => {
        it("POSTs /mention-group/members/ with payload and returns data", async () => {
            const data = { groupId: 1, memberUserIds: ["u1", "u2"], memberCount: 2 };
            const post = vi.fn().mockResolvedValue({ data });
            mockedAuthApi.mockReturnValue({ post });

            const payload = { group_id: 1, user_ids: ["u1", "u2"], added_by: "admin" };
            const result = await addMentionGroupMembers("tok", payload);

            expect(post).toHaveBeenCalledWith("/mention-group/members/", payload);
            expect(result).toBe(data);
        });

        it("returns null when no token", async () => {
            mockedAuthApi.mockReturnValue(null);
            expect(
                await addMentionGroupMembers("", { group_id: 1, user_ids: [], added_by: "a" })
            ).toBeNull();
        });

        it("returns null on error", async () => {
            const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const post = vi.fn().mockRejectedValue(new Error("x"));
            mockedAuthApi.mockReturnValue({ post });
            expect(
                await addMentionGroupMembers("tok", { group_id: 1, user_ids: [], added_by: "a" })
            ).toBeNull();
            errSpy.mockRestore();
        });
    });

    describe("removeMentionGroupMember", () => {
        it("DELETEs members with group_id and url-encoded user_id, returns data", async () => {
            const data = { groupId: 1, memberUserIds: ["u1"], memberCount: 1 };
            const del = vi.fn().mockResolvedValue({ data });
            mockedAuthApi.mockReturnValue({ delete: del });

            const result = await removeMentionGroupMember("tok", {
                group_id: 5,
                user_id: "user a@b",
            });

            // group_id is interpolated raw; user_id is encoded.
            expect(del).toHaveBeenCalledWith(
                "/mention-group/members/?group_id=5&user_id=user%20a%40b"
            );
            expect(result).toBe(data);
        });

        it("returns null when no token", async () => {
            mockedAuthApi.mockReturnValue(null);
            expect(await removeMentionGroupMember("", { group_id: 1, user_id: "u" })).toBeNull();
        });

        it("returns null on error", async () => {
            const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const del = vi.fn().mockRejectedValue(new Error("x"));
            mockedAuthApi.mockReturnValue({ delete: del });
            expect(
                await removeMentionGroupMember("tok", { group_id: 1, user_id: "u" })
            ).toBeNull();
            errSpy.mockRestore();
        });
    });
});

// ===========================================================================
// searchApi
// ===========================================================================
describe("searchApi.searchSpotlight", () => {
    it("POSTs /search/ with the body (token+signal stripped) and signal as config", async () => {
        const response = { query: "hello", results: [{ id: "r1" }] };
        const post = vi.fn().mockResolvedValue({ data: response });
        mockedAuthApi.mockReturnValue({ post });
        const controller = new AbortController();

        const result = await searchSpotlight({
            accessToken: "tok",
            signal: controller.signal,
            query: "hello",
            team_id: "t1",
            entity_types: ["chat"],
            limit: 10,
        });

        expect(authApi).toHaveBeenCalledWith("tok");
        expect(post).toHaveBeenCalledWith(
            "/search/",
            // accessToken and signal MUST be absent from the body.
            { query: "hello", team_id: "t1", entity_types: ["chat"], limit: 10 },
            { signal: controller.signal }
        );
        expect(result).toBe(response);
    });

    it("short-circuits to empty results when no token, without calling post", async () => {
        mockedAuthApi.mockReturnValue(null);

        const result = await searchSpotlight({
            accessToken: null,
            query: "q",
            team_id: "t",
        });

        expect(result).toEqual({ query: "q", results: [] });
    });

    it("propagates the error (no try/catch in searchSpotlight)", async () => {
        const post = vi.fn().mockRejectedValue(new Error("network down"));
        mockedAuthApi.mockReturnValue({ post });

        await expect(
            searchSpotlight({ accessToken: "tok", query: "q", team_id: "t" })
        ).rejects.toThrow("network down");
    });
});

// ===========================================================================
// agentApi — simple JSON GET helpers
// ===========================================================================
describe("agentApi GET helpers", () => {
    describe("fetchAgentUsage", () => {
        it("GETs /agent/usage/ with bearer auth and returns parsed json", async () => {
            const usage = { used: 3, limit: 10, is_unlimited: false };
            const fetchMock = vi.fn().mockResolvedValue(jsonResponse(usage));
            vi.stubGlobal("fetch", fetchMock);

            const result = await fetchAgentUsage("tok");

            expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/agent/usage/`, {
                headers: { Authorization: "Bearer tok" },
            });
            expect(result).toEqual(usage);
        });

        it("returns null when response not ok", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }))
            );
            expect(await fetchAgentUsage("tok")).toBeNull();
        });

        it("returns null when fetch throws", async () => {
            vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
            expect(await fetchAgentUsage("tok")).toBeNull();
        });
    });

    describe("fetchAgentFeatures", () => {
        it("GETs /agent/features/ and returns json", async () => {
            const features = {
                tier: "pro",
                llm_ask: { used: 1, limit: 100 },
                web_search: { used: 0, limit: 5 },
            };
            const fetchMock = vi.fn().mockResolvedValue(jsonResponse(features));
            vi.stubGlobal("fetch", fetchMock);

            const result = await fetchAgentFeatures("tok");

            expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/agent/features/`, {
                headers: { Authorization: "Bearer tok" },
            });
            expect(result).toEqual(features);
        });

        it("returns null on not-ok", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, { ok: false })));
            expect(await fetchAgentFeatures("tok")).toBeNull();
        });

        it("returns null when fetch rejects", async () => {
            vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("x")));
            expect(await fetchAgentFeatures("tok")).toBeNull();
        });
    });

    describe("fetchAgentModels", () => {
        it("GETs /agent/models/ and returns json", async () => {
            const models = {
                tier: "free",
                current: { provider: "openai", model: "gpt" },
                models: [],
                limits: { llm_ask: { used: 0, limit: 1 }, web_search: { used: 0, limit: 0 } },
            };
            const fetchMock = vi.fn().mockResolvedValue(jsonResponse(models));
            vi.stubGlobal("fetch", fetchMock);

            const result = await fetchAgentModels("tok");

            expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/agent/models/`, {
                headers: { Authorization: "Bearer tok" },
            });
            expect(result).toEqual(models);
        });

        it("returns null on not-ok", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, { ok: false })));
            expect(await fetchAgentModels("tok")).toBeNull();
        });

        it("returns null when fetch rejects", async () => {
            vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("x")));
            expect(await fetchAgentModels("tok")).toBeNull();
        });
    });

    describe("fetchAgentSessions", () => {
        it("GETs /agent/sessions/?team_id=... and returns sessions array", async () => {
            const sessions = [{ session_id: "s1" }];
            const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ sessions }));
            vi.stubGlobal("fetch", fetchMock);

            const result = await fetchAgentSessions({ accessToken: "tok", teamId: "team a" });

            expect(fetchMock).toHaveBeenCalledWith(
                `${API_BASE}/agent/sessions/?team_id=team%20a`,
                { headers: { Authorization: "Bearer tok" } }
            );
            expect(result).toEqual(sessions);
        });

        it("returns [] when the json has no sessions key", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));
            expect(await fetchAgentSessions({ accessToken: "tok", teamId: "t" })).toEqual([]);
        });

        it("returns [] without fetching when token or teamId missing", async () => {
            const fetchMock = vi.fn();
            vi.stubGlobal("fetch", fetchMock);

            expect(await fetchAgentSessions({ accessToken: "", teamId: "t" })).toEqual([]);
            expect(await fetchAgentSessions({ accessToken: "tok", teamId: "" })).toEqual([]);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("returns [] on not-ok and on throw", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, { ok: false })));
            expect(await fetchAgentSessions({ accessToken: "tok", teamId: "t" })).toEqual([]);

            vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("x")));
            expect(await fetchAgentSessions({ accessToken: "tok", teamId: "t" })).toEqual([]);
        });
    });

    describe("fetchAgentSessionDetail", () => {
        it("GETs /agent/sessions/<id>/?team_id=... and returns detail", async () => {
            const detail = { session_id: "abc", created_at: "x", last_active_at: "y", turns: [] };
            const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detail));
            vi.stubGlobal("fetch", fetchMock);

            const result = await fetchAgentSessionDetail({
                accessToken: "tok",
                teamId: "team a",
                sessionId: "sess/1",
            });

            expect(fetchMock).toHaveBeenCalledWith(
                `${API_BASE}/agent/sessions/sess%2F1/?team_id=team%20a`,
                { headers: { Authorization: "Bearer tok" } }
            );
            expect(result).toEqual(detail);
        });

        it("returns null without fetching when any arg missing", async () => {
            const fetchMock = vi.fn();
            vi.stubGlobal("fetch", fetchMock);

            expect(
                await fetchAgentSessionDetail({ accessToken: "", teamId: "t", sessionId: "s" })
            ).toBeNull();
            expect(
                await fetchAgentSessionDetail({ accessToken: "tok", teamId: "", sessionId: "s" })
            ).toBeNull();
            expect(
                await fetchAgentSessionDetail({ accessToken: "tok", teamId: "t", sessionId: "" })
            ).toBeNull();
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("returns null on not-ok and on throw", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, { ok: false })));
            expect(
                await fetchAgentSessionDetail({ accessToken: "tok", teamId: "t", sessionId: "s" })
            ).toBeNull();

            vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("x")));
            expect(
                await fetchAgentSessionDetail({ accessToken: "tok", teamId: "t", sessionId: "s" })
            ).toBeNull();
        });
    });
});

// ===========================================================================
// agentApi — fetchNoteSummary / fetchThreadSummary (POST, non-streaming)
// ===========================================================================
describe("agentApi summary helpers", () => {
    describe("fetchNoteSummary", () => {
        it("POSTs /agent/note-summary/ with snake_case body and returns parsed json", async () => {
            const payload = { summary: "s", generated: true };
            const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
            vi.stubGlobal("fetch", fetchMock);
            const controller = new AbortController();

            const result = await fetchNoteSummary({
                accessToken: "tok",
                teamId: "t1",
                noteContext: { noteType: 2, noteId: 99 },
                forceRegenerate: true,
                signal: controller.signal,
            });

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe(`${API_BASE}/agent/note-summary/`);
            expect(init.method).toBe("POST");
            expect(init.signal).toBe(controller.signal);
            expect(init.headers).toEqual({
                "Content-Type": "application/json",
                Authorization: "Bearer tok",
            });
            expect(JSON.parse(init.body)).toEqual({
                team_id: "t1",
                note_type: 2,
                note_id: 99,
                force_regenerate: true,
            });
            expect(result).toEqual(payload);
        });

        it("omits force_regenerate when not requested", async () => {
            const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
            vi.stubGlobal("fetch", fetchMock);

            await fetchNoteSummary({
                accessToken: "tok",
                teamId: "t1",
                noteContext: { noteType: 1, noteId: 1 },
            });

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body).not.toHaveProperty("force_regenerate");
        });

        it("throws notSignedIn when no token, without fetching", async () => {
            const fetchMock = vi.fn();
            vi.stubGlobal("fetch", fetchMock);
            await expect(
                fetchNoteSummary({
                    accessToken: null,
                    teamId: "t",
                    noteContext: { noteType: 1, noteId: 1 },
                })
            ).rejects.toThrow("Not signed in.");
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("throws server-error data.error when present on not-ok", async () => {
            vi.stubGlobal(
                "fetch",
                vi
                    .fn()
                    .mockResolvedValue(
                        jsonResponse({ error: "quota exceeded" }, { ok: false, status: 429 })
                    )
            );
            await expect(
                fetchNoteSummary({
                    accessToken: "tok",
                    teamId: "t",
                    noteContext: { noteType: 1, noteId: 1 },
                })
            ).rejects.toThrow("quota exceeded");
        });

        it("throws 'Server returned <status>' when not-ok body has no error", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 503,
                    json: async () => {
                        throw new Error("not json");
                    },
                } as unknown as Response)
            );
            await expect(
                fetchNoteSummary({
                    accessToken: "tok",
                    teamId: "t",
                    noteContext: { noteType: 1, noteId: 1 },
                })
            ).rejects.toThrow("Server returned 503");
        });
    });

    describe("fetchThreadSummary", () => {
        it("POSTs /agent/thread-summary/ with chat snake_case body", async () => {
            const payload = { summary: "x" };
            const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
            vi.stubGlobal("fetch", fetchMock);

            const result = await fetchThreadSummary({
                accessToken: "tok",
                teamId: "t1",
                threadContext: { chatType: 1, chatId: 2, threadId: 3 },
                forceRegenerate: true,
            });

            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe(`${API_BASE}/agent/thread-summary/`);
            expect(init.method).toBe("POST");
            expect(JSON.parse(init.body)).toEqual({
                team_id: "t1",
                chat_type: 1,
                chat_id: 2,
                thread_id: 3,
                force_regenerate: true,
            });
            expect(result).toEqual(payload);
        });

        it("throws notSignedIn when no token", async () => {
            vi.stubGlobal("fetch", vi.fn());
            await expect(
                fetchThreadSummary({
                    accessToken: null,
                    teamId: "t",
                    threadContext: { chatType: 1, chatId: 1, threadId: 1 },
                })
            ).rejects.toThrow("Not signed in.");
        });

        it("throws server error message on not-ok with data.error", async () => {
            vi.stubGlobal(
                "fetch",
                vi
                    .fn()
                    .mockResolvedValue(jsonResponse({ error: "boom" }, { ok: false, status: 500 }))
            );
            await expect(
                fetchThreadSummary({
                    accessToken: "tok",
                    teamId: "t",
                    threadContext: { chatType: 1, chatId: 1, threadId: 1 },
                })
            ).rejects.toThrow("boom");
        });
    });
});

// ===========================================================================
// agentApi — askAgentStream (body construction + NDJSON dispatch)
// ===========================================================================
describe("agentApi.askAgentStream", () => {
    it("calls onError(notSignedIn) and does not fetch when no token", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: null });

        expect(h.onError).toHaveBeenCalledWith("Not signed in.");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("POSTs /agent/ask/ with a minimal body (optional fields omitted)", async () => {
        const fetchMock = vi.fn().mockResolvedValue(streamResponse(['{"type":"done"}\n']));
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({
            ...h,
            query: "hi",
            teamId: "team1",
            accessToken: "tok",
        });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_BASE}/agent/ask/`);
        expect(init.method).toBe("POST");
        expect(init.headers).toEqual({
            "Content-Type": "application/json",
            Authorization: "Bearer tok",
        });
        const body = JSON.parse(init.body);
        expect(body).toEqual({
            query: "hi",
            team_id: "team1",
        });
        // Optional fields must be absent — the filter is search-only, so
        // the ask never carries entity_types.
        expect(body).not.toHaveProperty("entity_types");
        expect(body).not.toHaveProperty("session_id");
        expect(body).not.toHaveProperty("allow_web_search");
        expect(body).not.toHaveProperty("thread_context");
        expect(body).not.toHaveProperty("note_context");
        expect(body).not.toHaveProperty("new_conversation");
    });

    it("includes session_id only when provided", async () => {
        const fetchMock = vi.fn().mockResolvedValue(streamResponse(['{"type":"done"}\n']));
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({
            ...h,
            query: "q",
            teamId: "t",
            accessToken: "tok",
            sessionId: "sess-1",
        });

        expect(JSON.parse(fetchMock.mock.calls[0][1].body).session_id).toBe("sess-1");
    });

    it("never sends allow_web_search — gating is server-side", async () => {
        // Web search is gated by the backend from the persisted
        // `spotlight_web_search_enabled` preference; the per-request
        // flag was removed (a stale client could send it wrong and
        // silently drop the tool).
        const fetchMock = vi.fn().mockResolvedValue(streamResponse(['{"type":"done"}\n']));
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({
            ...h,
            query: "q",
            teamId: "t",
            accessToken: "tok",
        });
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("allow_web_search");
    });

    it("maps threadContext to nested snake_case thread_context", async () => {
        const fetchMock = vi.fn().mockResolvedValue(streamResponse(['{"type":"done"}\n']));
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({
            ...h,
            query: "q",
            teamId: "t",
            accessToken: "tok",
            threadContext: { chatType: 2, chatId: 5, threadId: 8 },
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.thread_context).toEqual({ chat_type: 2, chat_id: 5, thread_id: 8 });
    });

    it("maps noteContext to nested snake_case note_context and new_conversation flag", async () => {
        const fetchMock = vi.fn().mockResolvedValue(streamResponse(['{"type":"done"}\n']));
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({
            ...h,
            query: "q",
            teamId: "t",
            accessToken: "tok",
            noteContext: { noteType: 3, noteId: 12 },
            newConversation: true,
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.note_context).toEqual({ note_type: 3, note_id: 12 });
        expect(body.new_conversation).toBe(true);
    });

    it("dispatches sources, answer_delta, and done(session_id) in order", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                streamResponse([
                    '{"type":"sources","sources":[{"id":"r1"}]}\n',
                    '{"type":"answer_delta","text":"Hello "}\n',
                    '{"type":"answer_delta","text":"world"}\n',
                    '{"type":"done","session_id":"S42","run_id":"R42"}\n',
                ])
            );
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onSources).toHaveBeenCalledWith([{ id: "r1" }]);
        expect(h.onDelta).toHaveBeenNthCalledWith(1, "Hello ");
        expect(h.onDelta).toHaveBeenNthCalledWith(2, "world");
        // onDone now receives (session_id, run_id) — run_id is the F1 feedback target.
        expect(h.onDone).toHaveBeenCalledWith("S42", "R42");
        expect(h.onError).not.toHaveBeenCalled();
    });

    it("handles events split across chunk boundaries", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                streamResponse(['{"type":"answer_de', 'lta","text":"x"}\n{"type":"done"}\n'])
            );
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onDelta).toHaveBeenCalledWith("x");
        expect(h.onDone).toHaveBeenCalledWith(undefined, undefined);
    });

    it("dispatches tool_call_* and pending_approval events (pending is terminal)", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                streamResponse([
                    '{"type":"tool_call_start","step":1,"tool_name":"search","arguments":{"q":"x"}}\n',
                    '{"type":"tool_call_result","step":1,"tool_name":"search","summary":"ok"}\n',
                    '{"type":"tool_call_error","step":2,"tool_name":"write","error":"denied"}\n',
                    '{"type":"tool_call_pending_approval","step":3,"tool_name":"write","arguments":{"a":1},"approval_token":"AT","run_id":"RID"}\n',
                ])
            );
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onToolStart).toHaveBeenCalledWith({
            step: 1,
            tool_name: "search",
            arguments: { q: "x" },
        });
        expect(h.onToolResult).toHaveBeenCalledWith({
            step: 1,
            tool_name: "search",
            summary: "ok",
        });
        expect(h.onToolError).toHaveBeenCalledWith({
            step: 2,
            tool_name: "write",
            error: "denied",
        });
        expect(h.onPendingApproval).toHaveBeenCalledWith({
            step: 3,
            tool_name: "write",
            arguments: { a: 1 },
            approval_token: "AT",
            run_id: "RID",
        });
        // pending_approval is a clean terminal event -> no streamEndedUnexpectedly.
        expect(h.onError).not.toHaveBeenCalled();
    });

    it("dispatches an error event via onError and treats it as terminal", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                streamResponse(['{"type":"error","message":"backend exploded"}\n'])
            );
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onError).toHaveBeenCalledTimes(1);
        expect(h.onError).toHaveBeenCalledWith("backend exploded");
    });

    it("uses unknownError when an error event has no message", async () => {
        const fetchMock = vi.fn().mockResolvedValue(streamResponse(['{"type":"error"}\n']));
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onError).toHaveBeenCalledWith("Unknown error");
    });

    it("reports a malformed NDJSON line via onError (non-terminal: also reports streamEndedUnexpectedly)", async () => {
        const fetchMock = vi.fn().mockResolvedValue(streamResponse(["not json at all\n"]));
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        // A malformed line is NOT a terminal event (dispatchLine returns false),
        // so the stream-closed-cleanly guard still trips at the end -> two errors.
        expect(h.onError).toHaveBeenCalledTimes(2);
        expect(h.onError).toHaveBeenNthCalledWith(1, "Malformed NDJSON line: not json at all");
        expect(h.onError).toHaveBeenNthCalledWith(
            2,
            "The answer stream ended unexpectedly. Please try again."
        );
    });

    it("reports a single malformed-line error when a terminal event follows", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(streamResponse(["garbage\n", '{"type":"done"}\n']));
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onError).toHaveBeenCalledTimes(1);
        expect(h.onError).toHaveBeenCalledWith("Malformed NDJSON line: garbage");
        expect(h.onDone).toHaveBeenCalledWith(undefined, undefined);
    });

    it("reports streamEndedUnexpectedly when no terminal event arrives", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(streamResponse(['{"type":"answer_delta","text":"x"}\n']));
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onDelta).toHaveBeenCalledWith("x");
        expect(h.onError).toHaveBeenCalledWith(
            "The answer stream ended unexpectedly. Please try again."
        );
    });

    it("dispatches a terminal event in the un-newline-terminated tail", async () => {
        // Last chunk has no trailing newline -> exercises the tail-flush path.
        const fetchMock = vi.fn().mockResolvedValue(streamResponse(['{"type":"done"}']));
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onDone).toHaveBeenCalledWith(undefined, undefined);
        expect(h.onError).not.toHaveBeenCalled();
    });

    it("reports serverReturned <status> when the response is not ok", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => {
                throw new Error("no json");
            },
            text: async () => "",
        } as unknown as Response);
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onError).toHaveBeenCalledWith("Server returned 500");
    });

    it("prefers data.error message on a not-ok response", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                jsonResponse({ error: "rate limited" }, { ok: false, status: 429 })
            );
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onError).toHaveBeenCalledWith("rate limited");
    });

    it("falls back to response text (truncated) on a not-ok response with non-json body", async () => {
        const longText = "E".repeat(300);
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 502,
            json: async () => {
                throw new Error("not json");
            },
            text: async () => longText,
        } as unknown as Response);
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onError).toHaveBeenCalledWith("E".repeat(200));
    });

    it("reports networkError when fetch rejects with a non-abort error", async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error("connection refused"));
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onError).toHaveBeenCalledWith("Network error: connection refused");
    });

    it("silently swallows an AbortError from fetch (onError NOT called)", async () => {
        const abort = new Error("aborted");
        abort.name = "AbortError";
        const fetchMock = vi.fn().mockRejectedValue(abort);
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onError).not.toHaveBeenCalled();
    });

    it("reports streamNoBody when the response has no readable body", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            body: null,
        } as unknown as Response);
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onError).toHaveBeenCalledWith("Streaming response has no body.");
    });

    it("silently swallows an AbortError thrown mid-stream by the reader", async () => {
        const abort = new Error("aborted");
        abort.name = "AbortError";
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            body: {
                getReader: () => ({
                    read: async () => {
                        throw abort;
                    },
                    releaseLock: () => {},
                }),
            },
        } as unknown as Response);
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onError).not.toHaveBeenCalled();
    });

    it("reports streamInterrupted when the reader throws a non-abort error", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            body: {
                getReader: () => ({
                    read: async () => {
                        throw new Error("socket reset");
                    },
                    releaseLock: () => {},
                }),
            },
        } as unknown as Response);
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await askAgentStream({ ...h, query: "q", teamId: "t", accessToken: "tok" });

        expect(h.onError).toHaveBeenCalledWith("Stream interrupted: socket reset");
    });
});

// ===========================================================================
// agentApi — decideAgent
// ===========================================================================
describe("agentApi.decideAgent", () => {
    it("calls onError(notSignedIn) and does not fetch when no token", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await decideAgent({
            ...h,
            runId: "R",
            approvalToken: "AT",
            decision: "approve",
            accessToken: null,
        });

        expect(h.onError).toHaveBeenCalledWith("Not signed in.");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("POSTs /agent/decide/ with run_id, approval_token, decision and streams done", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(streamResponse(['{"type":"done","session_id":"S1"}\n']));
        vi.stubGlobal("fetch", fetchMock);
        const h = makeHandlers();

        await decideAgent({
            ...h,
            runId: "RID",
            approvalToken: "TOKEN",
            decision: "reject",
            accessToken: "tok",
        });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_BASE}/agent/decide/`);
        expect(init.method).toBe("POST");
        expect(init.headers.Authorization).toBe("Bearer tok");
        expect(JSON.parse(init.body)).toEqual({
            run_id: "RID",
            approval_token: "TOKEN",
            decision: "reject",
        });
        expect(h.onDone).toHaveBeenCalledWith("S1", undefined);
    });
});

// ===========================================================================
// v3Api.v3ApiBaseURL
// ===========================================================================
describe("v3Api.v3ApiBaseURL", () => {
    const ENV = import.meta.env as Record<string, unknown>;
    const origDjango = ENV.VITE_DJANGO_URL;
    const origLegacy = ENV.VITE_API_BASE_URL;

    afterEach(() => {
        ENV.VITE_DJANGO_URL = origDjango;
        ENV.VITE_API_BASE_URL = origLegacy;
    });

    it("returns the explicit VITE_DJANGO_URL with any trailing slash stripped", () => {
        ENV.VITE_DJANGO_URL = "http://django.example.com/";
        expect(v3ApiBaseURL()).toBe("http://django.example.com");
    });

    it("falls back to legacy VITE_API_BASE_URL and strips the /api/v2 suffix", () => {
        ENV.VITE_DJANGO_URL = "";
        ENV.VITE_API_BASE_URL = "http://host.example.com/api/v2/";
        expect(v3ApiBaseURL()).toBe("http://host.example.com");
    });

    it("strips an /api/v3 suffix from the legacy base too", () => {
        ENV.VITE_DJANGO_URL = "";
        ENV.VITE_API_BASE_URL = "https://api.example.com/api/v3";
        expect(v3ApiBaseURL()).toBe("https://api.example.com");
    });

    it("strips a trailing slash when there is no /api/vN suffix", () => {
        ENV.VITE_DJANGO_URL = "";
        ENV.VITE_API_BASE_URL = "https://api.example.com/";
        expect(v3ApiBaseURL()).toBe("https://api.example.com");
    });

    it("returns an empty string when both env vars are empty", () => {
        ENV.VITE_DJANGO_URL = "";
        ENV.VITE_API_BASE_URL = "";
        expect(v3ApiBaseURL()).toBe("");
    });
});
