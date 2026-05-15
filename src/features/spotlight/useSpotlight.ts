// Spotlight overlay state + behavior:
//   - Cmd-K (mac) / Ctrl-K (others) toggles the overlay open.
//   - Escape closes it.
//   - Typing in the search input fires debounced searches against
//     /api/v2/search/. Results render live. AI is NOT invoked.
//   - Pressing Enter (or clicking the "Ask" button in the overlay)
//     calls `onAsk(query)` — Phase 1 stub: logs + does nothing.
//     Phase 2 will swap this for a call to /api/v2/agent/ask.
//
// Stale-response protection: each new query starts a fresh
// AbortController. When the user types fast we abort prior in-flight
// requests so older responses can never overwrite newer ones in the UI.

import { useCallback, useEffect, useRef, useState } from "react";
import axios, { CanceledError } from "axios";

import { searchSpotlight } from "../../services/searchApi";
import { isMac } from "../../utils/platform";
import type { SpotlightResult } from "./types";

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 20;

export interface UseSpotlightArgs {
    accessToken: string | null;
    teamId: string | null | undefined;
}

export interface UseSpotlightReturn {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    query: string;
    setQuery: (q: string) => void;
    results: SpotlightResult[];
    isLoading: boolean;
    error: string | null;
    onAsk: () => void;
}

export const useSpotlight = ({ accessToken, teamId }: UseSpotlightArgs): UseSpotlightReturn => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SpotlightResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Used to abort in-flight searches when the query changes or the
    // overlay closes.
    const abortRef = useRef<AbortController | null>(null);
    // Read latest open state from inside the global keydown listener
    // without re-registering it on every render.
    const isOpenRef = useRef(isOpen);
    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    // ---- Global keyboard shortcut: Cmd-K / Ctrl-K toggles. ----
    useEffect(() => {
        const mac = isMac();

        const handleKeyDown = (e: KeyboardEvent) => {
            const isToggle = e.key.toLowerCase() === "k" && (mac ? e.metaKey : e.ctrlKey);
            if (isToggle) {
                // Don't fight system-level Cmd-K behaviors inside text
                // inputs that explicitly handle it (e.g. some editors),
                // but for the app shell this is what we want.
                e.preventDefault();
                setIsOpen((prev) => !prev);
                return;
            }
            if (e.key === "Escape" && isOpenRef.current) {
                e.preventDefault();
                setIsOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // ---- Reset transient state whenever the overlay closes. ----
    useEffect(() => {
        if (isOpen) return;
        // On close: cancel any pending request and clear state so the
        // next open starts fresh (no flash of the previous query's
        // results when re-opening).
        abortRef.current?.abort();
        abortRef.current = null;
        setQuery("");
        setResults([]);
        setIsLoading(false);
        setError(null);
    }, [isOpen]);

    // ---- Debounced search on query change while overlay is open. ----
    useEffect(() => {
        if (!isOpen) return;
        const trimmed = query.trim();
        if (!trimmed) {
            // Empty query: clear out any previous results immediately.
            abortRef.current?.abort();
            abortRef.current = null;
            setResults([]);
            setIsLoading(false);
            setError(null);
            return;
        }
        if (!teamId) {
            setError("No team selected.");
            return;
        }

        // Start a fresh request; supersede any in-flight one.
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const timer = window.setTimeout(async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await searchSpotlight({
                    query: trimmed,
                    team_id: teamId,
                    limit: RESULT_LIMIT,
                    use_vector: true,
                    accessToken,
                    signal: controller.signal,
                });
                // Drop the response if a newer request has already
                // started (defensive — abort *should* fire first, but
                // the timing window exists).
                if (controller.signal.aborted) return;
                setResults(data.results || []);
            } catch (err) {
                if (err instanceof CanceledError) return;
                if (axios.isCancel(err)) return;
                console.error("[Spotlight] search failed", err);
                setError("Search failed. Please try again.");
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        }, DEBOUNCE_MS);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query, isOpen, teamId, accessToken]);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);

    // ---- Enter / Ask button handler. Phase 1: stub. ----
    const onAsk = useCallback(() => {
        const trimmed = query.trim();
        if (!trimmed) return;
        // Phase 2 will replace this with a streaming call to
        // POST /api/v2/agent/ask. For now we just log so we can confirm
        // the wiring works end-to-end.
        console.log("[Spotlight] would invoke Gemini for query:", trimmed);
    }, [query]);

    return {
        isOpen,
        open,
        close,
        query,
        setQuery,
        results,
        isLoading,
        error,
        onAsk,
    };
};
