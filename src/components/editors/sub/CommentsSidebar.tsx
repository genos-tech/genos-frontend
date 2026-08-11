import { memo, useCallback, useMemo } from "react";
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
// document positions — but renders our own rows and, crucially, on click
// behaves like clicking the highlighted text: it `selectThread`s the thread
// (which opens the floating comment card via the always-mounted
// `FloatingThreadController`) and closes the sidebar. No new comments, no API,
// no server work — a read-only lens plus the existing open-card seam.
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
    onClose: () => void;
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
};

// One thread = one row. Split into its own component because it calls
// `useUser` (a hook) for the author — hooks can't run in a `.map()` loop.
// `useUser` returns undefined (never throws) when the user isn't cached yet;
// the `CommentsUserPreloader` warms these before any card/row renders, so the
// fallback below is only ever hit transiently.
const ThreadRow = memo(({ thread, referenceText, selected, onSelect }: ThreadRowProps) => {
    const { t } = useTranslation();
    const copy = t.common.editor.commentsSidebar;
    const formatRelative = useRelativeTime();

    // The thread starter is the first comment's author; the preview is that
    // comment's first line of text (with `@name` for mentions), reusing the
    // exact extractor the activity feed / push path uses.
    const firstComment = thread.comments[0];
    const author = useUser(firstComment?.userId ?? "");
    const preview = commentFirstLine(firstComment?.body);
    const replyCount = Math.max(0, thread.comments.length - 1);
    const authorName = author?.username || copy.unknownAuthor;

    return (
        <Box
            component="button"
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(thread.id)}
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
                <Typography level="title-sm" noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}>
                    {authorName}
                </Typography>
                <Typography level="body-xs" sx={{ color: "text.tertiary", flexShrink: 0 }}>
                    {formatRelative(thread.createdAt)}
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
});
ThreadRow.displayName = "ThreadRow";

/**
 * The custom comments sidebar. Reads all threads in the current editor and
 * renders one row each, sorted by document position (like BlockNote's own
 * `sort="position"`). Clicking a row opens that thread's floating card and
 * closes the sidebar.
 *
 * Must be rendered inside `<BlockNoteView>` (it uses the comment hooks). Renders
 * nothing when `open` is false.
 */
export const CommentsSidebar = ({ open, onClose }: CommentsSidebarProps) => {
    const { t } = useTranslation();
    const copy = t.common.editor.commentsSidebar;
    const editor = useBlockNoteEditor();
    const comments = useExtension(CommentsExtension);
    const { threadPositions, selectedThreadId } = useExtensionState(CommentsExtension);
    const threads = useThreads();

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

    const handleSelect = useCallback(
        (threadId: string) => {
            // Same effect as clicking the highlighted text: select the thread
            // (which scrolls it into view and makes the always-mounted
            // `FloatingThreadController` render its card), then close the sidebar.
            comments.selectThread(threadId, true);
            onClose();
        },
        [comments, onClose]
    );

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
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        {rows.map(({ thread, referenceText }) => (
                            <ThreadRow
                                key={thread.id}
                                thread={thread}
                                referenceText={referenceText}
                                selected={thread.id === selectedThreadId}
                                onSelect={handleSelect}
                            />
                        ))}
                    </Box>
                )}
            </Box>
        </Sheet>
    );
};
