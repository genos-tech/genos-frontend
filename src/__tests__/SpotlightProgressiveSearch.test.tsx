// Progressive Spotlight search: the debounced query fires TWO passes —
// an instant keyword-only pass (use_vector: false, no query embedding
// server-side) that paints first, and the authoritative hybrid pass
// that replaces it. These tests pin the ordering contract:
//   1. keyword results render before hybrid lands;
//   2. hybrid results replace keyword results;
//   3. a keyword response arriving AFTER hybrid is ignored;
//   4. hybrid failure keeps keyword results (no error banner) but
//      surfaces the error when nothing rendered at all.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSpotlight } from "../features/spotlight/useSpotlight";
import { searchSpotlight } from "../services/searchApi";

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(),
    decideAgent: vi.fn(),
    fetchAgentSessionDetail: vi.fn(async () => null),
    fetchAgentSessions: vi.fn(async () => []),
    fetchAgentUsage: vi.fn(async () => null),
    submitAgentFeedback: vi.fn(async () => true),
}));

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(),
}));

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const mockSearch = vi.mocked(searchSpotlight);

const result = (id: string) => ({ entity_id: id }) as never;

type Deferred = {
    resolve: (results: unknown[]) => void;
    reject: (err: unknown) => void;
};

// Route the two passes to separate deferreds so each test controls
// exactly when the keyword and hybrid responses land.
const armSearchMock = () => {
    const lanes: { keyword: Deferred; hybrid: Deferred } = {
        keyword: undefined as never,
        hybrid: undefined as never,
    };
    mockSearch.mockImplementation(
        ({ use_vector, query }) =>
            new Promise((resolve, reject) => {
                lanes[use_vector ? "hybrid" : "keyword"] = {
                    resolve: (results) => resolve({ query, results } as never),
                    reject,
                };
            })
    );
    return lanes;
};

const openAndType = async (query: string) => {
    const hook = renderHook(() => useSpotlight({ accessToken: "token", teamId: "team-1" }));
    act(() => {
        hook.result.current.open();
        hook.result.current.setQuery(query);
    });
    // Let the 250ms debounce fire and both passes get issued.
    await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
    });
    return hook;
};

describe("Spotlight progressive search", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("paints keyword results first, then replaces them with hybrid results", async () => {
        const lanes = armSearchMock();
        const hook = await openAndType("roadmap");
        expect(mockSearch).toHaveBeenCalledTimes(2);

        await act(async () => {
            lanes.keyword.resolve([result("kw-1")]);
        });
        expect(hook.result.current.results).toEqual([result("kw-1")]);
        expect(hook.result.current.isLoading).toBe(false);

        await act(async () => {
            lanes.hybrid.resolve([result("hy-1"), result("hy-2")]);
        });
        expect(hook.result.current.results).toEqual([result("hy-1"), result("hy-2")]);
    });

    it("ignores a keyword response that arrives after hybrid already landed", async () => {
        const lanes = armSearchMock();
        const hook = await openAndType("roadmap");

        await act(async () => {
            lanes.hybrid.resolve([result("hy-1")]);
        });
        await act(async () => {
            lanes.keyword.resolve([result("kw-late")]);
        });
        expect(hook.result.current.results).toEqual([result("hy-1")]);
    });

    it("keeps keyword results without an error banner when the hybrid pass fails", async () => {
        const lanes = armSearchMock();
        const hook = await openAndType("roadmap");

        await act(async () => {
            lanes.keyword.resolve([result("kw-1")]);
        });
        await act(async () => {
            lanes.hybrid.reject(new Error("opensearch down"));
        });
        expect(hook.result.current.results).toEqual([result("kw-1")]);
        expect(hook.result.current.error).toBeNull();
    });

    it("surfaces the error when both passes produce nothing to show", async () => {
        const lanes = armSearchMock();
        const hook = await openAndType("roadmap");

        await act(async () => {
            lanes.keyword.reject(new Error("bm25 down"));
        });
        await act(async () => {
            lanes.hybrid.reject(new Error("opensearch down"));
        });
        expect(hook.result.current.error).not.toBeNull();
        expect(hook.result.current.results).toEqual([]);
    });
});
