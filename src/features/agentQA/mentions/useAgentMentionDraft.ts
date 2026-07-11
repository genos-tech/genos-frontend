// `useAgentMentionDraft` — @/# mention picker logic for the plain
// textareas of the agent surfaces (Spotlight, ThreadAsk, NoteAsk).
//
// Modeled on `features/channel/hooks/useMentionDraft.ts`, with two
// deliberate differences:
//   * CONTROLLED — the surfaces already own their input state (Spotlight
//     dual-writes `localInput` + the hook `query`; useAgentQA owns
//     `query`), so this hook takes `value`/`onChange` instead of holding
//     the draft itself.
//   * Two triggers — `@` opens the member menu, `#` the entity menu
//     (tasks / notes / group chats), mirroring the BlockNote editors.
//
// Send-time contract: `consumeMentions(finalText)` re-walks the text and
// returns only the refs whose `@Label` / `#Label` token still appears
// (the user may have edited a token away), then clears the picked list —
// exactly the `buildBody` re-validation semantics of `useMentionDraft`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { filterAndRankByText } from "../../../utils/suggestionRanking";
import type { AgentMentionCandidate, AgentMentionRef } from "./types";

// Dropdown row cap — long lists are noise; the user narrows by typing.
const MAX_SUGGESTIONS = 8;

interface Trigger {
    char: "@" | "#";
    query: string;
    // Absolute index of the trigger char in `value`.
    start: number;
    // Caret position the query runs up to (insertion end).
    end: number;
}

/** Resolve the live trigger from the caret position. Active when the
 *  caret sits after a `@`/`#` that starts the input or follows
 *  whitespace, with no whitespace (or second trigger char) in between —
 *  the same rule as `useMentionDraft.detectTrigger`, so emails and
 *  URL fragments don't open the picker. */
export function detectMentionTrigger(value: string, caret: number): Trigger | null {
    if (caret <= 0 || caret > value.length) return null;
    let i = caret - 1;
    while (i >= 0) {
        const ch = value[i];
        if (ch === "@" || ch === "#") {
            if (i === 0 || /\s/.test(value[i - 1] ?? "")) {
                return { char: ch, query: value.slice(i + 1, caret), start: i, end: caret };
            }
            return null;
        }
        if (/\s/.test(ch)) return null;
        i -= 1;
    }
    return null;
}

export interface UseAgentMentionDraftArgs {
    value: string;
    onChange: (next: string) => void;
    members: AgentMentionCandidate[];
    entities: AgentMentionCandidate[];
}

export interface MentionTokenMatch {
    ref: AgentMentionRef;
    start: number;
    end: number;
}

/** Locate each picked ref's `@Label` / `#Label` token in `text`.
 *
 *  Shared by `consumeMentions` (send-time pruning) and the in-input
 *  highlight overlay, so what the user SEES highlighted is exactly what
 *  gets sent. Rules: longest label first (a picked `@Alice` can't claim
 *  part of a picked `@AliceB` occurrence), token must start the text or
 *  follow whitespace, must not continue into a longer word, and each
 *  text span is claimed at most once. One match per ref.
 */
export function matchMentionTokens(
    text: string,
    picked: readonly AgentMentionRef[]
): MentionTokenMatch[] {
    if (!text || picked.length === 0) return [];
    const refs = [...picked].sort((a, b) => b.label.length - a.label.length);
    const out: MentionTokenMatch[] = [];
    const claimed: Array<[number, number]> = [];
    for (const ref of refs) {
        const token = `${ref.kind === "user" ? "@" : "#"}${ref.label}`;
        let from = 0;
        while (from <= text.length) {
            const idx = text.indexOf(token, from);
            if (idx === -1) break;
            from = idx + 1;
            // Token must start the text or follow whitespace…
            if (idx > 0 && !/\s/.test(text[idx - 1] ?? "")) continue;
            // …and must not continue into a longer word.
            const endCh = text[idx + token.length];
            if (endCh !== undefined && /\w/.test(endCh)) continue;
            // …and must not overlap a longer, already-claimed token.
            const end = idx + token.length;
            if (claimed.some(([s, e]) => idx < e && end > s)) continue;
            claimed.push([idx, end]);
            out.push({ ref, start: idx, end });
            break;
        }
    }
    return out.sort((a, b) => a.start - b.start);
}

export interface UseAgentMentionDraftReturn {
    /** True when the caller should render the dropdown. */
    pickerOpen: boolean;
    suggestions: AgentMentionCandidate[];
    highlightIndex: number;
    moveHighlight: (delta: number) => void;
    /** Splice the candidate's token into the value at the trigger and
     *  lock the ref. Returns the caret position after the inserted
     *  token so the caller can restore the DOM selection. */
    selectSuggestion: (c: AgentMentionCandidate) => number;
    /** `selectSuggestion` on the highlighted row; null when the picker
     *  is closed / empty. */
    selectHighlighted: () => number | null;
    /** Escape: hide the dropdown for the CURRENT trigger only — it
     *  reopens on the next fresh trigger. */
    closePicker: () => void;
    /** Notify the hook of caret moves (click / arrow keys / typing). */
    setCaret: (pos: number) => void;
    /** Send-time re-validation; see module docstring. Clears picks. */
    consumeMentions: (finalText: string) => AgentMentionRef[];
    /** Character ranges of live mention tokens in `value` — the spans
     *  the highlight overlay marks, and exactly what `consumeMentions`
     *  would send right now. */
    highlightRanges: MentionTokenMatch[];
    /** Clear picked refs + dismissal (e.g. surface closed). */
    reset: () => void;
}

export function useAgentMentionDraft({
    value,
    onChange,
    members,
    entities,
}: UseAgentMentionDraftArgs): UseAgentMentionDraftReturn {
    const [caret, setCaretPos] = useState(0);
    // Trigger start the user dismissed with Escape — the picker stays
    // closed while the caret remains inside that same trigger.
    const [dismissedStart, setDismissedStart] = useState<number | null>(null);
    const [highlightIndex, setHighlightIndex] = useState(0);
    // Picked refs live in a ref so `consumeMentions` can read + clear
    // them synchronously inside the submit handler. `picksVersion` is
    // bumped on every mutation purely to invalidate the highlight memo
    // (picks otherwise change in the same handler as a `value` change,
    // but reset()/consume() don't have to).
    const pickedRef = useRef<Map<string, AgentMentionRef>>(new Map());
    const [picksVersion, setPicksVersion] = useState(0);

    const trigger = useMemo(() => detectMentionTrigger(value, caret), [value, caret]);

    const suggestions = useMemo(() => {
        if (!trigger) return [];
        if (dismissedStart === trigger.start) return [];
        const pool = trigger.char === "@" ? members : entities;
        return filterAndRankByText(pool, (c) => c.ref.label, trigger.query).slice(
            0,
            MAX_SUGGESTIONS
        );
    }, [trigger, dismissedStart, members, entities]);

    // Keep the highlight inside the list as it refilters, and reset it
    // whenever the trigger query changes so the top match is primed.
    useEffect(() => {
        setHighlightIndex(0);
    }, [trigger?.start, trigger?.query]);

    // A dismissal only applies to the trigger it happened in; leaving
    // the trigger (or clearing the input) re-arms the picker.
    useEffect(() => {
        if (dismissedStart !== null && trigger?.start !== dismissedStart) {
            setDismissedStart(null);
        }
    }, [trigger?.start, dismissedStart]);

    const setCaret = useCallback((pos: number) => setCaretPos(pos), []);

    const moveHighlight = useCallback(
        (delta: number) => {
            setHighlightIndex((prev) => {
                if (suggestions.length === 0) return 0;
                return Math.min(Math.max(prev + delta, 0), suggestions.length - 1);
            });
        },
        [suggestions.length]
    );

    const selectSuggestion = useCallback(
        (c: AgentMentionCandidate): number => {
            if (!trigger) return caret;
            const inserted = `${trigger.char}${c.ref.label} `;
            const next = `${value.slice(0, trigger.start)}${inserted}${value.slice(trigger.end)}`;
            const newCaret = trigger.start + inserted.length;
            pickedRef.current.set(c.key, c.ref);
            setPicksVersion((v) => v + 1);
            onChange(next);
            setCaretPos(newCaret);
            return newCaret;
        },
        [trigger, caret, value, onChange]
    );

    const selectHighlighted = useCallback((): number | null => {
        const c = suggestions[highlightIndex];
        if (!c) return null;
        return selectSuggestion(c);
    }, [suggestions, highlightIndex, selectSuggestion]);

    const closePicker = useCallback(() => {
        if (trigger) setDismissedStart(trigger.start);
    }, [trigger]);

    const consumeMentions = useCallback((finalText: string): AgentMentionRef[] => {
        const picked = Array.from(pickedRef.current.values());
        pickedRef.current = new Map();
        setPicksVersion((v) => v + 1);
        return matchMentionTokens(finalText, picked).map((m) => m.ref);
    }, []);

    // Live token ranges for the highlight overlay. `picksVersion` keys
    // the pick set; `value` keys the text the tokens are matched in.
    const highlightRanges = useMemo(
        () => matchMentionTokens(value, Array.from(pickedRef.current.values())),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- picksVersion stands in for pickedRef.current
        [value, picksVersion]
    );

    const reset = useCallback(() => {
        pickedRef.current = new Map();
        setPicksVersion((v) => v + 1);
        setDismissedStart(null);
        setHighlightIndex(0);
    }, []);

    return {
        pickerOpen: suggestions.length > 0,
        suggestions,
        highlightIndex,
        moveHighlight,
        selectSuggestion,
        selectHighlighted,
        closePicker,
        setCaret,
        consumeMentions,
        highlightRanges,
        reset,
    };
}
