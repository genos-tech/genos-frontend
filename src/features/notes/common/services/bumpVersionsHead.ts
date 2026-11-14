import { UserProps } from "../../../../types/admin";
import { NoteVersionMeta } from "../../../../types/notes";

export const VERSION_COALESCE_MS = 5 * 60 * 1000; // mirror the backend window

/**
 * The optimistic version list after a local save: same coalesce rules as the
 * backend, so the chip flips to "by me · just now" without waiting for a fresh GET.
 *
 * The server coalesces only into a row whose source is the write's own (MIP-1488):
 * a person's typing never lands on a row an AI app or an API key wrote. So a head
 * that carries a `via` is never extended here; the save starts a new row, which has
 * no `via` because a person made it.
 */
export const bumpVersionsHead = (
    prev: NoteVersionMeta[],
    myself: Pick<UserProps, "userId" | "userName" | "avatarImgPath">,
    now: number = Date.now()
): NoteVersionMeta[] => {
    const nowIso = new Date(now).toISOString();
    const head = prev[0];
    const isMine = head?.editor && String(head.editor.userId) === String(myself.userId);
    const withinWindow =
        head &&
        now - new Date(head.tsUpdatedAt).getTime() < VERSION_COALESCE_MS &&
        head.restoredFromVersionNo == null &&
        !head.via;
    if (head && isMine && withinWindow) {
        return [{ ...head, tsUpdatedAt: nowIso }, ...prev.slice(1)];
    }
    const synthetic: NoteVersionMeta = {
        versionNo: (head?.versionNo ?? 0) + 1,
        editor: {
            userId: String(myself.userId),
            userName: myself.userName,
            avatarUrl: myself.avatarImgPath || null,
        },
        title: head?.title ?? "",
        restoredFromVersionNo: null,
        tsCreatedAt: nowIso,
        tsUpdatedAt: nowIso,
    };
    return [synthetic, ...prev];
};
