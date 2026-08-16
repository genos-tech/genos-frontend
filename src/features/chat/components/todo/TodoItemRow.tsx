import { ReactNode, useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import AddIcon from "@mui/icons-material/Add";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SubdirectoryArrowRightRoundedIcon from "@mui/icons-material/SubdirectoryArrowRightRounded";
import { Box, Checkbox, IconButton, Input, Link, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../../../hooks/common/UrlLinkModalContext";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TodoCategoryProps, TodoItemProps, TodoReminderProps } from "../../../../types/chat";
import { extractYYYYMMDDHHMM } from "../../../../utils/dateUtils";
import { formatReminderTime } from "../../utils/reminderPresets";
import { formatCompletedAt } from "../../utils/todoCompletion";
import { ModalRemindMe } from "../modals/ModalRemindMe";
import { ModalCreateTaskFromTodo } from "./ModalCreateTaskFromTodo";
import { useLinkifyPaste } from "./titleLinks";
import { TodoItemMoreMenu } from "./TodoItemMoreMenu";
import { TodoNotesEditor } from "./TodoNotesEditor";

interface TodoItemRowProps {
    item: TodoItemProps;
    categories: TodoCategoryProps[];
    // The owning group's day bucket (YYYY-MM-DD) — the deep-link URL for
    // this item is /workspace/todo/:localDate/item/:itemId.
    localDate: string;
    // Deep-link target: when it matches this row's itemId, the row is
    // tinted + ringed and scrolled into view so the user can tell which
    // todo the opened URL pointed at.
    highlightItemId?: number;
    // Direct children of this row. Empty on rows that are themselves
    // children (one-level nesting cap).
    subitems?: TodoItemProps[];
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    socket: Socket | null;
    onToggleComplete: (itemId: number, isCompleted: boolean) => void;
    onTitleCommit: (itemId: number, title: string) => void;
    onNotesCommit: (itemId: number, notes: PartialBlock[] | null) => void;
    onCategoryChange: (itemId: number, categoryId: number | null) => void;
    onDelete: (itemId: number) => void;
    onCategoryCreate: (name: string) => Promise<TodoCategoryProps | undefined>;
    // Reminders. `reminderByItemId` is passed whole rather than per-row so
    // the recursive child rows below can read their own without the parent
    // re-deriving it. Absent on surfaces that don't wire reminders up, which
    // simply hides the menu item.
    reminderByItemId?: ReadonlyMap<number, TodoReminderProps>;
    onSetReminder?: (itemId: number, at: Date) => Promise<unknown>;
    onCancelReminder?: (itemId: number) => Promise<unknown>;
    // Append a new child under this row's parent (top-level row's
    // own item_id, or — when this row is itself a child rendered by
    // its own parent — undefined).
    onAddSubitem?: (parentItemId: number, title: string) => Promise<void>;
}

const NOTES_SAVE_INTERVAL_MS = 2000;

// BlockNote refuses an empty initialContent array, so seed one empty
// paragraph when the item has no notes yet. We treat a body that's
// just this single empty paragraph as "no notes" on save, persisting
// null back to the server.
const EMPTY_NOTES_BODY: PartialBlock[] = [
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [],
        children: [],
    },
];

const isEffectivelyEmpty = (body: PartialBlock[]): boolean => {
    if (body.length === 0) return true;
    if (body.length > 1) return false;
    const only = body[0];
    if (only.type !== "paragraph") return false;
    const content = only.content;
    if (!content) return true;
    if (Array.isArray(content) && content.length === 0) return true;
    return false;
};

const ensureNonEmpty = (body: PartialBlock[] | null | undefined): PartialBlock[] => {
    if (!body || body.length === 0) return EMPTY_NOTES_BODY;
    return body;
};

// Two link forms are recognized inside the otherwise-plain title:
//   * Markdown links — [label](https://…) → the *label* becomes clickable.
//   * Bare http(s) URLs — https://… → the URL itself becomes clickable.
// The title is still stored verbatim as plain text (the raw "[label](url)"
// markdown included); this only changes how it's drawn in the row's read
// state, and edit mode shows the raw text back so links stay editable.
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s]+)/g;

// Only http(s) links are allowed through, so a "[x](javascript:…)" stays inert
// plain text — building <Link> elements here then carries no injection risk.
const isSafeHref = (url: string): boolean => /^https?:\/\//i.test(url);

const renderTitleWithLinks = (
    text: string,
    // Provided when the row renders inside the app's UrlLinkModalProvider
    // (null on e.g. signin surfaces). When present, internal links open in
    // the preview modal / react-router instead of a new tab; null falls back
    // to the plain target="_blank" anchor below.
    urlLinkModal: ReturnType<typeof useUrlLinkModal>
): ReactNode => {
    const out: ReactNode[] = [];
    let lastIndex = 0;
    for (const match of text.matchAll(LINK_RE)) {
        const [whole, mdLabel, mdUrl, bareUrl] = match;
        const start = match.index;

        let label: string;
        let href: string;
        let consumed: number;
        if (mdUrl !== undefined) {
            // Unsafe markdown href: leave the whole "[label](url)" as text.
            if (!isSafeHref(mdUrl)) continue;
            href = mdUrl;
            label = mdLabel;
            consumed = whole.length;
        } else {
            // Bare URL: don't swallow trailing sentence punctuation
            // (e.g. "see https://x.com." or a URL wrapped in parens).
            href = bareUrl.replace(/[.,;:!?)\]}'"]+$/, "");
            label = href;
            consumed = href.length;
        }

        if (start > lastIndex) out.push(text.slice(lastIndex, start));
        out.push(
            // stopPropagation: opening the link must not also flip the row
            // into edit mode. When the modal provider is present, route the
            // click through openModalByHref — it self-terminates (opens the
            // preview modal for internal entities, navigates internal routes,
            // window.opens externals), so preventDefault cancels the native
            // anchor and lets it own the click. With no provider, fall
            // through to the plain target="_blank" anchor.
            <Link
                key={start}
                href={href}
                rel="noopener noreferrer"
                sx={{ fontSize: "inherit", color: "primary.500" }}
                target="_blank"
                underline="always"
                onClick={(e) => {
                    e.stopPropagation();
                    if (urlLinkModal) {
                        e.preventDefault();
                        urlLinkModal.openModalByHref(href);
                    }
                }}
            >
                {label}
            </Link>
        );
        lastIndex = start + consumed;
    }
    if (lastIndex < text.length) out.push(text.slice(lastIndex));
    return out;
};

export const TodoItemRow = (props: TodoItemRowProps) => {
    const {
        item,
        categories,
        localDate,
        highlightItemId,
        subitems = [],
        myself,
        setMyself,
        useTEM,
        useUISM,
        useCM,
        socket,
        onToggleComplete,
        onTitleCommit,
        onNotesCommit,
        onCategoryChange,
        onDelete,
        onCategoryCreate,
        onAddSubitem,
        reminderByItemId,
        onSetReminder,
        onCancelReminder,
    } = props;

    const isChild = item.parentItemId !== null;

    const { mode } = useColorScheme();
    const { t, locale } = useTranslation();
    const isDark = mode === "dark";

    // null outside the app's UrlLinkModalProvider; passed to
    // renderTitleWithLinks so internal title links open as a preview modal.
    const urlLinkModal = useUrlLinkModal();

    const [title, setTitle] = useState(item.title);
    // Read mode renders the title with clickable links; clicking the text
    // flips to an editable <Input> (an <input> can't host clickable links).
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    // Set on Escape so the blur that follows restores instead of committing.
    const skipTitleCommitRef = useRef(false);
    // Refs to the title editor + subitem-add <input>s, so paste-to-link can be
    // wired onto each (see useLinkifyPaste below).
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const subitemInputRef = useRef<HTMLInputElement | null>(null);
    // Default to expanded when the item ships with actual notes content
    // (i.e. not just the placeholder empty paragraph) so the user sees
    // them without an extra click. Empty notes stay collapsed.
    const [notesExpanded, setNotesExpanded] = useState(
        () => !isEffectivelyEmpty(item.notes ?? [])
    );
    const [notesBody, setNotesBody] = useState<PartialBlock[]>(() => ensureNonEmpty(item.notes));
    const notesDirtyRef = useRef(false);

    const isHighlighted = highlightItemId != null && item.itemId === highlightItemId;

    // Copy-link feedback: flips the tooltip to "Link copied" briefly.
    const [linkCopied, setLinkCopied] = useState(false);
    // "Create task from this to-do" modal (top-level rows only).
    const [createTaskOpen, setCreateTaskOpen] = useState(false);
    // "Remind me about this to-do" picker.
    const [remindMeOpen, setRemindMeOpen] = useState(false);
    const reminder = reminderByItemId?.get(item.itemId) ?? null;
    // Hidden on a completed row: the server refuses a reminder for a to-do
    // already ticked off, so offering it would be a promise we know would be
    // broken. Ticking the row off cancels any pending one (`useTodoGroups`).
    const canRemind = Boolean(onSetReminder && onCancelReminder && !item.isCompleted);
    const linkCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => {
            if (linkCopiedTimerRef.current) clearTimeout(linkCopiedTimerRef.current);
        };
    }, []);
    const handleCopyLink = async () => {
        const url = `${window.location.origin}/workspace/todo/${localDate}/item/${item.itemId}`;
        try {
            await navigator.clipboard.writeText(url);
            setLinkCopied(true);
            if (linkCopiedTimerRef.current) clearTimeout(linkCopiedTimerRef.current);
            linkCopiedTimerRef.current = setTimeout(() => setLinkCopied(false), 1500);
        } catch {
            // Clipboard unavailable (permissions/insecure context) — the
            // tooltip simply doesn't flip; nothing else to do.
        }
    };

    // Center the deep-link target once it's rendered. The small delay
    // defers past Virtuoso mounting the group row (ToDoPane scrolls the
    // group into the viewport first; this fine-positions the item).
    const rootRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!isHighlighted) return;
        const id = setTimeout(() => {
            rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
        return () => clearTimeout(id);
    }, [isHighlighted]);

    // Subitem add: a small inline input that the user opens with the
    // "+ subitem" button. Only meaningful on top-level rows; children
    // never render the affordance (one-level nesting cap).
    const [subitemAddOpen, setSubitemAddOpen] = useState(false);
    const [newSubitemTitle, setNewSubitemTitle] = useState("");
    const handleAddSubitem = async () => {
        const t = newSubitemTitle.trim();
        if (!t || !onAddSubitem) return;
        await onAddSubitem(item.itemId, t);
        setNewSubitemTitle("");
        // Keep the input open so the user can rapid-add several.
    };

    // Sync local state when the item is refreshed from the server.
    useEffect(() => {
        setTitle(item.title);
    }, [item.title]);
    useEffect(() => {
        setNotesBody(ensureNonEmpty(item.notes));
    }, [item.notes]);

    // Paste a URL over a selected word → "[word](url)" in both the title
    // editor (only mounted while editing) and the subitem-add input.
    useLinkifyPaste(titleInputRef, title, setTitle, isEditingTitle);
    useLinkifyPaste(subitemInputRef, newSubitemTitle, setNewSubitemTitle, subitemAddOpen);

    // Periodic notes auto-save while expanded — mirrors the prior
    // TodoBubble cadence (was 3s for the whole-day doc; tighter here
    // since each item is small). An "effectively empty" body (single
    // empty paragraph or [] ) persists as null so the row carries no
    // notes server-side.
    useEffect(() => {
        if (!notesExpanded) return;
        const id = setInterval(() => {
            if (notesDirtyRef.current) {
                notesDirtyRef.current = false;
                onNotesCommit(item.itemId, isEffectivelyEmpty(notesBody) ? null : notesBody);
            }
        }, NOTES_SAVE_INTERVAL_MS);
        return () => clearInterval(id);
    }, [notesExpanded, notesBody, item.itemId, onNotesCommit]);

    const flushNotesIfDirty = () => {
        if (notesDirtyRef.current) {
            notesDirtyRef.current = false;
            onNotesCommit(item.itemId, isEffectivelyEmpty(notesBody) ? null : notesBody);
        }
    };

    // Purple accent family, matching the pane's header/footer styling.
    const accentBg = isDark
        ? "rgba(var(--gp-brandalt-400-rgb), 0.14)"
        : "rgba(var(--gp-brand-700-rgb), 0.08)";
    const accentRing = isDark
        ? "rgba(var(--gp-brandalt-400-rgb), 0.6)"
        : "rgba(var(--gp-brand-700-rgb), 0.45)";

    return (
        <Box
            ref={rootRef}
            sx={{
                borderRadius: "8px",
                px: 1,
                py: 0.75,
                // Tint the row while it's the deep-link target or being
                // edited so the user can tell which todo is active; the
                // ring is reserved for the URL target (unmistakable even
                // next to hover/edit tints).
                background: isHighlighted || isEditingTitle ? accentBg : undefined,
                boxShadow: isHighlighted ? `inset 0 0 0 1.5px ${accentRing}` : undefined,
                "&:hover": {
                    background:
                        isHighlighted || isEditingTitle
                            ? accentBg
                            : isDark
                              ? "rgba(255,255,255,0.03)"
                              : "rgba(0,0,0,0.02)",
                },
            }}
        >
            <Stack alignItems="center" direction="row" spacing={1}>
                <Checkbox
                    checked={item.isCompleted}
                    size="sm"
                    onChange={(e) => onToggleComplete(item.itemId, e.target.checked)}
                />
                {isEditingTitle ? (
                    <Input
                        // Select a word, paste a URL → the word becomes
                        // "[word](url)"; the paste is handled by a native paste
                        // listener wired to this ref (see the effect above).
                        placeholder={t.chat.todoPane.untitled}
                        size="sm"
                        slotProps={{ input: { ref: titleInputRef } }}
                        value={title}
                        variant="plain"
                        sx={{
                            flex: 1,
                            fontSize: "0.9rem",
                            // Sit flush with the row — no border/background chrome.
                            background: "transparent",
                            minHeight: 0,
                            py: 0,
                            "& input": {
                                px: 0,
                                textDecoration: item.isCompleted ? "line-through" : undefined,
                                opacity: item.isCompleted ? 0.55 : 1,
                            },
                        }}
                        autoFocus
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => {
                            if (skipTitleCommitRef.current) {
                                skipTitleCommitRef.current = false;
                                setTitle(item.title);
                            } else if (title !== item.title) {
                                onTitleCommit(item.itemId, title);
                            }
                            setIsEditingTitle(false);
                        }}
                        onKeyDown={(e) => {
                            // Enter commits (blur fires onTitleCommit); Escape
                            // cancels and restores the last-saved title. Both
                            // just blur — onBlur owns the commit/restore logic.
                            if (e.key === "Enter") {
                                e.preventDefault();
                                e.currentTarget.blur();
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                skipTitleCommitRef.current = true;
                                e.currentTarget.blur();
                            }
                        }}
                    />
                ) : (
                    <Box
                        sx={{
                            flex: 1,
                            fontSize: "0.9rem",
                            lineHeight: 1.5,
                            cursor: "text",
                            wordBreak: "break-word",
                            textDecoration: item.isCompleted ? "line-through" : undefined,
                            opacity: item.isCompleted ? 0.55 : 1,
                            color: title
                                ? undefined
                                : isDark
                                  ? "rgba(255,255,255,0.4)"
                                  : "rgba(0,0,0,0.4)",
                        }}
                        onClick={() => setIsEditingTitle(true)}
                    >
                        {title
                            ? renderTitleWithLinks(title, urlLinkModal)
                            : t.chat.todoPane.untitled}
                    </Box>
                )}
                {/* When this was completed. `tsCompletedAt` was already
                    persisted and serialized server-side but never
                    surfaced, so "what did I finish today?" was
                    unanswerable from the list — the whole reason the
                    Completed Today tab exists.
                    Date AND time, because the group's own date is when
                    the work was PLANNED: on the All tab an item ticked
                    off days later would otherwise show a clock time with
                    nothing to anchor it to. The tooltip carries the full
                    timestamp including the year. */}
                {item.isCompleted && item.tsCompletedAt && (
                    <AppTooltip
                        title={fmt(t.chat.todoPane.completedTooltip, {
                            time: extractYYYYMMDDHHMM(item.tsCompletedAt),
                        })}
                    >
                        <Box
                            sx={{
                                flexShrink: 0,
                                fontSize: "0.7rem",
                                fontVariantNumeric: "tabular-nums",
                                whiteSpace: "nowrap",
                                color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                            }}
                        >
                            {formatCompletedAt(item.tsCompletedAt)}
                        </Box>
                    </AppTooltip>
                )}
                <AppTooltip
                    title={
                        notesExpanded ? t.chat.todoPane.collapseNotes : t.chat.todoPane.expandNotes
                    }
                >
                    <IconButton
                        size="sm"
                        sx={{ borderRadius: "6px" }}
                        variant="plain"
                        onClick={() => {
                            if (notesExpanded) flushNotesIfDirty();
                            setNotesExpanded((v) => !v);
                        }}
                    >
                        {notesExpanded ? (
                            <ExpandLessRoundedIcon sx={{ fontSize: 18 }} />
                        ) : (
                            <ExpandMoreRoundedIcon sx={{ fontSize: 18 }} />
                        )}
                    </IconButton>
                </AppTooltip>
                {/* "+ subitem" only on top-level rows. */}
                {!isChild && onAddSubitem && (
                    <AppTooltip title={t.chat.todoPane.addSubitem}>
                        <IconButton
                            size="sm"
                            sx={{ borderRadius: "6px" }}
                            variant="plain"
                            onClick={() => setSubitemAddOpen((v) => !v)}
                        >
                            <SubdirectoryArrowRightRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </AppTooltip>
                )}
                {/* Secondary actions (copy link / tag / delete) live behind
                    one ⋮ menu — five inline icons per row was too noisy. */}
                <TodoItemMoreMenu
                    categories={categories}
                    currentCategoryId={item.categoryId}
                    isChild={isChild}
                    linkCopied={linkCopied}
                    reminderLabel={
                        reminder
                            ? fmt(t.chat.todoPane.remindMe.setFor, {
                                  time: formatReminderTime(new Date(reminder.remindAt), locale),
                              })
                            : null
                    }
                    onCopyLink={handleCopyLink}
                    onCreateCategory={onCategoryCreate}
                    onCreateTask={() => setCreateTaskOpen(true)}
                    onDelete={() => onDelete(item.itemId)}
                    onRemindMe={canRemind ? () => setRemindMeOpen(true) : undefined}
                    onSelectCategory={(categoryId) => onCategoryChange(item.itemId, categoryId)}
                />
                {/* Mounted only while open, like the task modal above. */}
                {remindMeOpen && onSetReminder && onCancelReminder && (
                    <ModalRemindMe
                        description={t.chat.todoPane.remindMe.description}
                        open={remindMeOpen}
                        remindAt={reminder?.remindAt}
                        onClose={() => setRemindMeOpen(false)}
                        onCommit={(at) => onSetReminder(item.itemId, at)}
                        onRemove={() => onCancelReminder(item.itemId)}
                    />
                )}
                {/* Mounted only while open so the project fetch inside
                    fires per use, not once per rendered to-do row. */}
                {createTaskOpen && (
                    <ModalCreateTaskFromTodo
                        myself={myself}
                        open={createTaskOpen}
                        todoNotes={item.notes}
                        todoTitle={item.title}
                        // Resolves each project option's avatar from its
                        // PM chat, matching the task-side pickers.
                        useCM={useCM}
                        onClose={() => setCreateTaskOpen(false)}
                    />
                )}
            </Stack>
            {notesExpanded && (
                <Box
                    sx={{
                        mt: 0.5,
                        mx: 0,
                        borderRadius: "8px",
                        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        overflow: "hidden",
                        // BnTodoPreview ships with px: "10px" + BlockNote's
                        // own gutter — together they leave the cursor
                        // floating a long way from the border. Trim both
                        // down to a single small inset so there's breathing
                        // room without wasting horizontal space.
                        "& .bn-editor": { paddingInline: "16px" },
                        "& [class*='-todo-item-notes-']": { px: "24px" },
                    }}
                >
                    <TodoNotesEditor
                        body={notesBody}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                        setBody={(b) => {
                            setNotesBody(b);
                        }}
                        onEdited={() => {
                            notesDirtyRef.current = true;
                        }}
                    />
                </Box>
            )}

            {/* Subitems: render children indented under the parent
                row. Each child is a TodoItemRow with no subitems of its
                own (one-level cap) and no add-subitem affordance. */}
            {!isChild && (subitems.length > 0 || subitemAddOpen) && (
                <Box
                    sx={{
                        pl: 3,
                        ml: 1,
                        borderLeft: "2px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                    }}
                >
                    {subitems.map((child) => (
                        <TodoItemRow
                            key={child.itemId}
                            categories={categories}
                            highlightItemId={highlightItemId}
                            item={child}
                            localDate={localDate}
                            myself={myself}
                            reminderByItemId={reminderByItemId}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            onCancelReminder={onCancelReminder}
                            onCategoryChange={onCategoryChange}
                            onCategoryCreate={onCategoryCreate}
                            onDelete={onDelete}
                            onNotesCommit={onNotesCommit}
                            onSetReminder={onSetReminder}
                            onTitleCommit={onTitleCommit}
                            onToggleComplete={onToggleComplete}
                        />
                    ))}

                    {subitemAddOpen && (
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={1}
                            sx={{ mt: 0.25, px: 1 }}
                        >
                            <Input
                                placeholder={t.chat.todoPane.addSubitemPlaceholder}
                                size="sm"
                                slotProps={{ input: { ref: subitemInputRef } }}
                                value={newSubitemTitle}
                                variant="plain"
                                sx={{
                                    flex: 1,
                                    fontSize: "0.85rem",
                                    "& input": { px: 0 },
                                }}
                                autoFocus
                                onChange={(e) => setNewSubitemTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddSubitem();
                                    } else if (e.key === "Escape") {
                                        setSubitemAddOpen(false);
                                        setNewSubitemTitle("");
                                    }
                                }}
                            />
                            {newSubitemTitle.trim() && (
                                <IconButton
                                    size="sm"
                                    sx={{ borderRadius: "6px" }}
                                    variant="soft"
                                    onClick={handleAddSubitem}
                                >
                                    <AddIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            )}
                        </Stack>
                    )}
                </Box>
            )}
        </Box>
    );
};
