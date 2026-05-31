import { useMemo } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { Box, Card, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { UpdateTodoItemPatch } from "./services/todoItems";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { TodoCategoryProps, TodoGroupProps } from "../../../../types/chat";
import { getLocalCurrentDate } from "../../../../utils/dateUtils";
import { TodoCategorySection } from "./TodoCategorySection";

const COLORS = {
    today: { dark: "#a78bfa", light: "#7c3aed" },
    completed: { dark: "#22c55e", light: "#16a34a" },
} as const;

interface TodoGroupCardProps {
    group: TodoGroupProps;
    categories: TodoCategoryProps[];
    onAddItem: (localDate: string, title: string, categoryId: number | null) => Promise<void>;
    onAddSubitem: (localDate: string, parentItemId: number, title: string) => Promise<void>;
    onPatchItem: (itemId: number, patch: UpdateTodoItemPatch) => void;
    onDeleteItem: (itemId: number) => void;
    onCategoryCreate: (name: string) => Promise<TodoCategoryProps | undefined>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    socket: Socket | null;
}

export const TodoGroupCard = (props: TodoGroupCardProps) => {
    const {
        group,
        categories,
        onAddItem,
        onAddSubitem,
        onPatchItem,
        onDeleteItem,
        onCategoryCreate,
        myself,
        setMyself,
        useTEM,
        useUISM,
        useCM,
        socket,
    } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const isToday = group.localDate === getLocalCurrentDate();

    // Bucket items by categoryId. Uncategorized (null) renders first.
    const sections = useMemo(() => {
        const uncategorized = group.items.filter((i) => i.categoryId === null);
        const byCategory = new Map<number, typeof group.items>();
        for (const i of group.items) {
            if (i.categoryId === null) continue;
            const arr = byCategory.get(i.categoryId) ?? [];
            arr.push(i);
            byCategory.set(i.categoryId, arr);
        }
        const categoryEntries = categories
            .filter((c) => byCategory.has(c.categoryId))
            .map((c) => ({
                title: c.name,
                categoryId: c.categoryId as number | null,
                items: byCategory.get(c.categoryId) ?? [],
            }));
        const result = [];
        // Always include an uncategorized section (even when empty) so
        // the user always has somewhere to drop a new item that isn't
        // assigned a tag yet.
        result.push({
            title: "General",
            categoryId: null as number | null,
            items: uncategorized,
        });
        result.push(...categoryEntries);
        return result;
    }, [group.items, categories]);

    const completedCount = group.items.filter((i) => i.isCompleted).length;
    const totalCount = group.items.length;

    return (
        <Box sx={{ py: 0.5, px: "5%" }}>
            <Card
                sx={{
                    borderRadius: "16px",
                    background: isDark
                        ? "linear-gradient(135deg, rgba(30,30,35,1) 0%, rgba(25,25,30,1) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(250,250,252,1) 100%)",
                    border: "1px solid",
                    borderColor: isToday
                        ? isDark
                            ? `${COLORS.today.dark}30`
                            : `${COLORS.today.light}20`
                        : isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.06)",
                    boxShadow: isToday
                        ? isDark
                            ? `0 4px 20px ${COLORS.today.dark}15`
                            : `0 4px 20px ${COLORS.today.light}12`
                        : isDark
                          ? "0 2px 8px rgba(0,0,0,0.2)"
                          : "0 2px 8px rgba(0,0,0,0.04)",
                }}
            >
                {/* Top accent bar for today */}
                {isToday && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: 3,
                            background: isDark
                                ? `linear-gradient(90deg, ${COLORS.today.dark} 0%, ${COLORS.today.dark}60 100%)`
                                : `linear-gradient(90deg, ${COLORS.today.light} 0%, ${COLORS.today.light}60 100%)`,
                        }}
                    />
                )}

                {/* Header */}
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Typography
                        level="title-sm"
                        sx={{
                            fontWeight: 700,
                            color: isToday
                                ? isDark
                                    ? COLORS.today.dark
                                    : COLORS.today.light
                                : isDark
                                  ? "rgba(255,255,255,0.85)"
                                  : "rgba(0,0,0,0.8)",
                        }}
                    >
                        {group.localDate}
                        {isToday ? "  (Today)" : ""}
                    </Typography>
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            ml: "auto",
                            px: 1,
                            py: 0.25,
                            borderRadius: "6px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            background: group.isCompleted
                                ? isDark
                                    ? `${COLORS.completed.dark}25`
                                    : `${COLORS.completed.light}15`
                                : isDark
                                  ? "rgba(255,255,255,0.06)"
                                  : "rgba(0,0,0,0.04)",
                            color: group.isCompleted
                                ? isDark
                                    ? COLORS.completed.dark
                                    : COLORS.completed.light
                                : isDark
                                  ? "rgba(255,255,255,0.6)"
                                  : "rgba(0,0,0,0.6)",
                        }}
                    >
                        {group.isCompleted ? (
                            <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />
                        ) : (
                            <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 14 }} />
                        )}
                        {completedCount}/{totalCount}
                    </Box>
                </Stack>

                {/* Sections */}
                {sections.map((s) => (
                    <TodoCategorySection
                        key={`${group.groupId}-${s.categoryId ?? "none"}`}
                        categories={categories}
                        categoryId={s.categoryId}
                        items={s.items}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        title={s.title}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                        onAddItem={(t, cId) => onAddItem(group.localDate, t, cId)}
                        onAddSubitem={(parentItemId, t) =>
                            onAddSubitem(group.localDate, parentItemId, t)
                        }
                        onCategoryCreate={onCategoryCreate}
                        onDeleteItem={onDeleteItem}
                        onPatchItem={onPatchItem}
                    />
                ))}
            </Card>
        </Box>
    );
};
