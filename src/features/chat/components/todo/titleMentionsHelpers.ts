import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type KeyboardEvent,
} from "react";

import { mentionKey, type AgentMentionCandidate } from "../../../agentQA/mentions/types";
import {
    matchMentionTokens,
    useAgentMentionDraft,
} from "../../../agentQA/mentions/useAgentMentionDraft";
import type {
    ResolvedTitleMention,
    TodoMentionPool,
    TodoTitleMentions,
    UseTodoTitleMentionsArgs,
} from "./titleMentions";

export const TodoMentionsContext = createContext<TodoMentionPool | null>(null);

export const useTodoTitleMentions = ({
    inputRef,
    value,
    setValue,
    enabled = true,
}: UseTodoTitleMentionsArgs): TodoTitleMentions => {
    const pool = useTodoMentionPool();
    const refreshEntities = pool.refreshEntities;

    const mention = useAgentMentionDraft({
        value,
        onChange: setValue,
        members: enabled ? pool.members : NO_CANDIDATES,
        entities: enabled ? pool.entities : NO_CANDIDATES,
    });

    // Re-pull on the first `#` in this field so the menu reflects what
    // teammates created since the pane mounted. Keyed on the boolean, not
    // the value, so it fires once per `#` appearing rather than per
    // keystroke (and it's throttled downstream regardless).
    const wantsEntities = enabled && value.includes("#");
    useEffect(() => {
        if (wantsEntities) refreshEntities();
    }, [wantsEntities, refreshEntities]);

    // A click outside the field used to leave the menu hanging (MIP-1051).
    // Hide it while the field is blurred; focusing back shows it again if
    // the caret is still inside a trigger. Picking with the mouse does NOT
    // blur: the dropdown's onMouseDown preventDefault keeps focus here.
    const [focused, setFocused] = useState(true);
    const onFocus = useCallback(() => setFocused(true), []);
    const onBlur = useCallback(() => setFocused(false), []);
    const pickerOpen = focused && mention.pickerOpen;

    const syncCaret = useCallback(() => {
        const el = inputRef.current;
        if (el) mention.setCaret(el.selectionStart ?? el.value.length);
    }, [inputRef, mention]);

    const onSelect = useCallback(
        (c: AgentMentionCandidate) => {
            const newCaret = mention.selectSuggestion(c);
            // Restore focus + caret after React commits the new value —
            // the dropdown's onMouseDown/preventDefault kept focus in the
            // input, but the controlled update would otherwise bounce the
            // caret to the end.
            requestAnimationFrame(() => {
                const el = inputRef.current;
                if (el) {
                    el.focus();
                    el.setSelectionRange(newCaret, newCaret);
                }
            });
        },
        [inputRef, mention]
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLElement>): boolean => {
            // IME guard, FIRST: while a composition is active (Japanese /
            // Chinese / Korean, accented input) Enter CONFIRMS the
            // composition. Reporting it as consumed is what stops the host
            // from adding a half-typed item on the confirm keystroke.
            if (e.nativeEvent.isComposing || e.keyCode === 229) return true;
            if (!pickerOpen) return false;
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    mention.moveHighlight(1);
                    return true;
                case "ArrowUp":
                    e.preventDefault();
                    mention.moveHighlight(-1);
                    return true;
                case "Enter": {
                    const newCaret = mention.selectHighlighted();
                    if (newCaret === null) return false;
                    e.preventDefault();
                    requestAnimationFrame(() => {
                        const el = inputRef.current;
                        if (el) el.setSelectionRange(newCaret, newCaret);
                    });
                    return true;
                }
                case "Escape":
                    // stopPropagation so dismissing the menu doesn't also
                    // cancel the title edit or close the schedule modal.
                    e.preventDefault();
                    e.stopPropagation();
                    mention.closePicker();
                    return true;
                default:
                    return false;
            }
        },
        [inputRef, mention, pickerOpen]
    );

    return {
        pickerOpen,
        suggestions: mention.suggestions,
        highlightIndex: mention.highlightIndex,
        highlightRanges: mention.highlightRanges,
        onSelect,
        syncCaret,
        onFocus,
        onBlur,
        handleKeyDown,
    };
};

/**
 * Find the mention tokens in a saved title. Cheap on the common case:
 * `matchMentionTokens` bails out before any sorting when the text holds
 * no `@`/`#` at all, which is nearly every title.
 */
export const resolveTitleMentions = (
    text: string,
    pool: TodoMentionPool
): ResolvedTitleMention[] =>
    matchMentionTokens(text, pool.refs).map((m) => {
        const key = mentionKey(m.ref);
        return {
            ...m,
            href: pool.hrefByKey.get(key),
            taskCard: pool.taskCardByKey.get(key),
        };
    });

/** Empty pool outside the provider, so a title input rendered standalone
 *  (tests, or any future host) simply has no picker instead of crashing. */
export const useTodoMentionPool = (): TodoMentionPool =>
    useContext(TodoMentionsContext) ?? EMPTY_POOL;

/* ------------------------------------------------------------------ */
/* Input wiring                                                        */
/* ------------------------------------------------------------------ */

// Stable identities so a disabled field doesn't churn the draft hook's
// memos every render.
export const NO_CANDIDATES: AgentMentionCandidate[] = [];

export const EMPTY_POOL: TodoMentionPool = {
    members: [],
    entities: [],
    refs: [],
    hrefByKey: new Map(),
    taskCardByKey: new Map(),
    refreshEntities: () => {},
};
