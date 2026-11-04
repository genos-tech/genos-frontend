import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLazyPrDetail } from "../features/integrations/hooks/useLazyPrDetail";
import { getCachedOrFetchPrStatus } from "../features/integrations/services/prStatusCache";

vi.mock("../features/integrations/services/prStatusCache", () => ({
    getCachedOrFetchPrStatus: vi.fn(),
}));

const mockStatus = vi.mocked(getCachedOrFetchPrStatus);
const URL_7 = "https://github.com/acme/rocket/pull/7";
const ok = { kind: "ok", payload: { pull: { number: 7 } } } as never;

beforeEach(() => {
    mockStatus.mockReset();
});

describe("useLazyPrDetail", () => {
    it("sends nothing until it is asked", async () => {
        const { result } = renderHook(() => useLazyPrDetail("tok", URL_7));
        await act(async () => {});

        expect(mockStatus).not.toHaveBeenCalled();
        expect(result.current.detail).toBeNull();
    });

    it("asks once when asked, and hands back the payload", async () => {
        mockStatus.mockResolvedValue(ok);
        const { result } = renderHook(() => useLazyPrDetail("tok", URL_7));

        await act(async () => {
            result.current.ask();
        });
        await act(async () => {
            result.current.ask();
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(mockStatus).toHaveBeenCalledWith("tok", URL_7);
        expect(result.current.detail).toEqual({ pull: { number: 7 } });
    });

    it.each([
        ["an error", { kind: "error" }],
        ["GitHub not connected", { kind: "github_not_connected" }],
    ])("%s leaves the detail null and is not retried", async (_name, answer) => {
        mockStatus.mockResolvedValue(answer as never);
        const { result } = renderHook(() => useLazyPrDetail("tok", URL_7));

        await act(async () => {
            result.current.ask();
        });
        await act(async () => {
            result.current.ask();
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(result.current.detail).toBeNull();
    });

    it("sends nothing without a session or a url, even when asked", async () => {
        for (const [token, url] of [
            [null, URL_7],
            ["", URL_7],
            ["tok", null],
            ["tok", ""],
        ] as const) {
            const { result } = renderHook(() => useLazyPrDetail(token, url));
            await act(async () => {
                result.current.ask();
            });
        }

        expect(mockStatus).not.toHaveBeenCalled();
    });
});
