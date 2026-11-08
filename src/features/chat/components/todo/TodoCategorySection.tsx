import { useEffect, useMemo, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import AddIcon from "@mui/icons-material/Add";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Box, IconButton, Input, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { UpdateTodoItemPatch } from "./services/todoItems";

import { Clickable } from "../../../../components/ui/Clickable";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TodoCategoryProps, TodoItemProps, TodoReminderProps } from "../../../../types/chat";
import { ProjectTagChip } from "../../../tasks/components/ProjectTagChip";
import { TodoItemRow } from "./TodoItemRow";
import { todoTagColor } from "./todoTagColor";
import { useTodoTitleField } from "./useTodoTitleField";

interface TodoCategorySectionProps {
    title: string;
    categoryId: number | null; // null = uncategorized
    items: TodoItemProps[];
    categories: TodoCategoryProps[];
    // The owning group's day bucket — needed by rows to build their
    // /workspace/todo/:localDate/item/:itemId copy-links.
    localDate: string;
    // Deep-link target item; forwarded to rows for the highlight.
    highlightItemId?: number;
    onAddItem: (title: string, categoryId: number | null) => Promise<void>;
    onAddSubitem: (parentItemId: number, title: string) => Promise<void>;
    // Straight through to the rows, which decide whether to offer it.
    onMoveToTomorrow?: (itemId: number) => void;
    onPatchItem: (itemId: number, patch: UpdateTodoItemPatch) => void;
    onDeleteItem: (itemId: number) => void;
    onCategoryCreate: (name: string) => Promise<TodoCategoryProps | undefined>;
    // Reminder state and mutators, straight through to the rows.
    reminderByItemId?: ReadonlyMap<number, TodoReminderProps>;
    onSetReminder?: (itemId: number, at: Date) => Promise<unknown>;
    onCancelReminder?: (itemId: number) => Promise<unknown>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    socket: Socket | null;
}

export const TodoCategorySection = (props: TodoCategorySectionProps) => {
    const { t } = useTranslation();
    const {
        title,
        categoryId,
        items,
        categories,
        localDate,
        highlightItemId,
        onAddItem,
        onAddSubitem,
        onMoveToTomorrow,
        onPatchItem,
        onDeleteItem,
        onCategoryCreate,
        reminderByItemId,
        onSetReminder,
        onCancelReminder,
        myself,
        setMyself,
        useTEM,
        useUISM,
        useCM,
        socket,
    } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const [collapsed, setCollapsed] = useState(false);
    const [newTitle, setNewTitle] = useState("");

    // A deep link must beat a collapsed section — force-expand when this
    // section owns the target item so the highlight is actually visible.
    useEffect(() => {
        if (highlightItemId != null && items.some((i) => i.itemId === highlightItemId)) {
            setCollapsed(false);
        }
    }, [highlightItemId, items]);

    // The "+ Add item" field: paste-to-link and the @/# picker (shared with
    // every other to-do title field). Enter adds, unless the picker has it.
    const addField = useTodoTitleField({
        value: newTitle,
        setValue: setNewTitle,
        onKeyDown: (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
            }
        },
    });

    // Group children under their parents so TodoItemRow renders the tree.
    const { topLevelItems, subitemsByParent } = useMemo(() => {
        const top: TodoItemProps[] = [];
        const byParent = new Map<number, TodoItemProps[]>();
        for (const i of items) {
            if (i.parentItemId === null) {
                top.push(i);
            } else {
                const arr = byParent.get(i.parentItemId) ?? [];
                arr.push(i);
                byParent.set(i.parentItemId, arr);
            }
        }
        // Stable order: by sort_order then itemId for children too.
        for (const arr of byParent.values()) {
            arr.sort((a, b) => a.sortOrder - b.sortOrder || a.itemId - b.itemId);
        }
        return { topLevelItems: top, subitemsByParent: byParent };
    }, [items]);

    const completed = items.filter((i) => i.isCompleted).length;

    // A real tag shows as its coloured chip; the untagged "General" section
    // has no colour to show and stays plain text.
    const category =
        categoryId === null ? undefined : categories.find((c) => c.categoryId === categoryId);

    const handleAdd = async () => {
        const t = newTitle.trim();
        if (!t) return;
        setNewTitle("");
        await onAddItem(t, categoryId);
    };

    return (
        <Box sx={{ mb: 1.5 }}>
            <Clickable
                sx={{
                    display: "flex",
                    alignItems: "center",
                    flexDirection: "row",
                    gap: 1,
                    cursor: "pointer",
                    px: 1,
                    py: 0.5,
                    borderRadius: "6px",
                    "&:hover": {
                        background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                    },
                }}
                onActivate={() => setCollapsed((v) => !v)}
            >
                {collapsed ? (
                    <ExpandMoreRoundedIcon sx={{ fontSize: 18, opacity: 0.6 }} />
                ) : (
                    <ExpandLessRoundedIcon sx={{ fontSize: 18, opacity: 0.6 }} />
                )}
                {category ? (
                    <ProjectTagChip
                        fontSize="0.8rem"
                        isDark={isDark}
                        label={title}
                        tagColor={todoTagColor(category)}
                    />
                ) : (
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 600,
                            color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.7)",
                        }}
                    >
                        {title}
                    </Typography>
                )}
                <Typography
                    level="body-xs"
                    sx={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}
                >
                    {completed}/{items.length}
                </Typography>
            </Clickable>

            {!collapsed && (
                <Box sx={{ pl: 1 }}>
                    {topLevelItems.map((item) => (
                        <TodoItemRow
                            key={item.itemId}
                            categories={categories}
                            highlightItemId={highlightItemId}
                            item={item}
                            localDate={localDate}
                            myself={myself}
                            reminderByItemId={reminderByItemId}
                            setMyself={setMyself}
                            socket={socket}
                            subitems={subitemsByParent.get(item.itemId) ?? []}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            onAddSubitem={onAddSubitem}
                            onCancelReminder={onCancelReminder}
                            onCategoryCreate={onCategoryCreate}
                            onDelete={onDeleteItem}
                            onMoveToTomorrow={onMoveToTomorrow}
                            onSetReminder={onSetReminder}
                            onCategoryChange={(itemId, newCategoryId) =>
                                onPatchItem(itemId, { categoryId: newCategoryId })
                            }
                            onNotesCommit={(itemId, notes: PartialBlock[] | null) =>
                                onPatchItem(itemId, { notes })
                            }
                            onTitleCommit={(itemId, newTitle) =>
                                onPatchItem(itemId, { title: newTitle })
                            }
                            onToggleComplete={(itemId, isCompleted) =>
                                onPatchItem(itemId, { isCompleted })
                            }
                        />
                    ))}

                    {/* position: relative — anchors the @/# menu and hosts
                        the token highlight overlay. */}
                    <Stack
                        ref={addField.anchorRef}
                        alignItems="center"
                        direction="row"
                        spacing={1}
                        sx={{ mt: 0.5, px: 1, position: "relative" }}
                    >
                        {addField.layer}
                        <Input
                            {...addField.inputProps}
                            placeholder={t.chat.todoPane.addItemPlaceholder}
                            size="sm"
                            sx={{ flex: 1, fontSize: "0.85rem", "& input": { px: 0 } }}
                            variant="plain"
                        />
                        {newTitle.trim() && (
                            <IconButton
                                size="sm"
                                sx={{ borderRadius: "6px" }}
                                variant="soft"
                                onClick={handleAdd}
                            >
                                <AddIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        )}
                    </Stack>
                </Box>
            )}
        </Box>
    );
};
