import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services/api";

const PREF_URL = "/user/preferences/content-length/";

/** The three levels the API accepts, in the order the setting lists them. */
export const CONTENT_LENGTHS = ["short", "standard", "long"] as const;
export type ContentLength = (typeof CONTENT_LENGTHS)[number];

export const DEFAULT_CONTENT_LENGTH: ContentLength = "standard";

/**
 * What the screen shows for whatever the server sent. A missing, empty or unknown value (a newer
 * server with a fourth level, an old row) reads as Standard, which is what the API itself treats
 * a null as, instead of leaving the group with nothing selected.
 */
export const normalizeContentLength = (raw: unknown): ContentLength => {
    if (typeof raw !== "string") return DEFAULT_CONTENT_LENGTH;
    const value = raw.trim().toLowerCase();
    return (CONTENT_LENGTHS as readonly string[]).includes(value)
        ? (value as ContentLength)
        : DEFAULT_CONTENT_LENGTH;
};

export type ContentLengthStatus = "loading" | "ready" | "error";

/**
 * "How much Genos writes" (MIP-1540): how long the task, milestone and note bodies and the plans
 * Genos writes for the member are. Server-backed and account-wide,
 * `GET/PATCH /user/preferences/content-length/` with `{ content_length: "short" | "standard" | "long" }`.
 *
 * The change is optimistic: `value` moves at once and `setValue` resolves to whether the server
 * kept it. On a failure `value` goes back to the last level the server confirmed and the caller
 * decides how to say so (it owns the strings). Several quick changes are safe: only the latest
 * request decides what is shown when it settles.
 *
 * `value` is `null` until the first GET answers. A failed GET leaves `status: "error"` rather than
 * showing Standard, which would be a guess that hides a saved Short or Long.
 */
export const useContentLengthPreference = () => {
    const { accessToken } = useAuth();
    const [value, setValueState] = useState<ContentLength | null>(null);
    const [status, setStatus] = useState<ContentLengthStatus>("loading");
    const [reloadKey, setReloadKey] = useState(0);
    // The last level the server said it holds: what a failed save goes back to.
    const confirmedRef = useRef<ContentLength | null>(null);
    // Bumped by every save, so a slow earlier answer cannot overwrite a later choice.
    const saveSeqRef = useRef(0);

    useEffect(() => {
        let cancelled = false;
        const api = authApi(accessToken);
        if (!api) {
            confirmedRef.current = null;
            setValueState(null);
            setStatus("error");
            return;
        }
        setStatus("loading");
        (async () => {
            try {
                const res = await api.get<{ content_length?: unknown }>(PREF_URL, {
                    suppressErrorToast: true,
                });
                if (cancelled) return;
                const next = normalizeContentLength(res.data?.content_length);
                confirmedRef.current = next;
                setValueState(next);
                setStatus("ready");
            } catch {
                if (cancelled) return;
                confirmedRef.current = null;
                setValueState(null);
                setStatus("error");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken, reloadKey]);

    const setValue = useCallback(
        async (next: ContentLength): Promise<boolean> => {
            const api = authApi(accessToken);
            if (!api) return false;
            const seq = ++saveSeqRef.current;
            setValueState(next);
            try {
                const res = await api.patch<{ content_length?: unknown }>(
                    PREF_URL,
                    { content_length: next },
                    // The caller shows its own, translated, message.
                    { suppressErrorToast: true }
                );
                // Trust the server's echo; fall back to what was asked for.
                const stored =
                    res.data?.content_length === undefined
                        ? next
                        : normalizeContentLength(res.data.content_length);
                confirmedRef.current = stored;
                if (seq === saveSeqRef.current) setValueState(stored);
                return true;
            } catch {
                if (seq === saveSeqRef.current) setValueState(confirmedRef.current);
                return false;
            }
        },
        [accessToken]
    );

    const reload = useCallback(() => setReloadKey((k) => k + 1), []);

    return { value, status, setValue, reload };
};
