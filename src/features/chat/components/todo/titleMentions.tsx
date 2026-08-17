// `@` mentions and `#` hashtags inside a to-do TITLE.
//
// Same picker the agent surfaces use (Spotlight / ThreadAsk / NoteAsk):
// `useAgentMentionDraft` for trigger detection + keyboard state,
// `MentionSuggestionDropdown` for the menu, `MentionHighlightOverlay` for
// the live marker over resolved tokens. What's new here is the host — a
// single-line Joy `<Input>` rather than a textarea (hence the overlay's
// `singleLine` mode), and there are FOUR of them (add-item, the title
// editor, add-subitem, and the recurring-schedule title), so the wiring
// lives in one hook the way `useLinkifyPaste` does for paste-to-link.
//
// STORAGE: the title stays PLAIN TEXT — the picked token is spliced in as
// literal `@Name` / `#Title` characters, exactly like the `[label](url)`
// markdown that paste-to-link writes. There is no structured mention node
// (`ToDoItem.title` is a CharField) and nothing on the server reads it:
// `todo_views` stores the title verbatim, with no mention extraction, no
// Activity row, and no socket emit. So a mention here NOTIFIES NOBODY —
// it is a reference you can click, matching the BlockNote `#` hash
// mentions, which are likewise inert. Anything that should ping someone
// belongs in a chat message or the item's notes.
//
// READ MODE: because the title is plain text, a saved token is re-resolved
// at render time by matching it against the candidate pool
// (`resolveTitleMentions`) rather than read off a stored id. That means a
// renamed entity stops resolving — the token is then just the words the
// user typed, which is the honest outcome for plain-text storage. `#`
// chips carry a deep link where one can be built (see
// `AgentMentionCandidate.href`) and open it in the same preview modal a
// title URL does.

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useState,
    type KeyboardEvent,
    type ReactNode,
    type RefObject,
} from "react";
import { Box } from "@mui/joy";

import { mentionChipSx } from "../../../../components/editors/Mention";
import {
    CHAT_PALETTE,
    GROUP_PALETTE,
    MILESTONE_PALETTE,
    NOTE_PALETTE,
    PROJECT_PALETTE,
    TASK_PALETTE,
    TODO_PALETTE,
    USER_OTHER_PALETTE,
    USER_SELF_PALETTE,
    type MentionPalette,
} from "../../../../components/editors/mentionPalettes";
import { useHashMentionData } from "../../../../context/HashMentionDataContext";
import { useTranslation } from "../../../../i18n";
import { MentionHighlightOverlay } from "../../../agentQA/mentions/MentionHighlightOverlay";
import { MentionSuggestionDropdown } from "../../../agentQA/mentions/MentionSuggestionDropdown";
import {
    mentionKey,
    type AgentMentionCandidate,
    type AgentMentionRef,
} from "../../../agentQA/mentions/types";
import {
    matchMentionTokens,
    useAgentMentionDraft,
    type MentionTokenMatch,
} from "../../../agentQA/mentions/useAgentMentionDraft";
import { useAgentMentionSources } from "../../../agentQA/mentions/useAgentMentionSources";

/* ------------------------------------------------------------------ */
/* Candidate pool (built once per pane)                                */
/* ------------------------------------------------------------------ */

export interface TodoMentionPool {
    members: AgentMentionCandidate[];
    entities: AgentMentionCandidate[];
    /** Every candidate's ref — what a saved title is matched against. */
    refs: AgentMentionRef[];
    /** `mentionKey(ref)` → internal deep-link, for clickable `#` chips. */
    hrefByKey: Map<string, string>;
    refreshEntities: () => void;
}

const EMPTY_POOL: TodoMentionPool = {
    members: [],
    entities: [],
    refs: [],
    hrefByKey: new Map(),
    refreshEntities: () => {},
};

const TodoMentionsContext = createContext<TodoMentionPool | null>(null);

/**
 * Builds the `@`/`#` candidate pool ONCE for the whole to-do pane.
 *
 * Deliberately a context rather than a prop: every category section
 * renders an "+ Add item" input and every row can open a title editor, so
 * a per-input `useAgentMentionSources()` would rebuild the entire pool
 * dozens of times over. Same reasoning as `HashMentionDataContext` itself,
 * and it reaches `ModalScheduledTodos` without threading a prop through
 * four layers.
 */
export const TodoMentionsProvider = ({ children }: { children: ReactNode }) => {
    const hash = useHashMentionData();
    // Team-wide tasks, not just the open project's: the pane lives in the
    // chat area, where often no project is open at all and `#` would
    // otherwise offer no tasks whatsoever.
    const sources = useAgentMentionSources({ includeTeamTasks: true });
    const refresh = hash.refresh;

    // `teamTasks` (and note/project metadata) are fetched lazily on first
    // demand, so without this a SAVED `#Task` token in an existing title
    // would render as plain text until something else happened to pull
    // them. Throttled app-wide, so one call per pane mount is free.
    useEffect(() => {
        refresh();
    }, [refresh]);

    const value = useMemo<TodoMentionPool>(() => {
        const all = [...sources.members, ...sources.entities];
        const hrefByKey = new Map<string, string>();
        for (const c of all) {
            if (c.href) hrefByKey.set(c.key, c.href);
        }
        return {
            members: sources.members,
            entities: sources.entities,
            refs: all.map((c) => c.ref),
            hrefByKey,
            refreshEntities: refresh,
        };
    }, [sources.members, sources.entities, refresh]);

    return <TodoMentionPoolProvider pool={value}>{children}</TodoMentionPoolProvider>;
};

/** The bare context write, split out so a caller that already HAS a pool
 *  (tests, Storybook-style harnesses) can supply one without the app-wide
 *  mention datasets the provider above reads. */
export const TodoMentionPoolProvider = ({
    pool,
    children,
}: {
    pool: TodoMentionPool;
    children: ReactNode;
}) => <TodoMentionsContext.Provider value={pool}>{children}</TodoMentionsContext.Provider>;

/** Empty pool outside the provider, so a title input rendered standalone
 *  (tests, or any future host) simply has no picker instead of crashing. */
// eslint-disable-next-line react-refresh/only-export-components
export const useTodoMentionPool = (): TodoMentionPool =>
    useContext(TodoMentionsContext) ?? EMPTY_POOL;

/* ------------------------------------------------------------------ */
/* Input wiring                                                        */
/* ------------------------------------------------------------------ */

// Stable identities so a disabled field doesn't churn the draft hook's
// memos every render.
const NO_CANDIDATES: AgentMentionCandidate[] = [];

export interface TodoTitleMentions {
    pickerOpen: boolean;
    suggestions: AgentMentionCandidate[];
    highlightIndex: number;
    highlightRanges: MentionTokenMatch[];
    onSelect: (c: AgentMentionCandidate) => void;
    /** Feed caret moves — call from onChange / onClick / onKeyUp. */
    syncCaret: () => void;
    /**
     * Returns TRUE when the picker consumed the key, in which case the
     * host must not act on it. Each title field owns different Enter /
     * Escape semantics (add vs commit vs close the modal), so the
     * decision stays with the host instead of being hardcoded here.
     */
    handleKeyDown: (e: KeyboardEvent<HTMLElement>) => boolean;
}

export interface UseTodoTitleMentionsArgs {
    inputRef: RefObject<HTMLInputElement | null>;
    value: string;
    setValue: (next: string) => void;
    /** False for a field that isn't currently mounted/open (the title
     *  editor, the sub-item adder) — skips all matching work. */
    enabled?: boolean;
}

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
            if (!mention.pickerOpen) return false;
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
        [inputRef, mention]
    );

    return {
        pickerOpen: mention.pickerOpen,
        suggestions: mention.suggestions,
        highlightIndex: mention.highlightIndex,
        highlightRanges: mention.highlightRanges,
        onSelect,
        syncCaret,
        handleKeyDown,
    };
};

/** Dropdown + live highlight for one title field. `anchorRef` must be a
 *  `position: relative` wrapper around the input — the menu positions off
 *  its rect and the overlay renders into it. */
export const TodoTitleMentionLayer = ({
    mentions,
    anchorRef,
    inputRef,
    value,
}: {
    mentions: TodoTitleMentions;
    anchorRef: RefObject<HTMLElement | null>;
    inputRef: RefObject<HTMLInputElement | null>;
    value: string;
}) => {
    const { t } = useTranslation();
    const [placement, setPlacement] = useState<"above" | "below">("below");

    // Flip the menu up for a field sitting low in the viewport (the
    // "+ Add item" input at the bottom of a long pane) — the dropdown
    // clamps itself to the space available, so anchoring below there would
    // squeeze it to a sliver. Measured only when the menu OPENS, so the
    // choice can't flicker while the user narrows the query.
    useLayoutEffect(() => {
        if (!mentions.pickerOpen) return;
        const el = anchorRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const spaceBelow = window.innerHeight - r.bottom;
        setPlacement(spaceBelow < 200 && r.top > spaceBelow ? "above" : "below");
    }, [mentions.pickerOpen, anchorRef]);

    return (
        <>
            {mentions.pickerOpen && (
                <MentionSuggestionDropdown
                    anchorRef={anchorRef}
                    ariaLabel={t.chat.todoPane.mentions.ariaLabel}
                    highlightIndex={mentions.highlightIndex}
                    placement={placement}
                    suggestions={mentions.suggestions}
                    onSelect={mentions.onSelect}
                />
            )}
            <MentionHighlightOverlay
                containerRef={anchorRef}
                elementRef={inputRef}
                ranges={mentions.highlightRanges}
                value={value}
                singleLine
            />
        </>
    );
};

/* ------------------------------------------------------------------ */
/* Read mode                                                           */
/* ------------------------------------------------------------------ */

export interface ResolvedTitleMention extends MentionTokenMatch {
    /** Absent for kinds with nowhere to go (`@user`, `@group`, `#todo`)
     *  and for entities whose coordinates were missing. */
    href?: string;
}

/**
 * Find the mention tokens in a saved title. Cheap on the common case:
 * `matchMentionTokens` bails out before any sorting when the text holds
 * no `@`/`#` at all, which is nearly every title.
 */
export const resolveTitleMentions = (
    text: string,
    pool: TodoMentionPool
): ResolvedTitleMention[] =>
    matchMentionTokens(text, pool.refs).map((m) => ({
        ...m,
        href: pool.hrefByKey.get(mentionKey(m.ref)),
    }));

const paletteForRef = (ref: AgentMentionRef, myselfUserId: string | undefined): MentionPalette => {
    switch (ref.kind) {
        case "user":
            // Being mentioned yourself pops in a different colour, the
            // same signal the message-body chips use.
            return ref.userId === myselfUserId ? USER_SELF_PALETTE : USER_OTHER_PALETTE;
        case "group":
            return GROUP_PALETTE;
        case "task":
            return ref.isMilestone ? MILESTONE_PALETTE : TASK_PALETTE;
        case "note":
            return NOTE_PALETTE;
        case "chat":
            return CHAT_PALETTE;
        case "project":
            return PROJECT_PALETTE;
        case "todo":
            return TODO_PALETTE;
    }
};

/** One resolved token drawn inside a to-do row's title. */
export const TitleMentionChip = ({
    mention,
    text,
    myselfUserId,
    isDark,
    onOpenHref,
}: {
    mention: ResolvedTitleMention;
    /** The literal token as typed, trigger char included. */
    text: string;
    myselfUserId?: string;
    isDark?: boolean;
    onOpenHref: (href: string) => void;
}) => {
    const palette = paletteForRef(mention.ref, myselfUserId);
    // The violet palettes resolve `text` to the brand var, which blends
    // into a dark surface — swap up the ramp, as the dropdown does.
    const color =
        isDark && palette.text.includes("--gp-brand-700")
            ? "var(--gp-brandalt-400)"
            : palette.text;
    const href = mention.href;

    return (
        <Box
            component="span"
            sx={{
                ...mentionChipSx(palette),
                // Compact variant: a to-do row is one dense line of text,
                // so the message-body chip's padding would visibly grow
                // every row's height. Colour, hover and pill shape stay
                // shared with every other mention chip in the app.
                px: 0.5,
                py: 0,
                borderRadius: "6px",
                fontSize: "inherit",
                fontWeight: 600,
                color,
                cursor: href ? "pointer" : "default",
                ...(href ? null : { "&:hover": { backgroundColor: palette.bg } }),
            }}
            onClick={
                href
                    ? (e) => {
                          // Don't also flip the row into edit mode.
                          e.stopPropagation();
                          onOpenHref(href);
                      }
                    : undefined
            }
        >
            {text}
        </Box>
    );
};
