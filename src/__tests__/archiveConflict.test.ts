/**
 * A write refused because the project or group chat is archived (MIP-1693).
 *
 * The API answers 409 with `code: "archived"`. That must reach the user as the archived
 * message, not as the generic "request failed" toast.
 */
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";

import { authApi } from "../services/api";
import { subscribeRequestErrors, type RequestErrorKind } from "../services/requestErrorNotifier";

// Each `authApi` call builds its own instance, so the test stubs the one it posts through.
const refusingApi = (status: number, data: unknown) => {
    const api = authApi("tok");
    if (!api) throw new Error("no api");
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const response: AxiosResponse = { data, status, statusText: "", headers: {}, config };
        throw new AxiosError("refused", "ERR_BAD_REQUEST", config, {}, response);
    };
    return api;
};

const kindsFrom = async (
    send: () => Promise<unknown>
): Promise<{ kinds: RequestErrorKind[]; error: unknown }> => {
    const kinds: RequestErrorKind[] = [];
    const stop = subscribeRequestErrors((kind) => kinds.push(kind));
    let error: unknown = null;
    try {
        await send();
    } catch (e) {
        error = e;
    } finally {
        stop();
    }
    return { kinds, error };
};

describe("409 archived", () => {
    it("tells the user the item is archived, not that the request failed", async () => {
        const api = refusingApi(409, {
            error: "This is archived and read-only. Restore it to make changes.",
            code: "archived",
        });
        const { kinds, error } = await kindsFrom(() => api.post("/task/", {}));
        expect(error).toBeInstanceOf(AxiosError);
        expect(kinds).toEqual(["archived"]);
    });

    it("keeps the generic conflict toast for a 409 that is not an archive", async () => {
        const api = refusingApi(409, { error: "Someone else changed it." });
        const { kinds, error } = await kindsFrom(() => api.post("/task/", {}));
        expect(error).toBeInstanceOf(AxiosError);
        expect(kinds).toEqual(["requestFailed"]);
    });
});
