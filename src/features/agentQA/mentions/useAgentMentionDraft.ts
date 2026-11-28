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
// returns the refs whose `@Label` / `#Label` token appears — picked refs
// (the user may have edited a token away) AND auto-resolved ones: a
// hand-typed token that exactly matches a known candidate's label counts
// as a mention without a dropdown pick, so typing `@design-crew` in full
// is equivalent to picking it. The live highlight uses the same matcher,
// so a token lighting up IS the confirmation it resolved. Partial titles
// never auto-attach — the token must be the whole label, whitespace-
// preceded, and not run into a longer word.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { groupsBeforePeopleRank } from "../../../utils/mentionOrder";
import {
    displayIdEquals,
    displayIdMatches,
    fullDisplayIdIn,
    pickedByDisplayId,
} from "../../tasks/utils/taskDisplayId";
import { mentionKey, type AgentMentionCandidate, type AgentMentionRef } from "./types";

// Dropdown row cap — long lists are noise; the user narrows by typing.
const MAX_SUGGESTIONS = 8;
// How long typing must pause before an exact task id is looked up.
const LOOKUP_DELAY_MS = 250;

// A task row's display id rides in `subtitle` (see useAgentMentionSources).
const taskDisplayId = (c: AgentMentionCandidate): string | undefined =>
    c.ref.kind === "task" ? c.subtitle : undefined;

interface Trigger {
    char: "@" | "#" | "/";
    query: string;
    // Absolute index of the trigger char in `value`.
    start: number;
    // Caret position the query runs up to (insertion end).
    end: number;
}

// How far back from the caret we look for a trigger char. Entity titles
// are capped around this length; anything further back is prose, not a
// mention the user is still narrowing.
const MAX_QUERY_LEN = 60;

/** Resolve the live trigger from the caret position. Active when the
 *  caret sits after a `@`/`#` that starts the input or follows
 *  whitespace (so emails and URL fragments don't open the picker).
 *
 *  Unlike `useMentionDraft.detectTrigger`, the query may span SPACES —
 *  entity titles are usually multi-word ("How to get the most out of
 *  Spotlight"). The menu doesn't stay open forever because the hook
 *  only shows suggestions while the query still substring-matches a
 *  candidate; once the text diverges from every title the picker
 *  closes. Newlines (and another trigger char) still end the scan, and
 *  the lookback is capped at MAX_QUERY_LEN. */
export function detectMentionTrigger(value: string, caret: number, slash = false): Trigger | null {
    if (caret <= 0 || caret > value.length) return null;
    // A skill (MIP-2042, only where the host passes `skills`): `/` as the FIRST character, and the
    // name is one word, so the caret must still be inside it. Anywhere else a `/` is prose (a path,
    // "and/or", a date), never a command.
    if (slash && value.startsWith("/") && !/\s/.test(value.slice(1, caret))) {
        return { char: "/", query: value.slice(1, caret), start: 0, end: caret };
    }
    let i = caret - 1;
    while (i >= 0 && caret - i <= MAX_QUERY_LEN + 1) {
        const ch = value[i];
        if (ch === "@" || ch === "#") {
            if (i === 0 || /\s/.test(value[i - 1] ?? "")) {
                return { char: ch, query: value.slice(i + 1, caret), start: i, end: caret };
            }
            return null;
        }
        if (ch === "\n") return null;
        i -= 1;
    }
    return null;
}

export interface UseAgentMentionDraftArgs {
    value: string;
    onChange: (next: string) => void;
    members: AgentMentionCandidate[];
    entities: AgentMentionCandidate[];
    /** One task by its exact display id, whatever its status (MIP-739):
     *  the entity pool holds open work only. */
    lookupTask?: (displayId: string) => Promise<AgentMentionCandidate | null>;
    /** Tasks of any project matching a `#` query, from the server task search (MIP-2002).
     *  The host debounces and cancels; the hook asks once per query and merges the rows
     *  into the suggestions beside the pool's own. */
    searchTasks?: (query: string) => Promise<AgentMentionCandidate[]>;
    /** The skills this person may run here, in resolution order (MIP-2042). `undefined` = the host has
     *  no skills (the feature is off, or the surface does not run them): `/` is then plain text, as
     *  it always was. `[]` = skills are on and there are none yet: the menu lists nothing and a
     *  `/word` is an ordinary question. A typed `/name` is sent as a skill only when it is one of these. */
    skills?: AgentMentionCandidate[];
    /** The `/` menu ends with a "Find more skills in the Genos Hub" line (MIP-2589), reached with
     *  the arrows after the last skill. It is never highlighted by itself when no skill matches, so
     *  Enter still sends a `/word` that is just a question. */
    findSkills?: boolean;
}

// The name a skill call starts with: one word at the very start, the server's slug rule.
const TYPED_SKILL = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)/;
const SKILL_NAME_MIN = 2;
const SKILL_NAME_MAX = 40;
// A skill menu is a list to browse: it opens on a bare `/` and shows more rows than a mention menu.
const MAX_SKILL_SUGGESTIONS = 20;

export interface MentionTokenMatch {
    ref: AgentMentionRef;
    start: number;
    end: number;
}

/** The trigger character whose menu serves this ref's kind — MUST match
 *  the pool split in `useAgentMentionSources` (users + groups are the
 *  `@` people menu; every workspace entity is `#`). The token matcher
 *  rebuilds tokens from refs, so a mismatch here makes a picked mention
 *  silently unmatchable (no highlight, dropped from the wire payload).
 */
export const triggerForKind = (kind: AgentMentionRef["kind"]): "@" | "#" | "/" =>
    kind === "user" || kind === "group" ? "@" : kind === "skill" ? "/" : "#";

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
    // Every token starts with a trigger char; without one in the text
    // nothing can match. Cheap guard — the auto-resolve path feeds the
    // WHOLE candidate pool through here on every keystroke.
    if (!text.includes("@") && !text.includes("#") && !text.startsWith("/")) return [];
    const refs = [...picked].sort((a, b) => b.label.length - a.label.length);
    const out: MentionTokenMatch[] = [];
    const claimed: Array<[number, number]> = [];
    for (const ref of refs) {
        const token = `${triggerForKind(ref.kind)}${ref.label}`;
        let from = 0;
        while (from <= text.length) {
            const idx = text.indexOf(token, from);
            if (idx === -1) break;
            from = idx + 1;
            // A skill is a command: only the very first word of the text, never a `/name` in prose.
            if (ref.kind === "skill" && idx !== 0) break;
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
    /** The open menu is the `/` skill menu (it may hold no skill at all, only the Hub line). */
    skillMenu: boolean;
    /** The `/` menu shows its "Find more skills" line. */
    findSkillsRow: boolean;
    /** The highlight is on that line: Enter opens the Hub. */
    findSkillsHighlighted: boolean;
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
    /** Lock refs that were put into the text from outside the picker ("Ask
     *  Genos about this task" seeds `#PRJ-12 `). They go with the ask like a
     *  picked one, whether or not the entity is in the candidate pool. */
    adopt: (refs: AgentMentionRef[]) => void;
}

export function useAgentMentionDraft({
    value,
    onChange,
    members,
    entities,
    lookupTask,
    searchTasks,
    skills,
    findSkills = false,
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

    const skillsOn = skills !== undefined;
    const trigger = useMemo(
        () => detectMentionTrigger(value, caret, skillsOn),
        [value, caret, skillsOn]
    );

    // A task found by its exact id that the pool doesn't hold (a closed
    // one), for the `#` query it was looked up for.
    const [lookedUp, setLookedUp] = useState<{
        query: string;
        candidate: AgentMentionCandidate;
    } | null>(null);
    const lookupQuery = trigger?.char === "#" ? trigger.query : "";
    useEffect(() => {
        const id = fullDisplayIdIn(lookupQuery);
        if (!id || !lookupTask || entities.some((c) => displayIdEquals(id, taskDisplayId(c)))) {
            return;
        }
        let live = true;
        const timer = setTimeout(() => {
            void lookupTask(id).then((candidate) => {
                if (live && candidate) setLookedUp({ query: lookupQuery, candidate });
            });
        }, LOOKUP_DELAY_MS);
        return () => {
            live = false;
            clearTimeout(timer);
        };
    }, [lookupQuery, lookupTask, entities]);

    // Server task-search rows for the `#` query they were asked for. A newer query
    // replaces them; rows for an older query are never shown.
    const [searched, setSearched] = useState<{
        query: string;
        rows: AgentMentionCandidate[];
    } | null>(null);
    const searchQuery = trigger?.char === "#" ? trigger.query.trim() : "";
    useEffect(() => {
        if (!searchQuery || !searchTasks) return;
        let live = true;
        void searchTasks(searchQuery).then((rows) => {
            if (live && rows.length > 0) setSearched({ query: searchQuery, rows });
        });
        return () => {
            live = false;
        };
    }, [searchQuery, searchTasks]);

    const suggestions = useMemo(() => {
        if (!trigger) return [];
        if (dismissedStart === trigger.start) return [];
        if (trigger.char === "/") {
            // The skills the person may run, as they typed: by name or by title, exact name first,
            // then a name that starts with it, then the rest, each group in the server's order
            // (mine, team, installed, official). A bare `/` lists them all, so the menu is also how
            // a person finds out what they have.
            const q = trigger.query.toLowerCase();
            const rank = (c: AgentMentionCandidate): number => {
                const name = c.ref.label.toLowerCase();
                if (name === q) return 0;
                return name.startsWith(q) ? 1 : 2;
            };
            return (skills ?? [])
                .filter(
                    (c) =>
                        !q ||
                        c.ref.label.toLowerCase().includes(q) ||
                        (c.skillTitle ?? "").toLowerCase().includes(q)
                )
                .map((c, i) => ({ c, i }))
                .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
                .map(({ c }) => c)
                .slice(0, MAX_SKILL_SUGGESTIONS);
        }
        // A bare trigger (or whitespace-only query) shows nothing — the
        // menu opens once the user starts narrowing.
        const q = trigger.query.toLowerCase();
        if (!q.trim()) return [];
        const extra =
            trigger.char === "#" &&
            lookedUp?.query === trigger.query &&
            !entities.some((c) => c.key === lookedUp.candidate.key)
                ? [lookedUp.candidate]
                : [];
        // Pool rows win a duplicate: the open project's copy is the fresher one.
        const served =
            trigger.char === "#" && searched?.query === trigger.query.trim()
                ? searched.rows.filter(
                      (c) => !entities.some((e) => e.key === c.key) && c.key !== extra[0]?.key
                  )
                : [];
        const pool = trigger.char === "@" ? members : [...extra, ...entities, ...served];
        // Substring filter + exact→prefix→substring rank, on the RAW
        // query — deliberately not `filterAndRankByText`, which trims.
        // Keeping trailing spaces significant makes multi-word narrowing
        // work ("#fix log" still matches "Fix login bug") while closing
        // the menu right after a pick (the inserted token ends with a
        // space no title contains).
        // A task also matches by its display id ("MIP-739", "mip739");
        // an exact id ranks with an exact title.
        const rank = (c: AgentMentionCandidate): number => {
            const label = c.ref.label.toLowerCase();
            if (label === q || displayIdEquals(q, taskDisplayId(c))) return 0;
            if (label.startsWith(q)) return 1;
            return 2;
        };
        return (
            pool
                .filter(
                    (c) =>
                        c.ref.label.toLowerCase().includes(q) ||
                        displayIdMatches(q, taskDisplayId(c))
                )
                // `@` puts groups before people (MIP-1701): the pool lists people
                // first, and the 8-row cap would otherwise cut the groups off.
                // `#` (tasks) keeps the match rank alone.
                .sort(
                    (a, b) =>
                        (trigger.char === "@"
                            ? groupsBeforePeopleRank(a.ref.label, a.ref.kind === "group", q) -
                              groupsBeforePeopleRank(b.ref.label, b.ref.kind === "group", q)
                            : 0) || rank(a) - rank(b)
                )
                .slice(0, MAX_SUGGESTIONS)
        );
    }, [trigger, dismissedStart, members, entities, lookedUp, searched, skills]);

    const skillMenu = trigger?.char === "/" && dismissedStart !== trigger.start;
    const findSkillsRow = skillMenu && findSkills;
    // The Hub line sits after the skills, at index `suggestions.length`.
    const lastIndex = suggestions.length - (findSkillsRow ? 0 : 1);

    // Keep the highlight inside the list as it refilters, and reset it
    // whenever the trigger query changes so the top match is primed.
    useEffect(() => {
        setHighlightIndex(0);
    }, [trigger?.start, trigger?.query]);
    // With no skill to match, nothing is highlighted until an arrow moves onto the Hub line.
    const effectiveIndex =
        suggestions.length === 0 && findSkillsRow ? highlightIndex - 1 : highlightIndex;

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
                // With no skill the stored index is one ahead of the shown one (0 = nothing).
                const empty = suggestions.length === 0 && findSkillsRow;
                const max = empty ? 1 : Math.max(lastIndex, 0);
                return Math.min(Math.max(prev + delta, 0), max);
            });
        },
        [suggestions.length, findSkillsRow, lastIndex]
    );

    const selectSuggestion = useCallback(
        (c: AgentMentionCandidate): number => {
            if (!trigger) return caret;
            // A task found by its id goes in as `#MIP-739`, not its title
            // (MIP-739). The label is advisory on the wire — the server
            // resolves the task by id — and the token is matched by label.
            const id = taskDisplayId(c);
            const ref: AgentMentionRef =
                id && pickedByDisplayId(trigger.query, id, c.ref.label)
                    ? { ...c.ref, label: id }
                    : c.ref;
            const inserted = `${trigger.char}${ref.label} `;
            const next = `${value.slice(0, trigger.start)}${inserted}${value.slice(trigger.end)}`;
            const newCaret = trigger.start + inserted.length;
            pickedRef.current.set(c.key, ref);
            setPicksVersion((v) => v + 1);
            // A pick ENDS this mention. The query is now the whole label plus
            // a space, which still substring-matches any longer title that
            // contains it ("#Fix login " inside "Fix login bug"), so without
            // this the menu stayed open after a pick (MIP-1051). Same
            // dismissal Escape uses: it re-arms when the caret leaves this
            // trigger, so the next fresh `@`/`#` opens the menu again.
            setDismissedStart(trigger.start);
            onChange(next);
            setCaretPos(newCaret);
            return newCaret;
        },
        [trigger, caret, value, onChange]
    );

    const selectHighlighted = useCallback((): number | null => {
        const c = suggestions[effectiveIndex];
        if (!c) return null;
        return selectSuggestion(c);
    }, [suggestions, effectiveIndex, selectSuggestion]);

    const closePicker = useCallback(() => {
        if (trigger) setDismissedStart(trigger.start);
    }, [trigger]);

    // The full candidate pool, matched alongside picks so hand-typed
    // exact tokens auto-resolve. Picked refs go FIRST: the matcher's
    // length sort is stable, so for identical labels the picked instance
    // claims the span (same entity → same result; a rare label collision
    // resolves to what the user explicitly chose).
    // A task is also typed by its id, so `#MIP-739` resolves by hand too.
    const candidateRefs = useMemo(
        () => [
            ...[...members, ...entities].map((c) => c.ref),
            ...entities.flatMap((c) => {
                const id = taskDisplayId(c);
                return id ? [{ ...c.ref, label: id }] : [];
            }),
            // A typed `/name` that is exactly one of the person's skills is that skill (by id), unless
            // two of them share the name and neither is the person's own: then the server resolves the
            // name (mine > team > installed) and asks which teammate's when it cannot.
            ...(skills ?? [])
                .filter(
                    (c, i, all) =>
                        c.skillGroup === "mine" ||
                        all.every((o, j) => j === i || o.ref.label !== c.ref.label)
                )
                .map((c) => c.ref),
        ],
        [members, entities, skills]
    );

    const consumeMentions = useCallback(
        (finalText: string): AgentMentionRef[] => {
            const picked = Array.from(pickedRef.current.values());
            pickedRef.current = new Map();
            setPicksVersion((v) => v + 1);
            // A ref can match through both its picked and its candidate
            // instance (two occurrences of the same token) — the wire
            // payload carries each entity once.
            const seen = new Set<string>();
            const out: AgentMentionRef[] = [];
            for (const m of matchMentionTokens(finalText, [...picked, ...candidateRefs])) {
                const key = mentionKey(m.ref);
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(m.ref);
            }
            // A `/name` that is one of the person's skills but was not resolved above (the name is
            // shared by teammates) goes to the server as a name. A `/word` that is NOT one of their
            // skills goes as an optional name (MIP-2589): it may be a skill they have not installed,
            // and "/tmp is full, why?" is still an ordinary question.
            if (skills && !out.some((r) => r.kind === "skill")) {
                const typed = TYPED_SKILL.exec(finalText)?.[1];
                if (typed && typed.length >= SKILL_NAME_MIN && typed.length <= SKILL_NAME_MAX) {
                    out.push({
                        kind: "skill",
                        skillId: "",
                        label: typed,
                        ...(skills.some((c) => c.ref.label === typed) ? {} : { optional: true }),
                    });
                }
            }
            return out;
        },
        [candidateRefs, skills]
    );

    // Live token ranges for the highlight overlay. `picksVersion` keys
    // the pick set; `value` keys the text the tokens are matched in.
    // Duplicate occurrences all highlight (unlike the deduped payload) —
    // visually, every resolved token should read as resolved.
    const highlightRanges = useMemo(
        () =>
            matchMentionTokens(value, [
                ...Array.from(pickedRef.current.values()),
                ...candidateRefs,
            ]),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- picksVersion stands in for pickedRef.current
        [value, picksVersion, candidateRefs]
    );

    const reset = useCallback(() => {
        pickedRef.current = new Map();
        setPicksVersion((v) => v + 1);
        setDismissedStart(null);
        setHighlightIndex(0);
    }, []);

    const adopt = useCallback((refs: AgentMentionRef[]) => {
        if (refs.length === 0) return;
        for (const ref of refs) pickedRef.current.set(mentionKey(ref), ref);
        setPicksVersion((v) => v + 1);
    }, []);

    return {
        pickerOpen: suggestions.length > 0 || findSkillsRow,
        skillMenu,
        findSkillsRow,
        findSkillsHighlighted: findSkillsRow && effectiveIndex === suggestions.length,
        suggestions,
        highlightIndex: effectiveIndex,
        moveHighlight,
        selectSuggestion,
        selectHighlighted,
        closePicker,
        setCaret,
        consumeMentions,
        highlightRanges,
        reset,
        adopt,
    };
}
