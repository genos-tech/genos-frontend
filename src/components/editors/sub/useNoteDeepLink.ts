import { useEffect, useSyncExternalStore } from "react";

import {
    clearNoteTarget,
    peekNoteTarget,
    subscribeNoteTarget,
    type NoteKind,
} from "../../../features/notes/common/utils/noteTarget";
import { useTranslation } from "../../../i18n";
import { toast } from "../../ui/feedback/toastStore";

// Open a note AT a block or a comment (MIP-146). The target was captured when the link arrived
// (`noteTarget.ts`); the editor of THAT note acts on it once it can be shown:
//
//   * a block: scroll it to the middle of the view and highlight it for a few seconds;
//   * a comment thread: open its card, the same `selectThread(id, true)` seam clicking the
//     highlighted text uses (`CommentsSidebar`).
//
// A note opens and syncs asynchronously (the blocks arrive from the Yjs document after the
// editor mounts, and an editor kept alive in the pool may be hidden), so this does not act on
// the first render: it looks every `POLL_MS` until the block or thread is there AND on screen,
// and gives up after `WAIT_MS` with a message rather than leaving the member on an unmoved page.

export const POLL_MS = 250;
export const WAIT_MS = 12_000;
export const HIGHLIGHT_MS = 4_000;
export const HIGHLIGHT_CLASS = "bn-deeplink-target";

type ThreadLike = { deletedAt?: unknown };

/** The slice of the editor this needs (the real BlockNote editor satisfies it). */
export type DeepLinkEditor = {
    getBlock: (id: string) => unknown;
    domElement?: HTMLElement | null;
    selectThread: (threadId: string) => void;
};

type Options = {
    editor: DeepLinkEditor | null | undefined;
    /** The comment threads by id; null while the store is not up (a note without comments). */
    getThreads: (() => ReadonlyMap<string, ThreadLike>) | null;
    note: { noteType: NoteKind; noteId: number };
};

const visible = (el: Element): boolean => el.getClientRects().length > 0;

/**
 * The element of one block. BlockNote puts the block's `data-id` on BOTH its outer wrapper
 * (`blockOuter`) and the block itself (`blockContainer`, `.bn-block`); its own lookups exclude the
 * wrapper so one block is one match, and so does this. `blockId` is checked by `isTargetId`
 * before it gets here, so it cannot break out of the attribute selector.
 */
export const blockSelector = (blockId: string): string =>
    `[data-node-type][data-id="${blockId}"]:not([data-node-type="blockOuter"])`;

const prefersReducedMotion = (): boolean =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// One highlight timer per element: revealing the same block again must restart it, not be cut
// short by the first reveal's timer.
const highlightTimers = new WeakMap<Element, number>();

/** Scroll to the block's element and flash it. The highlight ends on its OWN timer: it must
 *  outlive the effect that started it, which re-runs the moment the target is consumed. */
export const revealBlock = (el: Element): void => {
    el.scrollIntoView({
        block: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    // Restart the animation if the same block is revealed twice in a row.
    el.classList.remove(HIGHLIGHT_CLASS);
    void (el as HTMLElement).offsetWidth;
    el.classList.add(HIGHLIGHT_CLASS);
    window.clearTimeout(highlightTimers.get(el));
    highlightTimers.set(
        el,
        window.setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_MS)
    );
};

export const useNoteDeepLink = ({ editor, getThreads, note }: Options): void => {
    const { t } = useTranslation();
    const copy = t.common.editor.noteLink;
    const pending = useSyncExternalStore(
        subscribeNoteTarget,
        () => peekNoteTarget(),
        () => null
    );
    const mine =
        pending && pending.noteType === note.noteType && pending.noteId === note.noteId
            ? pending
            : null;

    useEffect(() => {
        if (!mine || !editor) return;
        let finished = false;
        const started = Date.now();

        const finish = (message?: string) => {
            finished = true;
            window.clearInterval(timer);
            clearNoteTarget(mine);
            if (message) toast.neutral(message, { id: "note-deeplink" });
        };

        const attempt = () => {
            if (finished) return;
            if (mine.blockId) {
                const el = editor.domElement?.querySelector(blockSelector(mine.blockId));
                if (editor.getBlock(mine.blockId) && el && visible(el)) {
                    revealBlock(el);
                    finish();
                    return;
                }
            } else if (mine.threadId && getThreads) {
                const thread = getThreads().get(mine.threadId);
                if (thread && !thread.deletedAt) {
                    editor.selectThread(mine.threadId);
                    finish();
                    return;
                }
            }
            if (Date.now() - started > WAIT_MS) {
                finish(mine.blockId ? copy.blockNotFound : copy.commentNotFound);
            }
        };

        const timer = window.setInterval(attempt, POLL_MS);
        attempt();
        return () => {
            window.clearInterval(timer);
        };
    }, [mine, editor, getThreads, copy]);
};
