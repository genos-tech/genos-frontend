import axios from "axios";

import { getMessages, type Locale } from "../../../i18n";
import { authApi, nonAuthApi } from "../../../services/api";
import { trackDemoSignInFailed } from "../../../services/demoFunnel";
import { DemoSignInResponse } from "../../../types/admin";

/**
 * Languages the API has a demo content table for. Anything else must be
 * *omitted* rather than sent: the endpoint falls back to `Accept-Language`
 * when no `lang` is given, which is a better guess for, say, a French visitor
 * than us insisting on English on their behalf.
 */
const DEMO_LANGS = new Set<string>(["en", "ja"]);

export const demoSignIn = async (
    setErrorMessage?: (value: string) => void,
    locale?: Locale
): Promise<DemoSignInResponse | undefined> => {
    try {
        const api = nonAuthApi();
        // The workspace content is built in the background after this request
        // returns (MIP-1879), but its language is fixed by this call — there's
        // no later call that could re-seed 3 months of Japanese chat history
        // in the right language.
        const body = locale && DEMO_LANGS.has(locale) ? { lang: locale } : {};
        const res = await api.post<DemoSignInResponse>("/user/demo/", body);
        return res.data;
    } catch (error: unknown) {
        // Reported here rather than at the call site because only this function
        // can tell the branches apart — the caller just sees `undefined`. A
        // drop in `demo_started` means nothing without knowing whether the
        // throttle, the network or the seeder was the cause.
        const m = getMessages().admin.auth.errors;
        if (axios.isAxiosError(error)) {
            if (!error.response) {
                console.error("Network error:", error.message);
                setErrorMessage?.(m.network);
                trackDemoSignInFailed("network");
            } else if (error.response.status === 429) {
                console.error("Demo signin rate-limited:", error.response.data);
                setErrorMessage?.(m.demoRateLimited);
                trackDemoSignInFailed("rate_limited");
            } else {
                console.error("API error:", error.response.status, error.response.data);
                setErrorMessage?.(m.demoFailed);
                trackDemoSignInFailed("error");
            }
        } else {
            console.error("Unexpected error:", error);
            setErrorMessage?.(m.unexpected);
            trackDemoSignInFailed("unexpected");
        }
    }
};

/**
 * Is the demo visitor's sample workspace built yet? (MIP-1879) `gone` means the api no longer
 * knows a demo team for this user (404): nothing to wait for. A network error reads as `pending`,
 * so one dropped request does not end the wait; the caller's own timeout does.
 */
export const postDemoWorkspaceStatus = async (
    accessToken: string
): Promise<"ready" | "pending" | "failed" | "gone"> => {
    const api = authApi(accessToken);
    if (!api) return "pending";
    try {
        const res = await api.post<{ status: "ready" | "pending" | "failed" }>(
            "/user/demo/workspace/"
        );
        return res.data.status;
    } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 404) return "gone";
        return "pending";
    }
};
