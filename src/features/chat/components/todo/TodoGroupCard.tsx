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
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TodoCategoryProps, TodoGroupProps, TodoReminderProps } from "../../../../types/chat";
import { getLocalCurrentDate, getLocalTomorrowDate } from "../../../../utils/dateUtils";
import { TodoCategorySection } from "./TodoCategorySection";

// Each color is carried twice: the plain value for opaque use and an
// `…Rgb` "r, g, b" triplet for tints, composed as `rgba(<triplet>, α)`.
// `today` is a THEME TOKEN, and a `var(--gp-…)` with hex-alpha appended
// is not a color — CSS discarded those declarations outright, so the
// today card lost its tint and accent bar.
const COLORS = {
    today: {
        dark: "var(--gp-brandalt-400)",
        darkRgb: "var(--gp-brandalt-400-rgb)",
        light: "var(--gp-brand-700)",
        lightRgb: "var(--gp-brand-700-rgb)",
    },
    // Tomorrow gets its own accent rather than sharing today's. Every card
    // that isn't today is styled as the PAST — flat border, no accent bar —
    // which reads as "a day gone by", exactly the wrong thing to say about
    // the day you just filed a leftover under. A separate hue distinguishes
    // it from today without competing with it. Plain hex, not a theme token,
    // so no `var()` + hex-alpha trap (see above).
    tomorrow: {
        dark: "#a78bfa",
        darkRgb: "167, 139, 250",
        light: "#7c3aed",
        lightRgb: "124, 58, 237",
    },
    completed: {
        dark: "#22c55e",
        darkRgb: "34, 197, 94",
        light: "#16a34a",
        lightRgb: "22, 163, 74",
    },
} as const;

interface TodoGroupCardProps {
    group: TodoGroupProps;
    categories: TodoCategoryProps[];
    // Deep-link target item; forwarded to sections/rows for the highlight.
    highlightItemId?: number;
    onAddItem: (localDate: string, title: string, categoryId: number | null) => Promise<void>;
    onAddSubitem: (localDate: string, parentItemId: number, title: string) => Promise<void>;
    // Carry a to-do over to tomorrow; forwarded to the rows.
    onMoveToTomorrow?: (itemId: number) => void;
    onPatchItem: (itemId: number, patch: UpdateTodoItemPatch) => void;
    onDeleteItem: (itemId: number) => void;
    onCategoryCreate: (name: string) => Promise<TodoCategoryProps | undefined>;
    // Reminders are owned by `useTodoGroups` (the same owner as completion,
    // which cancels them) and passed down whole; absent on any surface that
    // doesn't wire them, which hides the row's "Remind me…" item.
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

export const TodoGroupCard = (props: TodoGroupCardProps) => {
    const {
        group,
        categories,
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
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const isToday = group.localDate === getLocalCurrentDate();
    const isTomorrow = group.localDate === getLocalTomorrowDate();
    // The accent this card wears, or null for an ordinary past day. Today
    // and tomorrow differ only in hue, so the three styled spots below read
    // from this instead of branching on the two flags each time.
    const accent = isToday ? COLORS.today : isTomorrow ? COLORS.tomorrow : null;

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
            title: t.chat.todoPane.general,
            categoryId: null as number | null,
            items: uncategorized,
        });
        result.push(...categoryEntries);
        return result;
    }, [group.items, categories, t.chat.todoPane.general]);

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
                    borderColor: accent
                        ? isDark
                            ? `rgba(${accent.darkRgb}, 0.19)`
                            : `rgba(${accent.lightRgb}, 0.13)`
                        : isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.06)",
                    boxShadow: accent
                        ? isDark
                            ? `0 4px 20px rgba(${accent.darkRgb}, 0.08)`
                            : `0 4px 20px rgba(${accent.lightRgb}, 0.07)`
                        : isDark
                          ? "0 2px 8px rgba(0,0,0,0.2)"
                          : "0 2px 8px rgba(0,0,0,0.04)",
                }}
            >
                {/* Top accent bar — today, and tomorrow in its own hue */}
                {accent && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: 3,
                            background: isDark
                                ? `linear-gradient(90deg, ${accent.dark} 0%, rgba(${accent.darkRgb}, 0.38) 100%)`
                                : `linear-gradient(90deg, ${accent.light} 0%, rgba(${accent.lightRgb}, 0.38) 100%)`,
                        }}
                    />
                )}

                {/* Header */}
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Typography
                        level="title-sm"
                        sx={{
                            fontWeight: 700,
                            color: accent
                                ? isDark
                                    ? accent.dark
                                    : accent.light
                                : isDark
                                  ? "rgba(255,255,255,0.85)"
                                  : "rgba(0,0,0,0.8)",
                        }}
                    >
                        {group.localDate}
                        {isToday
                            ? t.chat.todoPane.todaySuffix
                            : isTomorrow
                              ? t.chat.todoPane.tomorrowSuffix
                              : ""}
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
                                    ? `rgba(${COLORS.completed.darkRgb}, 0.15)`
                                    : `rgba(${COLORS.completed.lightRgb}, 0.08)`
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
                        highlightItemId={highlightItemId}
                        items={s.items}
                        localDate={group.localDate}
                        myself={myself}
                        reminderByItemId={reminderByItemId}
                        setMyself={setMyself}
                        socket={socket}
                        title={s.title}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                        onAddItem={(t, cId) => onAddItem(group.localDate, t, cId)}
                        onCancelReminder={onCancelReminder}
                        onCategoryCreate={onCategoryCreate}
                        onDeleteItem={onDeleteItem}
                        onMoveToTomorrow={onMoveToTomorrow}
                        onPatchItem={onPatchItem}
                        onSetReminder={onSetReminder}
                        onAddSubitem={(parentItemId, t) =>
                            onAddSubitem(group.localDate, parentItemId, t)
                        }
                    />
                ))}
            </Card>
        </Box>
    );
};
