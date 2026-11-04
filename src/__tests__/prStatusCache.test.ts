/**
 * PR detail is one request per PR, however many components ask for it at once
 * (MIP-989).
 *
 * Opening a task asks for each linked PR from the table's PR column
 * (`PrStatusCell`) and from the task preview (`LinkedPrCard`) at the same
 * moment, and every call is three GitHub calls on the server. Callers that ask
 * for a PR whose request is still in flight now share it. What is kept after
 * it settles is unchanged: an `ok` answer for 60 s, nothing else.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPullDetail } from "../features/integrations/services/github";
import {
    clearPrStatusCache,
    getCachedOrFetchPrStatus,
} from "../features/integrations/services/prStatusCache";

vi.mock("../features/integrations/services/github", () => ({
    getPullDetail: vi.fn(),
}));

const mockGetPullDetail = vi.mocked(getPullDetail);

const URL_7 = "https://github.com/acme/rocket/pull/7";
const URL_8 = "https://github.com/acme/rocket/pull/8";

const detail = (number: number) =>
    ({
        pull: { number, title: `PR ${number}` },
        combined_status: null,
        check_runs: null,
    }) as never;

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

type Detail = Awaited<ReturnType<typeof getPullDetail>>;

beforeEach(() => {
    clearPrStatusCache();
    mockGetPullDetail.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("callers that ask while the request is in flight", () => {
    it("share one request", async () => {
        const d = deferred<Detail>();
        mockGetPullDetail.mockReturnValue(d.promise);

        const all = [
            getCachedOrFetchPrStatus("tok", URL_7),
            getCachedOrFetchPrStatus("tok", URL_7),
            getCachedOrFetchPrStatus("tok", URL_7),
        ];
        d.resolve(detail(7));
        const results = await Promise.all(all);

        expect(mockGetPullDetail).toHaveBeenCalledTimes(1);
        expect(mockGetPullDetail).toHaveBeenCalledWith("tok", "acme", "rocket", 7, undefined);
        for (const r of results) {
            expect(r).toEqual({ kind: "ok", payload: detail(7) });
        }
    });

    it("do not share across PRs", async () => {
        mockGetPullDetail.mockImplementation(
            async (_tok, _owner, _repo, number) => detail(number) as never
        );

        const [a, b] = await Promise.all([
            getCachedOrFetchPrStatus("tok", URL_7),
            getCachedOrFetchPrStatus("tok", URL_8),
        ]);

        expect(mockGetPullDetail).toHaveBeenCalledTimes(2);
        expect(a).toMatchObject({ kind: "ok", payload: { pull: { number: 7 } } });
        expect(b).toMatchObject({ kind: "ok", payload: { pull: { number: 8 } } });
    });

    it("a caller that arrives after the answer is served from the memo", async () => {
        mockGetPullDetail.mockResolvedValue(detail(7));

        await getCachedOrFetchPrStatus("tok", URL_7);
        const again = await getCachedOrFetchPrStatus("tok", URL_7);

        expect(mockGetPullDetail).toHaveBeenCalledTimes(1);
        expect(again).toEqual({ kind: "ok", payload: detail(7) });
    });
});

describe("what is kept", () => {
    it("an ok answer lives 60 seconds", async () => {
        vi.useFakeTimers();
        mockGetPullDetail.mockResolvedValue(detail(7));

        await getCachedOrFetchPrStatus("tok", URL_7);
        vi.advanceTimersByTime(59_000);
        await getCachedOrFetchPrStatus("tok", URL_7);
        expect(mockGetPullDetail).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(2_000);
        await getCachedOrFetchPrStatus("tok", URL_7);
        expect(mockGetPullDetail).toHaveBeenCalledTimes(2);
    });

    it("an error is shared by those waiting, then asked again", async () => {
        const d = deferred<Detail>();
        mockGetPullDetail.mockReturnValueOnce(d.promise);

        const waiting = [
            getCachedOrFetchPrStatus("tok", URL_7),
            getCachedOrFetchPrStatus("tok", URL_7),
        ];
        d.resolve(null);
        expect(await Promise.all(waiting)).toEqual([{ kind: "error" }, { kind: "error" }]);
        expect(mockGetPullDetail).toHaveBeenCalledTimes(1);

        // The next call is a new request, and it heals.
        mockGetPullDetail.mockResolvedValueOnce(detail(7));
        expect(await getCachedOrFetchPrStatus("tok", URL_7)).toEqual({
            kind: "ok",
            payload: detail(7),
        });
        expect(mockGetPullDetail).toHaveBeenCalledTimes(2);
    });

    it("'GitHub not connected' is shared by those waiting, then asked again", async () => {
        const d = deferred<Detail>();
        mockGetPullDetail.mockReturnValueOnce(d.promise);

        const waiting = [
            getCachedOrFetchPrStatus("tok", URL_7),
            getCachedOrFetchPrStatus("tok", URL_7),
        ];
        d.resolve("github_not_connected");
        expect(await Promise.all(waiting)).toEqual([
            { kind: "github_not_connected" },
            { kind: "github_not_connected" },
        ]);
        expect(mockGetPullDetail).toHaveBeenCalledTimes(1);

        mockGetPullDetail.mockResolvedValueOnce(detail(7));
        expect(await getCachedOrFetchPrStatus("tok", URL_7)).toMatchObject({ kind: "ok" });
        expect(mockGetPullDetail).toHaveBeenCalledTimes(2);
    });

    it("a request that throws rejects for everyone waiting and leaves nothing behind", async () => {
        const d = deferred<Detail>();
        mockGetPullDetail.mockReturnValueOnce(d.promise);

        const waiting = [
            getCachedOrFetchPrStatus("tok", URL_7),
            getCachedOrFetchPrStatus("tok", URL_7),
        ].map((p) =>
            p.then(
                () => "resolved",
                (e: Error) => e.message
            )
        );
        d.reject(new Error("boom"));
        expect(await Promise.all(waiting)).toEqual(["boom", "boom"]);

        mockGetPullDetail.mockResolvedValueOnce(detail(7));
        expect(await getCachedOrFetchPrStatus("tok", URL_7)).toMatchObject({ kind: "ok" });
        expect(mockGetPullDetail).toHaveBeenCalledTimes(2);
    });

    it("clearing drops what is kept and what is in flight", async () => {
        mockGetPullDetail.mockResolvedValue(detail(7));
        await getCachedOrFetchPrStatus("tok", URL_7);

        clearPrStatusCache();
        await getCachedOrFetchPrStatus("tok", URL_7);
        expect(mockGetPullDetail).toHaveBeenCalledTimes(2);

        const d = deferred<Detail>();
        mockGetPullDetail.mockReturnValueOnce(d.promise);
        clearPrStatusCache();
        const first = getCachedOrFetchPrStatus("tok", URL_7);
        clearPrStatusCache();
        mockGetPullDetail.mockResolvedValueOnce(detail(7));
        const second = getCachedOrFetchPrStatus("tok", URL_7);
        d.resolve(detail(7));
        await Promise.all([first, second]);
        expect(mockGetPullDetail).toHaveBeenCalledTimes(4);
    });
});

describe("what is not a PR", () => {
    it("a URL that is not a pull request URL is an error and sends nothing", async () => {
        for (const url of [
            "",
            "https://github.com/acme/rocket",
            "https://github.com/acme/rocket/issues/7",
            "https://example.com/acme/rocket/pull/7",
        ]) {
            expect(await getCachedOrFetchPrStatus("tok", url)).toEqual({ kind: "error" });
        }
        expect(mockGetPullDetail).not.toHaveBeenCalled();
    });
});
