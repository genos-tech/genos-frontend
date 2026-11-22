import { DropResult } from "@hello-pangea/dnd";

import type { SidebarDndKind, SidebarNoteMove } from "./sidebarNoteDnd";

export const noteDndType = (kind: SidebarDndKind): string => `note-${kind}`;

export const buildNoteDraggableId = (kind: SidebarDndKind, noteId: number): string =>
    `n${kind}-${noteId}`;

export const parseNoteDraggableId = (
    id: string
): { kind: SidebarDndKind; noteId: number } | null => {
    const m = /^n([123])-(\d+)$/.exec(id);
    if (!m) return null;
    return { kind: Number(m[1]) as SidebarDndKind, noteId: Number(m[2]) };
};

// Container ids (without the hdr:/lst: role prefix).
export const myRootContainerId = (): string => "my-root";

export const myFolderContainerId = (folderId: number): string => `my-folder-${folderId}`;

export const taskContainerId = (projectId: number, taskId: number): string =>
    `task-${projectId}-${taskId}`;

// `channelId` is the v3 channel UUID string (ChatNoteMetaProps.chatId
// is declared `number` but carries the UUID post-flip — treat as
// opaque).
export const chatContainerId = (chatType: number, channelId: string | number): string =>
    `chat-${chatType}-${channelId}`;

export const droppableId = (role: "hdr" | "lst", containerId: string): string =>
    `${role}:${containerId}`;

export const parseContainerId = (raw: string): ParsedContainer | null => {
    // Strip the hdr:/lst: role prefix — both roles resolve to the same
    // container.
    const id = raw.replace(/^(hdr|lst):/, "");
    if (id === "my-root") return { kind: "my", folderId: null };

    const folderMatch = /^my-folder-(\d+)$/.exec(id);
    if (folderMatch) return { kind: "my", folderId: Number(folderMatch[1]) };

    const taskMatch = /^task-(\d+)-(\d+)$/.exec(id);
    if (taskMatch) {
        return { kind: "task", projectId: Number(taskMatch[1]), taskId: Number(taskMatch[2]) };
    }

    const chatMatch = /^chat-(\d+)-(.+)$/.exec(id);
    if (chatMatch) {
        return { kind: "chat", chatType: Number(chatMatch[1]), channelId: chatMatch[2] };
    }

    return null;
};

// Turn a raw library DropResult into a semantic move, or null for every
// no-op case: dropped outside any target, malformed ids, kind mismatch
// (double-safety on top of the library's type system), or dropped back
// into the container it came from.
export const parseDropResult = (result: DropResult): SidebarNoteMove | null => {
    if (!result.destination) return null;

    const dragged = parseNoteDraggableId(result.draggableId);
    if (!dragged) return null;

    const dest = parseContainerId(result.destination.droppableId);
    if (!dest) return null;

    const source = parseContainerId(result.source.droppableId);
    // Same-container drop (header and list of one container included) —
    // nothing to do.
    if (source && JSON.stringify(source) === JSON.stringify(dest)) return null;

    if (dest.kind === "my" && dragged.kind === 1) {
        return { kind: "my", noteId: dragged.noteId, folderId: dest.folderId };
    }
    if (dest.kind === "task" && dragged.kind === 2) {
        return {
            kind: "task",
            noteId: dragged.noteId,
            projectId: dest.projectId,
            taskId: dest.taskId,
        };
    }
    if (dest.kind === "chat" && dragged.kind === 3) {
        return {
            kind: "chat",
            noteId: dragged.noteId,
            chatType: dest.chatType,
            channelId: dest.channelId,
        };
    }
    return null;
};

export type ParsedContainer =
    | { kind: "my"; folderId: number | null }
    | { kind: "task"; projectId: number; taskId: number }
    | { kind: "chat"; chatType: number; channelId: string };
