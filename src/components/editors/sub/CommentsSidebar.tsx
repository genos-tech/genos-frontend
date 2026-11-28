import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommentsExtension, type ThreadData } from "@blocknote/core/comments";
import {
    getReferenceText,
    useBlockNoteEditor,
    useExtension,
    useExtensionState,
    useThreads,
} from "@blocknote/react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import { Box, Chip, IconButton, Sheet, Typography } from "@mui/joy";

import { viaSourceOfNoteComment } from "../../../features/tasks/utils/viaSource";
import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { BaseAvatar } from "../../ui/avatars/BaseAvatar";
import { Bubble, BubbleAuthor, BubbleMeta } from "../../ui/bubble";
import { EmptyState } from "../../ui/feedback/EmptyState";
import { ViaChip } from "../../ui/misc/ViaChip";
import { paneDivider } from "../../ui/paneDivider";
import { TOUCH_TARGET } from "../../ui/touchTargets";
import { commentFirstLine } from "./commentMentions";
import { useNoteLink } from "./NoteLinkContext";
import { useCommentAuthor } from "./useCommentAuthor";

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
//
// On a phone (`overlay`, MIP-1763) there is no room for a 340px column beside the note: it
// squeezed the note to a sliver. There the panel is a sheet laid over the editor instead,
// with its own Close in the header (the floating toggle is under it), Escape to leave, and
// focus handed to the Close on open. Tapping a row closes the sheet and opens that thread's
// card over the note: the note is hidden while the sheet is up, so a card pinned beside it
// would point at text nobody can see. The desktop layout does not go through any of this.
// ─────────────────────────────────────────────────────────────────────────

/** Panel width when open. The editors shift their top-right affordance cluster
 *  by this much (plus a gap) so the wrap toggles clear the panel. Exported so
 *  the one offset lives in one place. */
export const COMMENTS_SIDEBAR_WIDTH = 340;

/** Layer of the phone sheet: above the note's title row (100, GenosNoteEditor) and the
 *  floating toggle (11) it covers, below BlockNote's own floating UI (App.css, 13300+),
 *  so a thread's card and the menus still open over it. */
const COMMENTS_OVERLAY_Z_INDEX = 110;

type CommentsSidebarProps = {
    open: boolean;
    /** Lay the panel over the editor instead of docking it beside it: a phone. */
    overlay?: boolean;
    /** The note's project or chat is archived: say so; nobody can comment or reply (MIP-1693). */
    archived?: boolean;
    /** Close the panel (the overlay's Close, Escape, a tapped row). The editor takes focus
     *  back to its "Show comments" button here. Only used with `overlay`. */
    onClose?: () => void;
};

/**
 * A best-effort local relative-time formatter (no new dep), mirroring the one
 * the task activity feed uses. Falls back to a date past a week, in the app's language (not the browser's).
 */
const useRelativeTime = () => {
    const { t, locale } = useTranslation();
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
        return date.toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };
};

const noWrap = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

// A list row in a narrow panel, not a full-width chat row: rounded, padded all
// round, no accent bar (the rest comes from the shared Bubble).
const rowSx = {
    borderInlineStartWidth: 0,
    borderRadius: g.radius.sm,
    cursor: "pointer",
    px: 1,
    py: 1,
    width: "100%",
} as const;

type ThreadRowProps = {
    thread: ThreadData;
    referenceText: string;
    selected: boolean;
    onSelect: (threadId: string) => void;
    onHover: (threadId: string) => void;
};

// One thread = one row. Split into its own component because it calls
// `useCommentAuthor` (a hook) for the author — hooks can't run in a `.map()` loop.
// `useCommentAuthor` returns undefined (never throws) when the user isn't cached yet;
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
        const author = useCommentAuthor(firstComment?.userId ?? "");
        const preview = commentFirstLine(firstComment?.body);
        const replyCount = Math.max(0, thread.comments.length - 1);
        // "Written through a connected AI app" (MIP-1752): the mark of the comment whose author
        // the row shows. It sits next to that name, as on a task comment card.
        const via = firstComment ? viaSourceOfNoteComment(firstComment) : null;
        const authorName = author?.username || copy.unknownAuthor;
        const lastActivityAt = lastComment?.createdAt ?? thread.createdAt;
        // "Copy link to comment" (MIP-146). Offered only in a note that has a page to link to.
        const noteLink = useNoteLink();
        const link = noteLink?.commentLink(thread.id) ?? null;

        return (
            <Box
                sx={{
                    position: "relative",
                    // Shown on hover or keyboard focus, always on a touch screen (no hover there).
                    "& .copy-comment-link": { opacity: 0 },
                    "&:hover .copy-comment-link, &:focus-within .copy-comment-link": {
                        opacity: 1,
                    },
                    "@media (hover: none)": { "& .copy-comment-link": { opacity: 1 } },
                }}
            >
                <Bubble
                    align="stacked"
                    aria-pressed={selected}
                    avatar={<BaseAvatar name={authorName} src={author?.avatarUrl || undefined} />}
                    bodyOffset={0.5}
                    component="button"
                    layout="compact"
                    selected={selected}
                    sx={rowSx}
                    footer={
                        replyCount > 0 || thread.resolved ? (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                {thread.resolved && (
                                    <Chip
                                        color="success"
                                        size="sm"
                                        variant="soft"
                                        startDecorator={
                                            <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />
                                        }
                                    >
                                        {copy.resolved}
                                    </Chip>
                                )}
                                {replyCount > 0 && (
                                    <BubbleMeta>
                                        {fmt(copy.replies, { count: replyCount })}
                                    </BubbleMeta>
                                )}
                            </Box>
                        ) : undefined
                    }
                    header={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.75,
                                    flex: 1,
                                    minWidth: 0,
                                }}
                            >
                                <BubbleAuthor sx={{ minWidth: 0, ...noWrap }}>
                                    {authorName}
                                </BubbleAuthor>
                                {via && <ViaChip size="sm" source={via} />}
                            </Box>
                            <BubbleMeta sx={{ flexShrink: 0 }}>
                                {formatRelative(lastActivityAt)}
                            </BubbleMeta>
                        </Box>
                    }
                    grouped
                    interactive
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
                >
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0 }}>
                        {referenceText && (
                            <Typography
                                level="body-xs"
                                sx={{
                                    maxWidth: "100%",
                                    color: g.text.secondary,
                                    borderInlineStart: "2px solid",
                                    borderColor: g.border.default,
                                    ps: 1,
                                    fontStyle: "italic",
                                }}
                                noWrap
                            >
                                {referenceText}
                            </Typography>
                        )}

                        <Typography
                            level="body-sm"
                            sx={{
                                width: "100%",
                                color: preview ? g.text.primary : g.text.tertiary,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}
                        >
                            {preview || copy.emptyComment}
                        </Typography>
                    </Box>
                </Bubble>
                {noteLink && link && (
                    // A SIBLING of the row, not inside it: the row is a <button>, and a button cannot
                    // hold another. The pointerdown stop is the row's (see above): a press here must
                    // not reach the floating card's outside-press dismiss.
                    <IconButton
                        aria-label={t.common.editor.noteLink.copyCommentLink}
                        className="copy-comment-link"
                        data-testid="copy-comment-link"
                        size="sm"
                        title={t.common.editor.noteLink.copyCommentLink}
                        variant="plain"
                        sx={{
                            position: "absolute",
                            insetInlineEnd: 4,
                            bottom: 4,
                            "--IconButton-size": "24px",
                            transition: "opacity 0.15s",
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                            event.stopPropagation();
                            void noteLink.copy(link);
                        }}
                    >
                        <LinkRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
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
export const CommentsSidebar = ({
    open,
    overlay = false,
    archived = false,
    onClose,
}: CommentsSidebarProps) => {
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

    const handleSelect = useCallback(
        (threadId: string) => {
            if (overlay) {
                // The sheet hides the note, so open the card and leave: it opens next to its
                // text, over the note. Driven here, not through the pin: closing resets the
                // pin, and the effect that follows it would never run.
                comments.selectThread(threadId, true);
                onClose?.();
                return;
            }
            // Click toggles the pin: pin this thread (its card stays after the
            // mouse leaves), or unpin if it was already the pinned one.
            setPinnedThreadId((prev) => (prev === threadId ? null : threadId));
        },
        [overlay, onClose, comments]
    );

    const handleHover = useCallback(
        (threadId: string) => {
            // A touch screen sends a mouseenter before the tap: no preview behind the sheet.
            if (!overlay) {
                setHoveredThreadId(threadId);
            }
        },
        [overlay]
    );

    // Phone sheet: focus starts on its Close, so Escape works and a screen reader lands in it.
    const closeRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (open && overlay) {
            closeRef.current?.focus();
        }
    }, [open, overlay]);

    const clearHover = useCallback(() => {
        setHoveredThreadId(null);
    }, []);

    if (!open) {
        return null;
    }

    const title = rows.length > 0 ? fmt(copy.titleWithCount, { count: rows.length }) : copy.title;

    return (
        <Sheet
            aria-label={copy.title}
            className="bn-comments-sidebar"
            data-layout={overlay ? "overlay" : "dock"}
            role="complementary"
            sx={
                overlay
                    ? {
                          // Over the editor box (the nearest positioned ancestor), edge to edge.
                          position: "absolute",
                          inset: 0,
                          zIndex: COMMENTS_OVERLAY_Z_INDEX,
                          minWidth: 0,
                          minHeight: 0,
                          display: "flex",
                          flexDirection: "column",
                          bgcolor: "background.surface",
                      }
                    : {
                          width: COMMENTS_SIDEBAR_WIDTH,
                          flexShrink: 0,
                          height: "100%",
                          minHeight: 0,
                          display: "flex",
                          flexDirection: "column",
                          borderInlineStart: paneDivider,
                          bgcolor: "background.surface",
                      }
            }
            onKeyDown={
                overlay
                    ? (event) => {
                          // A card that is open takes the first Escape (BlockNote closes it
                          // on a document listener that runs after this one); the sheet the second.
                          if (event.key === "Escape" && !selectedThreadIdRef.current) {
                              event.stopPropagation();
                              onClose?.();
                          }
                      }
                    : undefined
            }
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
                    ...(overlay
                        ? { paddingInlineStart: 1.5, paddingInlineEnd: 0.5 }
                        : { pl: 1.5, pr: 6 }),
                    py: 1,
                    minHeight: 40,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    flexShrink: 0,
                }}
            >
                <Typography level="title-sm" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                    {title}
                </Typography>
                {overlay && (
                    // The way back: the floating toggle is under the sheet. Same name as
                    // that toggle's "open" state, so the pair reads as one control.
                    <IconButton
                        ref={closeRef}
                        aria-label={t.common.editor.hideComments}
                        color="neutral"
                        size="sm"
                        sx={{ minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET, flexShrink: 0 }}
                        variant="soft"
                        onClick={onClose}
                    >
                        <CloseRoundedIcon />
                    </IconButton>
                )}
            </Box>

            {archived && (
                <Typography
                    level="body-xs"
                    role="note"
                    sx={{ px: 1.5, py: 1, color: "text.tertiary" }}
                >
                    {t.common.archive.projectBannerBody}
                </Typography>
            )}

            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 1 }}>
                {rows.length === 0 ? (
                    <EmptyState body={copy.empty} data-empty="note-comments" />
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
                                referenceText={referenceText}
                                selected={thread.id === selectedThreadId}
                                thread={thread}
                                onHover={handleHover}
                                onSelect={handleSelect}
                            />
                        ))}
                    </Box>
                )}
            </Box>
        </Sheet>
    );
};
