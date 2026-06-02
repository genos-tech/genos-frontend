// Build an internal deep-link href for a "#" mention chip so a click can
// hand the href to `openModalByHref` (which opens a preview modal for
// supported kinds, or routes via react-router otherwise).
//
// URL shapes mirror `parseInternalUrl` (the modal/route classifier) and
// the existing Spotlight/citation builders (`sourceToUrl` /
// `canonicalSpotlightHref`). We deliberately keep this separate from those
// two for now — they diverge on projects (one returns null so Spotlight
// filters them out), on the chat-note thread sentinel, and neither handles
// shared notes — so reusing them here would either regress Spotlight or
// miss cases. Converging the three is a follow-up.
//
// All ids are carried as strings. The "#" chip stores its semantic ids on
// the node (not a frozen URL) and rebuilds the href here at click time, so
// the link survives id/format changes — notably the chat/thread UUID
// migration — the same way the `@` mention stores a userId rather than a
// profile URL. Ids interpolate straight into the path; `parseInternalUrl`
// re-coerces them with `toInt` / `toV3Id` on the way back in.

export type HashEntityRef =
    | { entityType: "task"; projectId: string; taskId: string }
    | { entityType: "project"; projectId: string }
    | { entityType: "chat"; chatType: string; chatId: string }
    | { entityType: "note"; noteKind: "my"; noteId: string }
    | { entityType: "note"; noteKind: "shared"; noteId: string }
    | { entityType: "note"; noteKind: "task"; projectId: string; taskId: string; noteId: string }
    | {
          entityType: "note";
          noteKind: "chat";
          chatType: string;
          chatId: string;
          threadId: string;
          noteId: string;
      };

// Inverse of `parseInternalUrl`'s CHAT_TYPE_MAP. The chat-kind code stays a
// genuine numeric enum across the v3 migration; URLs use the slug form
// (`/chat/gm/...`). Defaults to "gm" because the chat mention only ever
// targets group messages.
const CHAT_SLUG_BY_CODE: Record<number, string> = { 1: "dm", 2: "gm", 3: "pm", 4: "mdm" };

export const chatTypeCodeToSlug = (code: number | string | undefined | null): string =>
    CHAT_SLUG_BY_CODE[Number(code)] ?? "gm";

export const entityRefToHref = (ref: HashEntityRef): string => {
    switch (ref.entityType) {
        case "task":
            return `/workspace/tasks/project/${ref.projectId}/task/${ref.taskId}`;
        case "project":
            // No preview modal for projects yet — `openModalByHref` returns
            // "navigated" and react-router lands on the project page.
            return `/workspace/tasks/project/${ref.projectId}`;
        case "chat":
            return `/workspace/chat/${ref.chatType}/${ref.chatId}`;
        case "note":
            switch (ref.noteKind) {
                case "my":
                    return `/workspace/notes/my/${ref.noteId}`;
                case "shared":
                    return `/workspace/notes/shared/${ref.noteId}`;
                case "task":
                    return `/workspace/notes/task/project/${ref.projectId}/task/${ref.taskId}/note/${ref.noteId}`;
                case "chat":
                    // `threadId` falls back to the "0" sentinel for notes that
                    // live on the parent chat rather than a thread within it.
                    return `/workspace/notes/chat/${ref.chatType}/${ref.chatId}/thread/${
                        ref.threadId || "0"
                    }/note/${ref.noteId}`;
            }
    }
};
