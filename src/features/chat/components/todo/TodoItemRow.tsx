import { useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Box, Checkbox, IconButton, Input, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { TodoCategoryProps, TodoItemProps } from "../../../../types/chat";
import { CategoryPickerMenu } from "./CategoryPickerMenu";
import { TodoNotesEditor } from "./TodoNotesEditor";

interface TodoItemRowProps {
    item: TodoItemProps;
    categories: TodoCategoryProps[];
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

export const TodoItemRow = (props: TodoItemRowProps) => {
    const {
        item,
        categories,
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
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const [title, setTitle] = useState(item.title);
    // Default to expanded when the item ships with actual notes content
    // (i.e. not just the placeholder empty paragraph) so the user sees
    // them without an extra click. Empty notes stay collapsed.
    const [notesExpanded, setNotesExpanded] = useState(
        () => !isEffectivelyEmpty(item.notes ?? [])
    );
    const [notesBody, setNotesBody] = useState<PartialBlock[]>(() => ensureNonEmpty(item.notes));
    const notesDirtyRef = useRef(false);

    // Sync local state when the item is refreshed from the server.
    useEffect(() => {
        setTitle(item.title);
    }, [item.title]);
    useEffect(() => {
        setNotesBody(ensureNonEmpty(item.notes));
    }, [item.notes]);

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

    const currentCategory = categories.find((c) => c.categoryId === item.categoryId);

    return (
        <Box
            sx={{
                borderRadius: "8px",
                px: 1,
                py: 0.75,
                "&:hover": {
                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                },
            }}
        >
            <Stack alignItems="center" direction="row" spacing={1}>
                <Checkbox
                    checked={item.isCompleted}
                    size="sm"
                    onChange={(e) => onToggleComplete(item.itemId, e.target.checked)}
                />
                <Input
                    placeholder="Untitled todo"
                    size="sm"
                    value={title}
                    variant="plain"
                    sx={{
                        flex: 1,
                        textDecoration: item.isCompleted ? "line-through" : undefined,
                        opacity: item.isCompleted ? 0.55 : 1,
                        fontSize: "0.9rem",
                        "& input": { px: 0 },
                    }}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => {
                        if (title !== item.title) onTitleCommit(item.itemId, title);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                        }
                    }}
                />
                <CategoryPickerMenu
                    categories={categories}
                    currentCategoryId={item.categoryId}
                    triggerLabel={currentCategory ? currentCategory.name : null}
                    onCreate={onCategoryCreate}
                    onSelect={(categoryId) => onCategoryChange(item.itemId, categoryId)}
                />
                <IconButton
                    size="sm"
                    sx={{ borderRadius: "6px" }}
                    title={notesExpanded ? "Collapse notes" : "Expand notes"}
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
                <IconButton
                    color="danger"
                    size="sm"
                    sx={{ borderRadius: "6px" }}
                    title="Delete"
                    variant="plain"
                    onClick={() => onDelete(item.itemId)}
                >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
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
        </Box>
    );
};
