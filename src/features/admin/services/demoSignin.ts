import axios from "axios";

import { getMessages, type Locale } from "../../../i18n";
import { nonAuthApi } from "../../../services/api";
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
        // The demo workspace is seeded synchronously by this request, so the
        // language has to travel WITH it — there's no later call that could
        // re-seed 3 months of Japanese chat history in the right language.
        const body = locale && DEMO_LANGS.has(locale) ? { lang: locale } : {};
        const res = await api.post<DemoSignInResponse>("/user/demo/", body);
        return res.data;
    } catch (error: unknown) {
        const m = getMessages().admin.auth.errors;
        if (axios.isAxiosError(error)) {
            if (!error.response) {
                console.error("Network error:", error.message);
                setErrorMessage?.(m.network);
            } else if (error.response.status === 429) {
                console.error("Demo signin rate-limited:", error.response.data);
                setErrorMessage?.(m.demoRateLimited);
            } else {
                console.error("API error:", error.response.status, error.response.data);
                setErrorMessage?.(m.demoFailed);
            }
        } else {
            console.error("Unexpected error:", error);
            setErrorMessage?.(m.unexpected);
        }
    }
};
