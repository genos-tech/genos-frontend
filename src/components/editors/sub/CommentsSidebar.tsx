import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommentsExtension, type ThreadData } from "@blocknote/core/comments";
import {
    getReferenceText,
    useBlockNoteEditor,
    useExtension,
    useExtensionState,
    useThreads,
    useUser,
} from "@blocknote/react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { Avatar, Box, Chip, Sheet, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { commentFirstLine } from "./commentMentions";

// ─────────────────────────────────────────────────────────────────────────
// A custom "show all comments" sidebar for the collaborative note editors.
//
// This is a FRONTEND-ONLY view over the comment threads that already live in
// the editor's Yjs document (Django never sees comment content). It reads the
// same client-side thread data BlockNote's own docked `ThreadsSidebar` reads —
// `useThreads()` for the threads, the CommentsExtension store for their
// document positions — but renders our own rows.
//
// Interaction (all via the existing `selectThread` seam, which opens/scrolls
// the floating comment card through the always-mounted
// `FloatingThreadController`, exactly like clicking the highlighted text):
//   • Hover a row  → previews that thread's card (opens + scrolls to it).
//   • Leave the list → the preview reverts to the pinned thread, or closes.
//   • Click a row  → PINS that thread so its card stays open after the mouse
//     leaves; clicking the pinned row again unpins (closes) it.
//   • Click outside the card (or press escape) → dismisses AND unpins it, just
//     like the native card: the sidebar adopts BlockNote's selection as truth.
// The sidebar itself stays open throughout — it is closed only by its toggle.
//
// No new comments, no API, no server work — a read-only lens plus the existing
// open-card seam.
//
// Rendered as a sibling of `.bn-editor-section` inside `.bn-editor-with-sidebar`
// (a flex row), so it sits INSIDE `<BlockNoteView>` and can use the comment
// hooks. When `open` is false it renders nothing, so the editor is full-width.
// ─────────────────────────────────────────────────────────────────────────

/** Panel width when open. The editors shift their top-right affordance cluster
 *  by this much (plus a gap) so the wrap toggles clear the panel. Exported so
 *  the one offset lives in one place. */
export const COMMENTS_SIDEBAR_WIDTH = 340;

type CommentsSidebarProps = {
    open: boolean;
};

/**
 * A best-effort local relative-time formatter (no new dep), mirroring the one
 * the task activity feed uses. Falls back to a locale date past a week.
 */
const useRelativeTime = () => {
    const { t } = useTranslation();
    const rel = t.common.editor.commentsSidebar;
    return (date: Date): string => {
        const ts = date instanceof Date ? date.getTime() : NaN;
        if (Number.isNaN(ts)) {
            return "";
        }
        const minutes = Math.floor((Date.now() - ts) / 60_000);
        if (minutes < 1) {
            return rel.justNow;
        }
        if (minutes < 60) {
            return fmt(rel.minutesAgo, { count: minutes });
        }
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return fmt(rel.hoursAgo, { count: hours });
        }
        const days = Math.floor(hours / 24);
        if (days < 7) {
            return fmt(rel.daysAgo, { count: days });
        }
        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };
};

type ThreadRowProps = {
    thread: ThreadData;
    referenceText: string;
    selected: boolean;
    onSelect: (threadId: string) => void;
    onHover: (threadId: string) => void;
};

// One thread = one row. Split into its own component because it calls
// `useUser` (a hook) for the author — hooks can't run in a `.map()` loop.
// `useUser` returns undefined (never throws) when the user isn't cached yet;
// the `CommentsUserPreloader` warms these before any card/row renders, so the
// fallback below is only ever hit transiently.
const ThreadRow = memo(
    ({ thread, referenceText, selected, onSelect, onHover }: ThreadRowProps) => {
        const { t } = useTranslation();
        const copy = t.common.editor.commentsSidebar;
        const formatRelative = useRelativeTime();

        // The thread starter is the first comment's author; the preview is that
        // comment's first line of text (with `@name` for mentions), reusing the
        // exact extractor the activity feed / push path uses. The timestamp,
        // though, is the LAST comment's time — the row reads like a thread: who
        // started it + what it said, but how recently it was last touched.
        const firstComment = thread.comments[0];
        const lastComment = thread.comments[thread.comments.length - 1];
        const author = useUser(firstComment?.userId ?? "");
        const preview = commentFirstLine(firstComment?.body);
        const replyCount = Math.max(0, thread.comments.length - 1);
        const authorName = author?.username || copy.unknownAuthor;
        const lastActivityAt = lastComment?.createdAt ?? thread.createdAt;

        return (
            <Box
                component="button"
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(thread.id)}
                onMouseEnter={() => onHover(thread.id)}
                // The floating comment card wires floating-ui `useDismiss` with
                // its defaults — `outsidePress` on `pointerdown`, bubble phase,
                // listening on `document`. A pointerdown on this row bubbles up
                // to that listener, which counts as an outside-press and tears
                // the card down (`selectThread(undefined)`) — the very card we're
                // about to pin. Stop the pointerdown here so it never reaches
                // that document listener: the card the click pins stays up (no
                // dismiss-then-reopen flicker). The `onClick` still fires. The
                // reconciliation effect stays correct even without this, but this
                // removes the visible flicker at the source.
                onPointerDown={(event) => event.stopPropagation()}
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                    width: "100%",
                    textAlign: "start",
                    border: "none",
                    borderRadius: "sm",
                    p: 1,
                    cursor: "pointer",
                    bgcolor: selected ? "primary.softBg" : "transparent",
                    font: "inherit",
                    color: "text.primary",
                    "&:hover": {
                        bgcolor: selected ? "primary.softBg" : "background.level1",
                    },
                    "&:focus-visible": {
                        outline: "2px solid",
                        outlineColor: "primary.outlinedBorder",
                        outlineOffset: "-2px",
                    },
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                    <Avatar size="sm" src={author?.avatarUrl || undefined}>
                        {authorName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography
                        level="title-sm"
                        noWrap
                        sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}
                    >
                        {authorName}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: "text.tertiary", flexShrink: 0 }}>
                        {formatRelative(lastActivityAt)}
                    </Typography>
                </Box>

                {referenceText && (
                    <Typography
                        level="body-xs"
                        noWrap
                        sx={{
                            maxWidth: "100%",
                            color: "text.secondary",
                            borderInlineStart: "2px solid",
                            borderColor: "neutral.outlinedBorder",
                            pl: 1,
                            fontStyle: "italic",
                        }}
                    >
                        {referenceText}
                    </Typography>
                )}

                <Typography
                    level="body-sm"
                    sx={{
                        width: "100%",
                        color: preview ? "text.primary" : "text.tertiary",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}
                >
                    {preview || copy.emptyComment}
                </Typography>

                {(replyCount > 0 || thread.resolved) && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
                        {thread.resolved && (
                            <Chip
                                color="success"
                                size="sm"
                                variant="soft"
                                startDecorator={<CheckCircleRoundedIcon sx={{ fontSize: 14 }} />}
                            >
                                {copy.resolved}
                            </Chip>
                        )}
                        {replyCount > 0 && (
                            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                                {fmt(copy.replies, { count: replyCount })}
                            </Typography>
                        )}
                    </Box>
                )}
            </Box>
        );
    }
);
ThreadRow.displayName = "ThreadRow";

/**
 * The custom comments sidebar. Reads all threads in the current editor and
 * renders one row each, sorted by document position (like BlockNote's own
 * `sort="position"`). Hovering a row previews its floating card; clicking pins
 * it; dismissing the card (click-outside/escape) unpins it. The sidebar stays
 * open — it's closed only by its toggle.
 *
 * Must be rendered inside `<BlockNoteView>` (it uses the comment hooks). Renders
 * nothing when `open` is false.
 */
export const CommentsSidebar = ({ open }: CommentsSidebarProps) => {
    const { t } = useTranslation();
    const copy = t.common.editor.commentsSidebar;
    const editor = useBlockNoteEditor();
    const comments = useExtension(CommentsExtension);
    const { threadPositions, selectedThreadId } = useExtensionState(CommentsExtension);
    const threads = useThreads();

    // Which thread's card is showing. `pinned` is the sticky one (set by a
    // click); `hovered` is the transient preview. The hovered one wins while
    // the mouse is over a row, and we fall back to the pinned one when it
    // leaves — so a click keeps the card up after the pointer moves away.
    const [pinnedThreadId, setPinnedThreadId] = useState<string | null>(null);
    const [hoveredThreadId, setHoveredThreadId] = useState<string | null>(null);

    // Sort by the reference mark's document position so rows read top-to-bottom
    // like the note itself — the same ordering BlockNote's `sort="position"`
    // uses. Threads whose mark was deleted (no position) sink to the bottom.
    // Soft-deleted threads are dropped entirely.
    //
    // Bail out entirely when closed: the sidebar stays mounted (it lives inside
    // <BlockNoteView>) and `threadPositions` gets a fresh Map on every keystroke,
    // so without this guard the memo would recompute — and call
    // `getReferenceText` (an `editor.transact`) once per thread — on every typed
    // character even with the panel hidden. `getReferenceText` is also skipped
    // for position-less threads: it would otherwise return the hardcoded English
    // "Original content deleted" literal, which we don't want to leak into other
    // locales — a missing position simply means no reference snippet.
    const rows = useMemo(() => {
        if (!open) {
            return [];
        }
        const visible = Array.from(threads.values()).filter((thread) => !thread.deletedAt);
        visible.sort(
            (a, b) =>
                (threadPositions.get(a.id)?.from ?? Number.MAX_VALUE) -
                (threadPositions.get(b.id)?.from ?? Number.MAX_VALUE)
        );
        return visible.map((thread) => {
            const position = threadPositions.get(thread.id);
            return {
                thread,
                referenceText: position ? getReferenceText(editor, position) : "",
            };
        });
    }, [open, threads, threadPositions, editor]);

    // Drive the floating card from the active thread (hover preview falling
    // back to the pinned one). `selectThread(id, true)` opens + scrolls the
    // card, `selectThread(undefined)` closes it — the same seam clicking the
    // highlighted text uses.
    //
    // The card is NOT ours alone: BlockNote's `FloatingThreadController` closes
    // it out-of-band on any dismiss (escape, click-outside — and a click on one
    // of our rows counts as a click-outside) by calling `selectThread(undefined)`
    // itself. So we must not trust a local "what card is showing" shadow — it
    // goes stale the instant BlockNote tears the card down behind our back, and
    // a stale shadow then wedges the guard and blocks every re-open (the odd/
    // even-click desync). Reconcile against BlockNote's LIVE `selectedThreadId`
    // (the authority) instead: open the active thread whenever it isn't already
    // the one showing. Read it through a ref so a bare selection drift doesn't
    // re-run this effect and fight a genuine dismiss — the effect still runs on
    // every hover/click, and reads the true current selection when it does.
    const selectedThreadIdRef = useRef<string | undefined>(selectedThreadId);
    selectedThreadIdRef.current = selectedThreadId;

    // Tracks the last thread WE drove selection to. Doubles as our record of
    // "the selection we're in step with": going inactive only retracts a card
    // whose id still matches this (see below), and the adopt-authority effect
    // treats any divergence from it as a change the user made outside the panel.
    const appliedThreadRef = useRef<string | null>(null);
    useEffect(() => {
        if (!open) {
            return;
        }
        const active = hoveredThreadId ?? pinnedThreadId;
        const showing = selectedThreadIdRef.current ?? null;
        if (active) {
            if (showing !== active) {
                comments.selectThread(active, true);
            }
        } else if (appliedThreadRef.current) {
            comments.selectThread(undefined);
        }
        appliedThreadRef.current = active;
    }, [open, hoveredThreadId, pinnedThreadId, comments]);

    // Adopt authority: reflect selection changes the user made OUTSIDE the panel
    // back into our pin. `selectedThreadId` moving to something other than the
    // thread we last drove means the user dismissed the card (clicked outside /
    // pressed escape → undefined) or clicked a different highlight (→ its id).
    // Either way the pin should follow: a dismiss clears it (so the card doesn't
    // revive on the next hover), and a new selection re-points it (so the panel
    // reflects and keeps the card the user opened). Because this only fires when
    // BlockNote's selection genuinely diverges from what we drove, it can't fight
    // our own hover/click drive above, and it doesn't loop — once the pin matches
    // the live selection, the driver leaves it be.
    useEffect(() => {
        if (!open) {
            return;
        }
        const live = selectedThreadId ?? null;
        if (live !== appliedThreadRef.current) {
            appliedThreadRef.current = live;
            setPinnedThreadId(live);
        }
    }, [open, selectedThreadId]);

    // Closing the sidebar is a clean slate: drop hover + pin and forget what we
    // applied. We deliberately do NOT force the card closed here — it's
    // independent of the panel, so a card left open stays until the user acts.
    useEffect(() => {
        if (!open) {
            setHoveredThreadId(null);
            setPinnedThreadId(null);
            appliedThreadRef.current = null;
        }
    }, [open]);

    const handleSelect = useCallback((threadId: string) => {
        // Click toggles the pin: pin this thread (its card stays after the
        // mouse leaves), or unpin if it was already the pinned one.
        setPinnedThreadId((prev) => (prev === threadId ? null : threadId));
    }, []);

    const handleHover = useCallback((threadId: string) => {
        setHoveredThreadId(threadId);
    }, []);

    const clearHover = useCallback(() => {
        setHoveredThreadId(null);
    }, []);

    if (!open) {
        return null;
    }

    return (
        <Sheet
            className="bn-comments-sidebar"
            role="complementary"
            aria-label={copy.title}
            sx={{
                width: COMMENTS_SIDEBAR_WIDTH,
                flexShrink: 0,
                height: "100%",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                borderInlineStart: "1px solid",
                borderColor: "divider",
                bgcolor: "background.surface",
            }}
        >
            {/* Header shows only the title. The open/close control is the
                floating comment button pinned to the top-right corner
                (`CommentsSidebarToggle`), which overlaps this header — so a
                second close button here would just stack on top of it. Pad the
                end so the title clears that floating button. */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    pl: 1.5,
                    pr: 6,
                    py: 1,
                    minHeight: 40,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    flexShrink: 0,
                }}
            >
                <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                    {rows.length > 0
                        ? fmt(copy.titleWithCount, { count: rows.length })
                        : copy.title}
                </Typography>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 1 }}>
                {rows.length === 0 ? (
                    <Typography
                        level="body-sm"
                        sx={{ color: "text.tertiary", textAlign: "center", px: 2, py: 4 }}
                    >
                        {copy.empty}
                    </Typography>
                ) : (
                    // Leaving the list (not just one row) drops the hover
                    // preview; moving between rows stays inside it, so the
                    // preview follows the pointer without a flicker to null.
                    <Box
                        sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
                        onMouseLeave={clearHover}
                    >
                        {rows.map(({ thread, referenceText }) => (
                            <ThreadRow
                                key={thread.id}
                                thread={thread}
                                referenceText={referenceText}
                                selected={thread.id === selectedThreadId}
                                onSelect={handleSelect}
                                onHover={handleHover}
                            />
                        ))}
                    </Box>
                )}
            </Box>
        </Sheet>
    );
};
