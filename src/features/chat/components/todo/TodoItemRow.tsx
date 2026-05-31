import { useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SubdirectoryArrowRightRoundedIcon from "@mui/icons-material/SubdirectoryArrowRightRounded";
import { Box, Checkbox, IconButton, Input, Stack, Textarea } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
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
    // Direct children of this row. Empty on rows that are themselves
    // children (one-level nesting cap).
    subitems?: TodoItemProps[];
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
    // Append a new child under this row's parent (top-level row's
    // own item_id, or — when this row is itself a child rendered by
    // its own parent — undefined).
    onAddSubitem?: (parentItemId: number, title: string) => Promise<void>;
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
        subitems = [],
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
        onAddSubitem,
    } = props;

    const isChild = item.parentItemId !== null;

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

    // Subitem add: a small inline input that the user opens with the
    // "+ subitem" button. Only meaningful on top-level rows; children
    // never render the affordance (one-level nesting cap).
    const [subitemAddOpen, setSubitemAddOpen] = useState(false);
    const [newSubitemTitle, setNewSubitemTitle] = useState("");
    const handleAddSubitem = async () => {
        const t = newSubitemTitle.trim();
        if (!t || !onAddSubitem) return;
        await onAddSubitem(item.itemId, t);
        setNewSubitemTitle("");
        // Keep the input open so the user can rapid-add several.
    };

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
                <Textarea
                    maxRows={6}
                    minRows={1}
                    placeholder="Untitled todo"
                    size="sm"
                    value={title}
                    variant="plain"
                    sx={{
                        flex: 1,
                        textDecoration: item.isCompleted ? "line-through" : undefined,
                        opacity: item.isCompleted ? 0.55 : 1,
                        fontSize: "0.9rem",
                        // Strip Textarea's default chrome so it sits flush
                        // like the original single-line Input.
                        background: "transparent",
                        minHeight: 0,
                        py: 0,
                        "--Textarea-paddingBlock": "0px",
                        "& textarea": { px: 0, resize: "none" },
                    }}
                    onBlur={() => {
                        if (title !== item.title) onTitleCommit(item.itemId, title);
                    }}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setTitle(e.target.value)
                    }
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                        // Enter inserts a newline by default (Textarea
                        // behavior). Cmd/Ctrl+Enter commits without
                        // leaving the field, which is consistent with
                        // the chat editor's send shortcut.
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            (e.target as HTMLTextAreaElement).blur();
                        }
                    }}
                />
                {/* Children inherit the parent's tag — hide the picker
                    on child rows to avoid implying otherwise. */}
                {!isChild && (
                    <CategoryPickerMenu
                        categories={categories}
                        currentCategoryId={item.categoryId}
                        triggerLabel={currentCategory ? currentCategory.name : null}
                        onCreate={onCategoryCreate}
                        onSelect={(categoryId) => onCategoryChange(item.itemId, categoryId)}
                    />
                )}
                <AppTooltip title={notesExpanded ? "Collapse notes" : "Expand notes"}>
                    <IconButton
                        size="sm"
                        sx={{ borderRadius: "6px" }}
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
                </AppTooltip>
                {/* "+ subitem" only on top-level rows. */}
                {!isChild && onAddSubitem && (
                    <AppTooltip title="Add subitem">
                        <IconButton
                            size="sm"
                            sx={{ borderRadius: "6px" }}
                            variant="plain"
                            onClick={() => setSubitemAddOpen((v) => !v)}
                        >
                            <SubdirectoryArrowRightRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </AppTooltip>
                )}
                <AppTooltip title="Delete">
                    <IconButton
                        color="danger"
                        size="sm"
                        sx={{ borderRadius: "6px" }}
                        variant="plain"
                        onClick={() => onDelete(item.itemId)}
                    >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </AppTooltip>
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

            {/* Subitems: render children indented under the parent
                row. Each child is a TodoItemRow with no subitems of its
                own (one-level cap) and no add-subitem affordance. */}
            {!isChild && (subitems.length > 0 || subitemAddOpen) && (
                <Box
                    sx={{
                        pl: 3,
                        ml: 1,
                        borderLeft: "2px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                    }}
                >
                    {subitems.map((child) => (
                        <TodoItemRow
                            key={child.itemId}
                            categories={categories}
                            item={child}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            onCategoryChange={onCategoryChange}
                            onCategoryCreate={onCategoryCreate}
                            onDelete={onDelete}
                            onNotesCommit={onNotesCommit}
                            onTitleCommit={onTitleCommit}
                            onToggleComplete={onToggleComplete}
                        />
                    ))}

                    {subitemAddOpen && (
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={1}
                            sx={{ mt: 0.25, px: 1 }}
                        >
                            <Input
                                placeholder="+ Add subitem"
                                size="sm"
                                value={newSubitemTitle}
                                variant="plain"
                                sx={{
                                    flex: 1,
                                    fontSize: "0.85rem",
                                    "& input": { px: 0 },
                                }}
                                autoFocus
                                onChange={(e) => setNewSubitemTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddSubitem();
                                    } else if (e.key === "Escape") {
                                        setSubitemAddOpen(false);
                                        setNewSubitemTitle("");
                                    }
                                }}
                            />
                            {newSubitemTitle.trim() && (
                                <IconButton
                                    size="sm"
                                    sx={{ borderRadius: "6px" }}
                                    variant="soft"
                                    onClick={handleAddSubitem}
                                >
                                    <AddIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            )}
                        </Stack>
                    )}
                </Box>
            )}
        </Box>
    );
};
