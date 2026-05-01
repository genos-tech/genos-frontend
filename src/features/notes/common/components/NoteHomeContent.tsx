import { useMemo } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import CreateRoundedIcon from "@mui/icons-material/CreateRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import TipsAndUpdatesRoundedIcon from "@mui/icons-material/TipsAndUpdatesRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import { Box, Button, Card, Chip, Grid, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";

type NoteHomeContentProps = {
    useNM: NoteManagementState;
};

export const NoteHomeContent = ({ useNM }: NoteHomeContentProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // Calculate note statistics
    const stats = useMemo(() => {
        const personalCount = useNM.myNoteMeta?.length || 0;
        const taskCount = useNM.taskNoteMeta?.length || 0;
        const chatCount = useNM.chatNoteMeta?.length || 0;
        const favoritesCount =
            (useNM.favoriteNotes?.personalNotes?.length || 0) +
            (useNM.favoriteNotes?.taskNotes?.length || 0) +
            (useNM.favoriteNotes?.chatNotes?.length || 0);

        return { personalCount, taskCount, chatCount, favoritesCount };
    }, [useNM.myNoteMeta, useNM.taskNoteMeta, useNM.chatNoteMeta, useNM.favoriteNotes]);

    // Get recent notes from the server-backed `useNM.recentNotes` state
    // (populated by NoteSidebar's mount fetch). Each row carries a
    // `tsOpenedAt` set when the user actually opened the note via the
    // backend's NoteRecentMaster — replacing the previous client-side
    // shortcut that ranked by `tsUpdated` (most-recently-MODIFIED), which
    // wasn't really "recents" at all.
    const recentNotes = useMemo(() => {
        if (!useNM.recentNotes) return [];

        const allNotes: Array<{
            noteId: number;
            title: string;
            noteType: number;
            updatedAt?: string;
        }> = [
            ...useNM.recentNotes.personalNotes.map((n) => ({
                noteId: n.noteId,
                title: n.title || "Untitled",
                noteType: 1,
                updatedAt: n.tsOpenedAt,
            })),
            ...useNM.recentNotes.taskNotes.map((n) => ({
                noteId: n.noteId,
                title: n.title || "Untitled",
                noteType: 2,
                updatedAt: n.tsOpenedAt,
            })),
            ...useNM.recentNotes.chatNotes.map((n) => ({
                noteId: n.noteId,
                title: n.title || "Untitled",
                noteType: 3,
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

    const getNoteTypeIcon = (noteType: number) => {
        switch (noteType) {
            case 1:
                return <WindowRoundedIcon sx={{ fontSize: 16 }} />;
            case 2:
                return <AssignmentRoundedIcon sx={{ fontSize: 16 }} />;
            case 3:
                return <QuestionAnswerRoundedIcon sx={{ fontSize: 16 }} />;
            default:
                return <DescriptionRoundedIcon sx={{ fontSize: 16 }} />;
        }
    };

    const getNoteTypeLabel = (noteType: number) => {
        switch (noteType) {
            case 1:
                return "Personal";
            case 2:
                return "Task";
            case 3:
                return "Chat";
            default:
                return "Note";
        }
    };

    const getNoteTypeColor = (noteType: number) => {
        switch (noteType) {
            case 1:
                return { bg: "rgba(99,102,241,0.12)", text: "#818cf8" };
            case 2:
                return { bg: "rgba(34,197,94,0.12)", text: "#4ade80" };
            case 3:
                return { bg: "rgba(251,146,60,0.12)", text: "#fb923c" };
            default:
                return { bg: "rgba(148,163,184,0.12)", text: "#94a3b8" };
        }
    };

    const handleNoteClick = (noteId: number, noteType: number) => {
        useNM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", noteType.toString());
        // Load note and add it as a new tab
        const nextTabIndex = useNM.tabItems.length;
        useNM.loadNote(noteType, noteId, nextTabIndex);
    };

    const handleQuickCreate = (noteType: number) => {
        useNM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", noteType.toString());
    };

    const statCards = [
        {
            label: "My Notes",
            count: stats.personalCount,
            icon: <WindowRoundedIcon />,
            color: "#818cf8",
            bgColor: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.06)",
            noteType: 1,
        },
        {
            label: "Task Notes",
            count: stats.taskCount,
            icon: <AssignmentRoundedIcon />,
            color: "#4ade80",
            bgColor: isDark ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.06)",
            noteType: 2,
        },
        {
            label: "Chat Notes",
            count: stats.chatCount,
            icon: <QuestionAnswerRoundedIcon />,
            color: "#fb923c",
            bgColor: isDark ? "rgba(251,146,60,0.08)" : "rgba(251,146,60,0.06)",
            noteType: 3,
        },
        {
            label: "Favorites",
            count: stats.favoritesCount,
            icon: <StarRoundedIcon />,
            color: "#fbbf24",
            bgColor: isDark ? "rgba(251,191,36,0.08)" : "rgba(251,191,36,0.06)",
            noteType: 0,
        },
    ];

    const tips = [
        "Star important notes to access them from Favorites",
        "Organize notes with nested hierarchies for better structure",
        "Link notes to tasks and chats for seamless context",
    ];

    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    return (
        <Box
            sx={{
                height: "100%",
                overflow: "auto",
                p: { xs: 2, md: 4 },
                background: isDark
                    ? "linear-gradient(180deg, rgba(18, 18, 19, 0.95) 0%, rgb(25, 26, 28) 100%)"
                    : "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(241,245,249,1) 100%)",
            }}
            className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
        >
            <Stack spacing={4} sx={{ maxWidth: 1200, mx: "auto" }}>
                {/* Welcome Header */}
                <Box>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
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
                            Notes Dashboard
                        </Typography>
                    </Stack>
                    <Typography
                        level="body-md"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                            pl: 6.5,
                        }}
                    >
                        Capture ideas, organize thoughts, and stay productive
                    </Typography>
                </Box>

                {/* Stats Grid */}
                <Grid container spacing={2}>
                    {statCards.map((stat) => (
                        <Grid key={stat.label} xs={6} md={3}>
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
                                onClick={() =>
                                    stat.noteType > 0 && handleQuickCreate(stat.noteType)
                                }
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

                {/* Quick Actions */}
                <Box>
                    <Typography
                        level="title-md"
                        sx={{
                            fontWeight: 600,
                            mb: 2,
                            color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <CreateRoundedIcon sx={{ fontSize: 18 }} />
                        Quick Actions
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <Button
                            variant="soft"
                            startDecorator={<AddRoundedIcon />}
                            onClick={() => handleQuickCreate(1)}
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
                        >
                            Create Personal Note
                        </Button>
                        <Button
                            variant="soft"
                            startDecorator={<FolderOpenRoundedIcon />}
                            onClick={() => handleQuickCreate(2)}
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
                        >
                            Browse Task Notes
                        </Button>
                        <Button
                            variant="soft"
                            startDecorator={<BookmarkBorderRoundedIcon />}
                            onClick={() => handleQuickCreate(3)}
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
                        >
                            Browse Chat Notes
                        </Button>
                    </Stack>
                </Box>

                {/* Recent Notes */}
                {recentNotes.length > 0 && (
                    <Box>
                        <Typography
                            level="title-md"
                            sx={{
                                fontWeight: 600,
                                mb: 2,
                                color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0, 0, 0, 0.75)",
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <ArticleRoundedIcon sx={{ fontSize: 18 }} />
                            Recent Notes
                        </Typography>
                        <Grid container spacing={1.5}>
                            {recentNotes.map((note) => {
                                const typeColors = getNoteTypeColor(note.noteType);
                                return (
                                    <Grid
                                        key={`${note.noteType}-${note.noteId}`}
                                        xs={12}
                                        sm={6}
                                        md={4}
                                    >
                                        <Card
                                            variant="outlined"
                                            sx={{
                                                p: 2,
                                                cursor: "pointer",
                                                background: isDark
                                                    ? "rgba(255,255,255,0.02)"
                                                    : "rgba(255,255,255,0.7)",
                                                borderColor: isDark
                                                    ? "rgba(255,255,255,0.06)"
                                                    : "rgba(0,0,0,0.06)",
                                                transition: "all 0.2s ease",
                                                "&:hover": {
                                                    borderColor: typeColors.text,
                                                    background: isDark
                                                        ? "rgba(255,255,255,0.04)"
                                                        : "rgba(255,255,255,0.9)",
                                                },
                                            }}
                                            onClick={() =>
                                                handleNoteClick(note.noteId, note.noteType)
                                            }
                                        >
                                            <Stack spacing={1.5}>
                                                <Stack
                                                    direction="row"
                                                    justifyContent="space-between"
                                                    alignItems="flex-start"
                                                >
                                                    <Box
                                                        sx={{
                                                            p: 0.75,
                                                            borderRadius: "8px",
                                                            backgroundColor: typeColors.bg,
                                                            color: typeColors.text,
                                                        }}
                                                    >
                                                        {getNoteTypeIcon(note.noteType)}
                                                    </Box>
                                                    <Chip
                                                        size="sm"
                                                        variant="soft"
                                                        sx={{
                                                            fontSize: "0.65rem",
                                                            backgroundColor: typeColors.bg,
                                                            color: typeColors.text,
                                                        }}
                                                    >
                                                        {getNoteTypeLabel(note.noteType)}
                                                    </Chip>
                                                </Stack>
                                                <Typography
                                                    level="title-sm"
                                                    sx={{
                                                        fontWeight: 600,
                                                        color: isDark
                                                            ? "rgba(255,255,255,0.9)"
                                                            : "rgba(0,0,0,0.85)",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {note.title}
                                                </Typography>
                                                {note.updatedAt && (
                                                    <Typography
                                                        level="body-xs"
                                                        sx={{
                                                            color: isDark
                                                                ? "rgba(255,255,255,0.35)"
                                                                : "rgba(0,0,0,0.4)",
                                                        }}
                                                    >
                                                        {new Date(
                                                            note.updatedAt
                                                        ).toLocaleDateString(undefined, {
                                                            month: "short",
                                                            day: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </Card>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Box>
                )}

                {/* Empty State for No Notes */}
                {recentNotes.length === 0 && (
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
                        <Stack spacing={2} alignItems="center">
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
                                    No recently opened notes yet
                                </Typography>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.45)"
                                            : "rgba(0,0,0,0.45)",
                                    }}
                                >
                                    Open notes to see them here, or use the quick actions above to
                                    create one.
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
                            ? "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(147,51,234,0.08) 100%)"
                            : "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(147,51,234,0.06) 100%)",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)",
                    }}
                >
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: "10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: isDark
                                    ? "rgba(99,102,241,0.15)"
                                    : "rgba(99,102,241,0.1)",
                            }}
                        >
                            <TipsAndUpdatesRoundedIcon
                                sx={{
                                    fontSize: 22,
                                    color: isDark ? "#a5b4fc" : "#6366f1",
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
                                Pro Tip
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
