/**
 * `useMentionDraft` — composer hook that adds an `@`-trigger mention
 * picker on top of a plain `<input>`.
 *
 * The production composer is BlockNote-driven, which gives WYSIWYG
 * mention chips for free. Until we swap in BlockNote on the v3
 * surfaces, this hook is the bridge: the user types text with `@Name`
 * tokens, the picker locks each one into a `MentionRef` (so we know
 * which `userId` it points to), and at send-time `buildBody` produces
 * a BlockNote-compatible block array with proper `mention` inline
 * content nodes — exactly what the backend's `extractMentions` already
 * parses (`utils/mention_handler.py:8`).
 *
 * Candidate list: derived from senders the viewer has seen in this
 * channel's recent messages. Not a true member roster (we don't have
 * one in the v3 store yet), but good enough for proof-of-life and it
 * matches the user's intuition ("the picker shows people I've been
 * talking to").
 *
 * Trigger logic: when the caret is somewhere after a `@`, with no
 * whitespace between the `@` and the caret, we treat the substring as
 * the live query. The dropdown filters candidates by case-insensitive
 * prefix on `userName`.
 */

import { useCallback, useMemo, useState } from "react";

import type { Message, UserLite } from "../../../types/channel";

export interface MentionCandidate {
    userId: string;
    userName: string;
}

export interface MentionRef {
    userId: string;
    userName: string;
}

export interface UseMentionDraftResult {
    draft: string;
    setDraft: (next: string) => void;
    /** Filtered candidate list for the live `@query`. Empty when no
     *  active trigger or when no candidates match — caller hides the
     *  picker UI in that case. */
    suggestions: MentionCandidate[];
    /** True iff the caller should render the picker. Always equals
     *  `suggestions.length > 0 && trigger !== null`. */
    pickerOpen: boolean;
    /** The live `@query` substring (without the leading `@`). `null`
     *  when there's no active trigger. */
    activeQuery: string | null;
    /** Notifies the hook of caret position changes. Without this the
     *  hook assumes the caret is at the end of `draft`. */
    setCaret: (pos: number) => void;
    /** Insert a mention chip at the active trigger position, replacing
     *  the `@query` substring with `@userName ` and locking the userId
     *  reference into the picked list. */
    selectCandidate: (c: MentionCandidate) => void;
    /** Build the BlockNote-style body array from the draft + picked
     *  refs. Mentions whose `@Name` no longer appears in the draft are
     *  dropped (the user edited them out). */
    buildBody: () => unknown[];
    /** Reset draft + picked refs. Call after a successful send. */
    reset: () => void;
}

/** Resolve the live `@query` based on caret position. Returns the
 *  query substring (without `@`) and the absolute start index of the
 *  `@`, or null when no trigger is active.
 *
 *  Active when: the caret sits at or after a `@`, with no whitespace
 *  or another `@` between them. */
function detectTrigger(
    draft: string,
    caret: number
): { query: string; triggerStart: number } | null {
    if (caret <= 0 || caret > draft.length) return null;
    let i = caret - 1;
    while (i >= 0) {
        const ch = draft[i];
        if (ch === "@") {
            // Trigger must be at the start of input or preceded by
            // whitespace, so we don't capture `email@host.com` as a
            // mention.
            if (i === 0 || /\s/.test(draft[i - 1] ?? "")) {
                return { query: draft.slice(i + 1, caret), triggerStart: i };
            }
            return null;
        }
        if (/\s/.test(ch)) return null;
        i -= 1;
    }
    return null;
}

/** Extract unique senders from a message list, preserving first-seen
 *  order (most recent senders appear earlier on a typical asc-sorted
 *  array, which gives nicer suggestion ordering after we reverse). */
export function candidatesFromMessages(
    messages: readonly Message[],
    excludeUserId: string | null
): MentionCandidate[] {
    const seen = new Map<string, MentionCandidate>();
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const s = messages[i].sender as UserLite | null;
        if (!s) continue;
        if (s.isSystemUser) continue;
        if (excludeUserId && s.userId === excludeUserId) continue;
        if (seen.has(s.userId)) continue;
        seen.set(s.userId, { userId: s.userId, userName: s.userName });
    }
    return Array.from(seen.values());
}

export function useMentionDraft(candidates: readonly MentionCandidate[]): UseMentionDraftResult {
    const [draft, setDraftState] = useState("");
    const [caret, setCaretPos] = useState(0);
    const [picked, setPicked] = useState<MentionRef[]>([]);

    const trigger = useMemo(() => detectTrigger(draft, caret), [draft, caret]);

    const suggestions = useMemo(() => {
        if (!trigger) return [];
        const q = trigger.query.toLowerCase();
        // Prefix match. Filter then truncate so the dropdown never
        // grows unbounded.
        return candidates.filter((c) => c.userName.toLowerCase().startsWith(q)).slice(0, 6);
    }, [candidates, trigger]);

    const setDraft = useCallback((next: string) => {
        setDraftState(next);
        // When the caller sets a new draft programmatically (e.g. on
        // reset), pin the caret to the end. Real input changes call
        // setCaret separately right after.
        setCaretPos(next.length);
    }, []);

    const setCaret = useCallback((pos: number) => {
        setCaretPos(pos);
    }, []);

    const selectCandidate = useCallback(
        (c: MentionCandidate) => {
            if (!trigger) return;
            const before = draft.slice(0, trigger.triggerStart);
            const after = draft.slice(caret);
            const inserted = `@${c.userName} `;
            const next = `${before}${inserted}${after}`;
            setDraftState(next);
            setCaretPos(before.length + inserted.length);
            setPicked((prev) => {
                if (prev.some((p) => p.userId === c.userId)) return prev;
                return [...prev, { userId: c.userId, userName: c.userName }];
            });
        },
        [trigger, draft, caret]
    );

    const buildBody = useCallback((): unknown[] => {
        if (!draft) return [];
        // Sort picked refs by userName length desc so longer names win
        // over substrings (`@AliceB` before `@Alice`). Then walk the
        // draft string and split on each mention occurrence.
        const refs = [...picked].sort((a, b) => b.userName.length - a.userName.length);
        const content: Array<Record<string, unknown>> = [];
        let cursor = 0;
        let safety = 0;
        while (cursor < draft.length) {
            if (safety++ > draft.length + 10) break; // belt + braces against an infinite loop
            // Find the next `@ref` occurrence at or after cursor.
            let best: { ref: MentionRef; idx: number } | null = null;
            for (const r of refs) {
                const token = `@${r.userName}`;
                const idx = draft.indexOf(token, cursor);
                if (idx === -1) continue;
                // Trigger must start at index 0 or follow whitespace to
                // count — avoids matching `you@aliceland` as `@aliceland`.
                if (idx > 0 && !/\s/.test(draft[idx - 1] ?? "")) continue;
                // Token must end at end-of-string or be followed by a
                // non-word char — avoids matching `@Alice` against `@AliceB`
                // when both are picked.
                const endCh = draft[idx + token.length];
                if (endCh !== undefined && /\w/.test(endCh)) continue;
                if (!best || idx < best.idx) best = { ref: r, idx };
            }
            if (!best) {
                const tail = draft.slice(cursor);
                if (tail) content.push({ type: "text", text: tail });
                break;
            }
            if (best.idx > cursor) {
                content.push({ type: "text", text: draft.slice(cursor, best.idx) });
            }
            content.push({
                type: "mention",
                props: { userId: best.ref.userId, userName: best.ref.userName },
            });
            cursor = best.idx + `@${best.ref.userName}`.length;
        }
        return [{ type: "paragraph", content }];
    }, [draft, picked]);

    const reset = useCallback(() => {
        setDraftState("");
        setCaretPos(0);
        setPicked([]);
    }, []);

    return {
        draft,
        setDraft,
        suggestions,
        pickerOpen: suggestions.length > 0,
        activeQuery: trigger?.query ?? null,
        setCaret,
        selectCandidate,
        buildBody,
        reset,
    };
}
