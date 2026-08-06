import { ReactNode } from "react";
import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd";
import { Box } from "@mui/joy";

import { useIsMobile } from "../../../../hooks/common/useIsMobile";

// ---------------------------------------------------------------------------
// Sidebar note drag & drop — shared across the My/Task/Chat note sections.
//
// Model: every note CONTAINER (my-note folder / My Notes root / task /
// chat) exposes up to two Droppables that both resolve to the same
// container — its header row (`hdr:`, usable while collapsed) and its
// expanded notes list (`lst:`). Container-root note rows are Draggables.
// Cross-kind drags are rejected for free by @hello-pangea/dnd's `type`
// system: a `note-2` draggable simply has no valid `note-1` targets.
//
// There is NO ordering semantics — destination index is ignored
// everywhere (lists stay -tsUpdated) — so the id codec is the whole
// protocol. Child note rows are not draggable (the library can't nest
// Draggables); they move via the menu-based pickers.
// ---------------------------------------------------------------------------

export type SidebarDndKind = 1 | 2 | 3;

export type SidebarNoteMove =
    | { kind: "my"; noteId: number; folderId: number | null }
    | { kind: "task"; noteId: number; projectId: number; taskId: number }
    | { kind: "chat"; noteId: number; chatType: number; channelId: string };

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

type ParsedContainer =
    | { kind: "my"; folderId: number | null }
    | { kind: "task"; projectId: number; taskId: number }
    | { kind: "chat"; chatType: number; channelId: string };

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

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

type SidebarDndProviderProps = {
    onMove: (move: SidebarNoteMove) => void;
    children: ReactNode;
};

export const SidebarDndProvider = ({ onMove, children }: SidebarDndProviderProps) => (
    <DragDropContext
        onDragEnd={(result) => {
            const move = parseDropResult(result);
            if (move) onMove(move);
        }}
    >
        {children}
    </DragDropContext>
);

type DroppableHeaderProps = {
    containerId: string;
    kind: SidebarDndKind;
    // Row content; receives whether a compatible note is hovering so it
    // can highlight.
    children: (isDraggingOver: boolean) => ReactNode;
};

// Drop target for a container HEADER row (works while collapsed). The
// placeholder is parked in a zero-height box so hovering never reflows
// the sidebar (no ordering → no need to make room).
export const DroppableHeader = ({ containerId, kind, children }: DroppableHeaderProps) => (
    <Droppable droppableId={droppableId("hdr", containerId)} type={noteDndType(kind)}>
        {(provided, snapshot) => (
            <Box ref={provided.innerRef} {...provided.droppableProps}>
                {children(snapshot.isDraggingOver)}
                <Box sx={{ height: 0, overflow: "hidden" }}>{provided.placeholder}</Box>
            </Box>
        )}
    </Droppable>
);

type DroppableNoteListProps = {
    containerId: string;
    kind: SidebarDndKind;
    children: ReactNode;
};

// Drop target wrapping a container's EXPANDED notes area — also the
// required Droppable ancestor for the rows' Draggables.
export const DroppableNoteList = ({ containerId, kind, children }: DroppableNoteListProps) => (
    <Droppable droppableId={droppableId("lst", containerId)} type={noteDndType(kind)}>
        {(provided, snapshot) => (
            <Box
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                    borderRadius: "8px",
                    transition: "background-color 0.15s ease",
                    backgroundColor: snapshot.isDraggingOver
                        ? "rgba(var(--gp-brand-700-rgb), 0.08)"
                        : "transparent",
                }}
            >
                {children}
                <Box sx={{ height: 0, overflow: "hidden" }}>{provided.placeholder}</Box>
            </Box>
        )}
    </Droppable>
);

type DraggableNoteRowProps = {
    kind: SidebarDndKind;
    noteId: number;
    index: number;
    children: ReactNode;
};

// Wraps one container-root note row. Index is positional only — drops
// never reorder. Drag is disabled on mobile: touch DnD fights with
// tap-to-open (and the long-press sensor isn't useful in a phone
// sidebar), so rows stay plain clickable there.
export const DraggableNoteRow = ({ kind, noteId, index, children }: DraggableNoteRowProps) => {
    const isMobile = useIsMobile();
    return (
        <Draggable
            draggableId={buildNoteDraggableId(kind, noteId)}
            index={index}
            isDragDisabled={isMobile}
        >
            {(provided, snapshot) => (
                <Box
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...(isMobile ? {} : provided.dragHandleProps)}
                    sx={{
                        opacity: snapshot.isDragging ? 0.85 : 1,
                        borderRadius: "8px",
                        boxShadow: snapshot.isDragging
                            ? "0 4px 16px rgba(var(--gp-brand-700-rgb), 0.35)"
                            : "none",
                    }}
                >
                    {children}
                </Box>
            )}
        </Draggable>
    );
};
