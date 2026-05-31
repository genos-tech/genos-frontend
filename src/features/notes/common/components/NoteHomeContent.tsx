import { ReactNode, useMemo, useRef } from "react";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CreateRoundedIcon from "@mui/icons-material/CreateRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import TipsAndUpdatesRoundedIcon from "@mui/icons-material/TipsAndUpdatesRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import { Box, Button, Card, Chip, Grid, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { Messages, useTranslation } from "../../../../i18n";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";

type NoteHomeContentProps = {
    useNM: NoteManagementState;
};

// Note-type primitives. Defined once at module scope so the helpers
// below don't recreate objects on every render and the values stay in
// sync with the rest of the notes UI (sidebar, FavoriteNoteItem, etc.).
const NOTE_TYPES = {
    CHAT: 3,
    FAVORITES: 0, // virtual — used only by the Favorites stat card
    PERSONAL: 1,
    TASK: 2,
} as const;

type NoteType = number;
type NoteMeta = MyNoteMetaProps | TaskNoteMetaProps | ChatNoteMetaProps;

const getNoteTypeIcon = (noteType: NoteType, fontSize = 16): ReactNode => {
    switch (noteType) {
        case NOTE_TYPES.PERSONAL:
            return <WindowRoundedIcon sx={{ fontSize }} />;
        case NOTE_TYPES.TASK:
            return <AssignmentRoundedIcon sx={{ fontSize }} />;
        case NOTE_TYPES.CHAT:
            return <QuestionAnswerRoundedIcon sx={{ fontSize }} />;
        default:
            return <DescriptionRoundedIcon sx={{ fontSize }} />;
    }
};

const getNoteTypeLabel = (noteType: NoteType, t: Messages): string => {
    switch (noteType) {
        case NOTE_TYPES.PERSONAL:
            return t.notes.noteTypeLabels.personal;
        case NOTE_TYPES.TASK:
            return t.notes.noteTypeLabels.task;
        case NOTE_TYPES.CHAT:
            return t.notes.noteTypeLabels.chat;
        default:
            return t.notes.noteTypeLabels.note;
    }
};

const getNoteTypeColor = (noteType: NoteType) => {
    switch (noteType) {
        case NOTE_TYPES.PERSONAL:
            return { bg: "rgba(99,102,241,0.12)", text: "#818cf8" };
        case NOTE_TYPES.TASK:
            return { bg: "rgba(34,197,94,0.12)", text: "#4ade80" };
        case NOTE_TYPES.CHAT:
            return { bg: "rgba(251,146,60,0.12)", text: "#fb923c" };
        default:
            return { bg: "rgba(148,163,184,0.12)", text: "#94a3b8" };
    }
};

// Mirror the sub-label rules used in the sidebar's `FavoriteNoteItem`
// so a task-note pill on the home page reads `Project #123` and a
// chat-note pill reads its chat-type label, matching the sidebar
// exactly. Personal notes have no useful sub-label.
const getChatTypeLabel = (chatType: number, t: Messages): string => {
    switch (chatType) {
        case 1:
            return t.notes.chatTypes.dm;
        case 2:
            return t.notes.chatTypes.gm;
        case 3:
            return t.notes.chatTypes.pm;
        case 4:
            return t.notes.chatTypes.mdm;
        default:
            return t.notes.chatTypes.chat;
    }
};

const getNoteSubLabel = (note: NoteMeta, noteType: NoteType, t: Messages): string | null => {
    if (noteType === NOTE_TYPES.TASK) {
        const tn = note as TaskNoteMetaProps;
        if (!tn.projectName && !tn.taskTitle) return null;
        return `${tn.projectName ?? ""}${tn.taskId ? ` #${tn.taskId}` : ""}`.trim() || null;
    }
    if (noteType === NOTE_TYPES.CHAT) {
        const c = note as ChatNoteMetaProps;
        return c.chatName || c.chatTypeName || getChatTypeLabel(c.chatType, t);
    }
    return null;
};

export const NoteHomeContent = ({ useNM }: NoteHomeContentProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    // Anchor for the Favorites stat-card → scroll-to-section affordance.
    // Storing it on a ref (instead of an `id`) keeps the DOM clean and
    // avoids potential id collisions on pages that render multiple
    // dashboards.
    const favoritesSectionRef = useRef<HTMLDivElement | null>(null);

    const stats = useMemo(() => {
        const personalCount = useNM.myNoteMeta?.length || 0;
        const taskCount = useNM.taskNoteMeta?.length || 0;
        const chatCount = useNM.chatNoteMeta?.length || 0;
        const favoritesCount =
            (useNM.favoriteNotes?.personalNotes?.length || 0) +
            (useNM.favoriteNotes?.taskNotes?.length || 0) +
            (useNM.favoriteNotes?.chatNotes?.length || 0);

        return { chatCount, favoritesCount, personalCount, taskCount };
    }, [useNM.myNoteMeta, useNM.taskNoteMeta, useNM.chatNoteMeta, useNM.favoriteNotes]);

    // Recent notes — server-backed list ranked by `tsOpenedAt` desc.
    // See NoteSidebar's mount fetch for the source of truth; this view
    // just reshapes that data into a flat row list and keeps the most
    // recent 12.
    const recentNotes = useMemo(() => {
        if (!useNM.recentNotes) return [];

        const allNotes: Array<{
            note: NoteMeta;
            noteId: number;
            noteType: number;
            title: string;
            updatedAt?: string;
        }> = [
            ...useNM.recentNotes.personalNotes.map((n) => ({
                note: n as unknown as NoteMeta,
                noteId: n.noteId,
                noteType: NOTE_TYPES.PERSONAL,
                title: n.title || t.notes.defaults.untitled,
                updatedAt: n.tsOpenedAt,
            })),
            ...useNM.recentNotes.taskNotes.map((n) => ({
                note: n as unknown as NoteMeta,
                noteId: n.noteId,
                noteType: NOTE_TYPES.TASK,
                title: n.title || t.notes.defaults.untitled,
                updatedAt: n.tsOpenedAt,
            })),
            ...useNM.recentNotes.chatNotes.map((n) => ({
                note: n as unknown as NoteMeta,
                noteId: n.noteId,
                noteType: NOTE_TYPES.CHAT,
                title: n.title || t.notes.defaults.untitled,
                updatedAt: n.tsOpenedAt,
            })),
        ];

        return allNotes
            .sort((a, b) => {
                if (!a.updatedAt) return 1;
                if (!b.updatedAt) return -1;
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            })
            .slice(0, 12);
    }, [useNM.recentNotes]);

    // Flatten favorites into a typed list so we can render them in the
    // same card grid shape Recent Notes uses. We deliberately keep the
    // by-type grouping (Personal → Task → Chat) so the order is
    // predictable across renders and matches the sidebar.
    const favoriteRows = useMemo(() => {
        if (!useNM.favoriteNotes) return [];

        const rows: Array<{
            note: NoteMeta;
            noteId: number;
            noteType: number;
        }> = [
            ...useNM.favoriteNotes.personalNotes.map((n) => ({
                note: n as unknown as NoteMeta,
                noteId: n.noteId,
                noteType: NOTE_TYPES.PERSONAL,
            })),
            ...useNM.favoriteNotes.taskNotes.map((n) => ({
                note: n as unknown as NoteMeta,
                noteId: n.noteId,
                noteType: NOTE_TYPES.TASK,
            })),
            ...useNM.favoriteNotes.chatNotes.map((n) => ({
                note: n as unknown as NoteMeta,
                noteId: n.noteId,
                noteType: NOTE_TYPES.CHAT,
            })),
        ];

        return rows;
    }, [useNM.favoriteNotes]);

    // `nextTabIndex = -1` lets `loadNote` reuse an existing tab when
    // the note is already open — matching `FavoriteNoteItem`. Passing
    // `tabItems.length` (the previous behaviour) caused a duplicate
    // tab every time the user re-opened a note from the dashboard.
    const handleNoteClick = (noteId: number, noteType: number) => {
        useNM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", noteType.toString());
        useNM.loadNote(noteType, noteId, -1);
    };

    const handleSwitchType = (noteType: number) => {
        useNM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", noteType.toString());
    };

    const handleScrollToFavorites = () => {
        favoritesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const statCards = [
        {
            bgColor: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.06)",
            color: "#818cf8",
            count: stats.personalCount,
            icon: <WindowRoundedIcon />,
            label: t.notes.home.statMyNotes,
            onClick: () => handleSwitchType(NOTE_TYPES.PERSONAL),
        },
        {
            bgColor: isDark ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.06)",
            color: "#4ade80",
            count: stats.taskCount,
            icon: <AssignmentRoundedIcon />,
            label: t.notes.home.statTaskNotes,
            onClick: () => handleSwitchType(NOTE_TYPES.TASK),
        },
        {
            bgColor: isDark ? "rgba(251,146,60,0.08)" : "rgba(251,146,60,0.06)",
            color: "#fb923c",
            count: stats.chatCount,
            icon: <QuestionAnswerRoundedIcon />,
            label: t.notes.home.statChatNotes,
            onClick: () => handleSwitchType(NOTE_TYPES.CHAT),
        },
        {
            bgColor: isDark ? "rgba(251,191,36,0.08)" : "rgba(251,191,36,0.06)",
            color: "#fbbf24",
            count: stats.favoritesCount,
            icon: <StarRoundedIcon />,
            label: t.notes.home.statFavorites,
            onClick: handleScrollToFavorites,
        },
    ];

    const tips = [t.notes.home.tip1, t.notes.home.tip2, t.notes.home.tip3];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    // Shared section header. Pulled out so Recent Notes and Favorites
    // share the exact same title styling (and any future tweak only
    // needs to happen in one place).
    const renderSectionHeader = (icon: ReactNode, label: string, trailing?: ReactNode) => (
        <Stack
            alignItems="center"
            direction="row"
            spacing={1}
            sx={{
                mb: 2,
                color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
            }}
        >
            <Stack alignItems="center" direction="row" spacing={1} sx={{ flex: 1 }}>
                {icon}
                <Typography
                    level="title-md"
                    sx={{
                        fontWeight: 600,
                        color: "inherit",
                    }}
                >
                    {label}
                </Typography>
            </Stack>
            {trailing}
        </Stack>
    );

    // Reusable note card used by both the Recent and Favorites grids.
    // Centralising the styling here keeps the two surfaces visually
    // coherent — the only difference is whether a `meta` line (date
    // for recents, sub-label for favorites) is present.
    const renderNoteCard = (
        key: string,
        noteType: number,
        title: string,
        meta: ReactNode,
        onClick: () => void,
        accent?: { star?: boolean }
    ) => {
        const typeColors = getNoteTypeColor(noteType);
        return (
            <Grid key={key} md={4} sm={6} xs={12}>
                <Card
                    variant="outlined"
                    sx={{
                        p: 2,
                        cursor: "pointer",
                        background: isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.7)",
                        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            borderColor: typeColors.text,
                            background: isDark
                                ? "rgba(255,255,255,0.04)"
                                : "rgba(255,255,255,0.95)",
                            transform: "translateY(-1px)",
                        },
                    }}
                    onClick={onClick}
                >
                    <Stack spacing={1.5}>
                        <Stack
                            alignItems="flex-start"
                            direction="row"
                            justifyContent="space-between"
                        >
                            <Box
                                sx={{
                                    p: 0.75,
                                    borderRadius: "8px",
                                    backgroundColor: typeColors.bg,
                                    color: typeColors.text,
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                {getNoteTypeIcon(noteType)}
                            </Box>
                            <Stack alignItems="center" direction="row" spacing={0.5}>
                                {accent?.star && (
                                    <StarRoundedIcon sx={{ fontSize: 16, color: "#f59e0b" }} />
                                )}
                                <Chip
                                    size="sm"
                                    variant="soft"
                                    sx={{
                                        fontSize: "0.65rem",
                                        backgroundColor: typeColors.bg,
                                        color: typeColors.text,
                                    }}
                                >
                                    {getNoteTypeLabel(noteType, t)}
                                </Chip>
                            </Stack>
                        </Stack>
                        <Typography
                            level="title-sm"
                            sx={{
                                fontWeight: 600,
                                color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {title}
                        </Typography>
                        {meta}
                    </Stack>
                </Card>
            </Grid>
        );
    };

    const showBigEmptyState = recentNotes.length === 0 && favoriteRows.length === 0;

    return (
        <Box
            className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
            sx={{
                height: "100%",
                overflow: "auto",
                p: { xs: 2, md: 4 },
                background: isDark
                    ? "linear-gradient(180deg, rgba(18, 18, 19, 0.95) 0%, rgb(25, 26, 28) 100%)"
                    : "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(241,245,249,1) 100%)",
            }}
        >
            <Stack spacing={4} sx={{ maxWidth: 1200, mx: "auto" }}>
                {/* Welcome Header */}
                <Box>
                    <Stack alignItems="center" direction="row" spacing={1.5} sx={{ mb: 1 }}>
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isDark
                                    ? "linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(245,158,11,0.2) 100%)"
                                    : "linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(245,158,11,0.15) 100%)",
                            }}
                        >
                            <AutoAwesomeRoundedIcon
                                sx={{ fontSize: 22, color: isDark ? "#fcd34d" : "#f59e0b" }}
                            />
                        </Box>
                        <Typography
                            level="h2"
                            sx={{
                                fontWeight: 700,
                                fontSize: { xs: "1.5rem", md: "1.75rem" },
                                color: isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.87)",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            {t.notes.home.title}
                        </Typography>
                    </Stack>
                    <Typography
                        level="body-md"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                            pl: 6.5,
                        }}
                    >
                        {t.notes.home.subtitle}
                    </Typography>
                </Box>

                {/* Stats Grid */}
                <Grid spacing={2} container>
                    {statCards.map((stat) => (
                        <Grid key={stat.label} md={3} xs={6}>
                            <Card
                                variant="soft"
                                sx={{
                                    p: 2.5,
                                    cursor: "pointer",
                                    background: stat.bgColor,
                                    border: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(255,255,255,0.04)"
                                        : "rgba(0,0,0,0.04)",
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        transform: "translateY(-2px)",
                                        boxShadow: isDark
                                            ? "0 8px 24px rgba(0,0,0,0.3)"
                                            : "0 8px 24px rgba(0,0,0,0.08)",
                                    },
                                }}
                                onClick={stat.onClick}
                            >
                                <Stack spacing={1.5}>
                                    <Box
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: "10px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: stat.color,
                                            backgroundColor: isDark
                                                ? "rgba(255,255,255,0.06)"
                                                : "rgba(255,255,255,0.8)",
                                        }}
                                    >
                                        {stat.icon}
                                    </Box>
                                    <Box>
                                        <Typography
                                            level="h3"
                                            sx={{
                                                fontWeight: 700,
                                                fontSize: "1.5rem",
                                                color: isDark
                                                    ? "rgba(255,255,255,0.9)"
                                                    : "rgba(0,0,0,0.85)",
                                            }}
                                        >
                                            {stat.count}
                                        </Typography>
                                        <Typography
                                            level="body-sm"
                                            sx={{
                                                color: isDark
                                                    ? "rgba(255,255,255,0.5)"
                                                    : "rgba(0,0,0,0.5)",
                                                fontWeight: 500,
                                            }}
                                        >
                                            {stat.label}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                {/* Quick Actions.
                    These buttons just switch the active sidebar view —
                    they don't actually create anything yet, so we
                    label them honestly with "Open …" verbs (the old
                    "Create Personal Note" / "Browse Task Notes" mix
                    misled users into expecting a creation flow). */}
                <Box>
                    {renderSectionHeader(
                        <CreateRoundedIcon sx={{ fontSize: 18 }} />,
                        t.notes.home.quickActions
                    )}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <Button
                            endDecorator={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
                            startDecorator={<WindowRoundedIcon />}
                            variant="soft"
                            sx={{
                                flex: 1,
                                py: 1.5,
                                background: isDark
                                    ? "rgba(99,102,241,0.12)"
                                    : "rgba(99,102,241,0.08)",
                                color: "#818cf8",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(99,102,241,0.2)"
                                        : "rgba(99,102,241,0.15)",
                                },
                            }}
                            onClick={() => handleSwitchType(NOTE_TYPES.PERSONAL)}
                        >
                            {t.notes.home.openMyNotes}
                        </Button>
                        <Button
                            endDecorator={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
                            startDecorator={<AssignmentRoundedIcon />}
                            variant="soft"
                            sx={{
                                flex: 1,
                                py: 1.5,
                                background: isDark
                                    ? "rgba(34,197,94,0.12)"
                                    : "rgba(34,197,94,0.08)",
                                color: "#4ade80",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(34,197,94,0.2)"
                                        : "rgba(34,197,94,0.15)",
                                },
                            }}
                            onClick={() => handleSwitchType(NOTE_TYPES.TASK)}
                        >
                            {t.notes.home.openTaskNotes}
                        </Button>
                        <Button
                            endDecorator={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
                            startDecorator={<QuestionAnswerRoundedIcon />}
                            variant="soft"
                            sx={{
                                flex: 1,
                                py: 1.5,
                                background: isDark
                                    ? "rgba(251,146,60,0.12)"
                                    : "rgba(251,146,60,0.08)",
                                color: "#fb923c",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(251,146,60,0.2)"
                                        : "rgba(251,146,60,0.15)",
                                },
                            }}
                            onClick={() => handleSwitchType(NOTE_TYPES.CHAT)}
                        >
                            {t.notes.home.openChatNotes}
                        </Button>
                    </Stack>
                </Box>

                {/* Recent Notes.
                    Only render the section when there's actually
                    something to show; the "no recents yet" empty
                    state lives in the shared big card below. */}
                {recentNotes.length > 0 && (
                    <Box>
                        {renderSectionHeader(
                            <ArticleRoundedIcon sx={{ fontSize: 18 }} />,
                            t.notes.home.recentNotes,
                            <Chip color="neutral" size="sm" variant="soft">
                                {recentNotes.length}
                            </Chip>
                        )}
                        <Grid spacing={1.5} container>
                            {recentNotes.map((note) => {
                                const meta = note.updatedAt ? (
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            color: isDark
                                                ? "rgba(255,255,255,0.35)"
                                                : "rgba(0,0,0,0.4)",
                                        }}
                                    >
                                        {new Date(note.updatedAt).toLocaleDateString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </Typography>
                                ) : null;

                                return renderNoteCard(
                                    `recent-${note.noteType}-${note.noteId}`,
                                    note.noteType,
                                    note.title,
                                    meta,
                                    () => handleNoteClick(note.noteId, note.noteType)
                                );
                            })}
                        </Grid>
                    </Box>
                )}

                {/* Favorites.
                    Mirrors `NoteSidebar`'s favourites section: shows
                    each favourited note as a clickable card with the
                    same type colour scheme, plus a star accent so it's
                    visually distinguishable from Recent Notes at a
                    glance. The sub-label (project #task-id for task
                    notes, chat name for chat notes) matches what the
                    sidebar shows so context stays consistent across
                    both surfaces. */}
                <Box ref={favoritesSectionRef}>
                    {renderSectionHeader(
                        <StarRoundedIcon sx={{ fontSize: 18, color: "#f59e0b" }} />,
                        t.notes.home.favorites,
                        favoriteRows.length > 0 ? (
                            <Chip color="warning" size="sm" variant="soft">
                                {favoriteRows.length}
                            </Chip>
                        ) : undefined
                    )}
                    {favoriteRows.length === 0 ? (
                        <Card
                            variant="soft"
                            sx={{
                                p: 2.5,
                                background: isDark
                                    ? "rgba(251,191,36,0.06)"
                                    : "rgba(251,191,36,0.05)",
                                border: "1px dashed",
                                borderColor: isDark
                                    ? "rgba(251,191,36,0.2)"
                                    : "rgba(251,191,36,0.25)",
                            }}
                        >
                            <Stack alignItems="center" direction="row" spacing={1.5}>
                                <StarRoundedIcon
                                    sx={{
                                        fontSize: 22,
                                        color: isDark ? "#fcd34d" : "#f59e0b",
                                        opacity: 0.7,
                                    }}
                                />
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.55)"
                                            : "rgba(0,0,0,0.55)",
                                        fontStyle: "italic",
                                    }}
                                >
                                    {t.notes.home.favoritesEmpty}
                                </Typography>
                            </Stack>
                        </Card>
                    ) : (
                        <Grid spacing={1.5} container>
                            {favoriteRows.map((row) => {
                                const subLabel = getNoteSubLabel(row.note, row.noteType, t);
                                const meta = subLabel ? (
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            color: isDark
                                                ? "rgba(255,255,255,0.4)"
                                                : "rgba(0,0,0,0.45)",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {subLabel}
                                    </Typography>
                                ) : null;

                                return renderNoteCard(
                                    `fav-${row.noteType}-${row.noteId}`,
                                    row.noteType,
                                    row.note.title || t.notes.defaults.untitled,
                                    meta,
                                    () => handleNoteClick(row.noteId, row.noteType),
                                    { star: true }
                                );
                            })}
                        </Grid>
                    )}
                </Box>

                {/* Big empty state — only when BOTH recents and favourites
                    are empty. With either populated the dashboard has
                    enough surface to act on, and this card just becomes
                    noise. */}
                {showBigEmptyState && (
                    <Card
                        variant="soft"
                        sx={{
                            p: 4,
                            textAlign: "center",
                            background: isDark
                                ? "rgba(255,255,255,0.02)"
                                : "rgba(255,255,255,0.5)",
                            border: "2px dashed",
                            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                        }}
                    >
                        <Stack alignItems="center" spacing={2}>
                            <Box
                                sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: "16px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: isDark
                                        ? "rgba(251,191,36,0.1)"
                                        : "rgba(251,191,36,0.08)",
                                }}
                            >
                                <DescriptionRoundedIcon
                                    sx={{
                                        fontSize: 32,
                                        color: isDark ? "#fcd34d" : "#f59e0b",
                                    }}
                                />
                            </Box>
                            <Box>
                                <Typography
                                    level="title-lg"
                                    sx={{
                                        fontWeight: 600,
                                        color: isDark
                                            ? "rgba(255,255,255,0.85)"
                                            : "rgba(0,0,0,0.8)",
                                        mb: 0.5,
                                    }}
                                >
                                    {t.notes.home.bigEmptyTitle}
                                </Typography>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.45)"
                                            : "rgba(0,0,0,0.45)",
                                    }}
                                >
                                    {t.notes.home.bigEmptyBody}
                                </Typography>
                            </Box>
                        </Stack>
                    </Card>
                )}

                {/* Tip Card */}
                <Card
                    variant="soft"
                    sx={{
                        p: 2.5,
                        background: isDark
                            ? "linear-gradient(135deg, rgba(124,58,237,0.10) 0%, rgba(168,85,247,0.10) 100%)"
                            : "linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(168,85,247,0.06) 100%)",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.1)",
                    }}
                >
                    <Stack alignItems="center" direction="row" spacing={2}>
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: "10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: isDark
                                    ? "rgba(124,58,237,0.15)"
                                    : "rgba(124,58,237,0.1)",
                            }}
                        >
                            <TipsAndUpdatesRoundedIcon
                                sx={{
                                    fontSize: 22,
                                    color: isDark ? "#a78bfa" : "#7c3aed",
                                }}
                            />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography
                                level="title-sm"
                                sx={{
                                    fontWeight: 600,
                                    color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
                                    mb: 0.25,
                                }}
                            >
                                {t.notes.home.proTip}
                            </Typography>
                            <Typography
                                level="body-sm"
                                sx={{
                                    color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                                }}
                            >
                                {randomTip}
                            </Typography>
                        </Box>
                    </Stack>
                </Card>
            </Stack>
        </Box>
    );
};
