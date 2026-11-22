import { ReactNode } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { Box } from "@mui/joy";

import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import {
    buildNoteDraggableId,
    droppableId,
    noteDndType,
    parseDropResult,
} from "./sidebarNoteDndHelpers";

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
                role="none"
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
                    // The handle's `role="button"` made the list's child a button, not an item
                    // (MIP-1955). It is the item now; the row inside has its own button, and the
                    // lift keys still work.
                    role="listitem"
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
