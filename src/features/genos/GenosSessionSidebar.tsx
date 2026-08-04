// "Ask history" sidebar for the Genos page — the ChatGPT-style session
// list on the left. Rows show the session's first question (the model
// has no title field yet), a relative time, and the turn count; the
// row whose session is live is highlighted. Clicking a row RESUMES the
// session (transcript + server-side context) via
// `useSpotlight.resumeSession`; "New chat" starts fresh.
//
// Two ways to reach an ask the list can't show: the search box filters
// server-side (every question in a session, across the whole retention
// window — NOT a local filter of the rows below, which would only ever
// search the recent slice the server sent), and pinning holds a session
// at the top of the list for good. Pinned rows are grouped above the
// rest, mirroring the order the server returns them in.

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, Button, CircularProgress, IconButton, Input, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { fmt, useTranslation } from "../../i18n";
import type { AgentSessionSummary } from "../../services/agentApi";
import { relativeTimeLabel } from "../spotlight/SpotlightContent";

interface Props {
    sessions: AgentSessionSummary[];
    isLoading: boolean;
    // The live conversation's session id (ask.sessionId) — highlights
    // its row. Null when the current conversation has no session yet.
    activeSessionId: string | null;
    // Non-null after a failed resume; rendered under the header.
    resumeError: string | null;
    // Current search text. Owned by `useGenosSessions` because it drives
    // the fetch — this component only echoes and edits it.
    search: string;
    // Session id whose pin toggle failed and was rolled back.
    pinError: string | null;
    onSearchChange: (next: string) => void;
    onTogglePin: (sessionId: string) => void;
    onSelectSession: (sessionId: string) => void;
    onNewChat: () => void;
}

export const GenosSessionSidebar = ({
    sessions,
    isLoading,
    activeSessionId,
    resumeError,
    search,
    pinError,
    onSearchChange,
    onTogglePin,
    onSelectSession,
    onNewChat,
}: Props) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const isSearching = search.trim().length > 0;
    // The server already sorts pinned-first; splitting rather than
    // sorting keeps that order and just draws a heading between them.
    const pinnedSessions = sessions.filter((s) => s.is_pinned);
    const recentSessions = sessions.filter((s) => !s.is_pinned);

    const renderRow = (s: AgentSessionSummary) => {
        const isActive = s.session_id === activeSessionId;
        return (
            <Box
                key={s.session_id}
                sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 0.25,
                    flexShrink: 0,
                    borderRadius: "10px",
                    // The pin button is a sibling of the row button, not a
                    // child: a button inside a button is invalid HTML and
                    // browsers do not reliably deliver the inner click.
                    // Hovering the pair reveals the pin.
                    "&:hover .genos-session-pin": { opacity: 1 },
                }}
            >
                <Box
                    aria-current={isActive ? "true" : undefined}
                    component="button"
                    type="button"
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: "left",
                        background: isActive
                            ? isDark
                                ? "rgba(var(--gp-brandalt-400-rgb), 0.14)"
                                : "rgba(var(--gp-brand-700-rgb), 0.08)"
                            : "transparent",
                        border: "1px solid",
                        borderColor: isActive
                            ? isDark
                                ? "rgba(var(--gp-brandalt-400-rgb), 0.35)"
                                : "rgba(var(--gp-brand-700-rgb), 0.28)"
                            : "transparent",
                        borderRadius: "10px",
                        px: 1.25,
                        py: 0.875,
                        cursor: "pointer",
                        font: "inherit",
                        color: "inherit",
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.25,
                        transition: "background 100ms ease, border-color 100ms ease",
                        "&:hover": {
                            background: isDark
                                ? "rgba(var(--gp-brandalt-400-rgb), 0.10)"
                                : "rgba(var(--gp-brand-700-rgb), 0.05)",
                        },
                        "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: "primary.400",
                            outlineOffset: "1px",
                        },
                    }}
                    onClick={() => onSelectSession(s.session_id)}
                >
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 500,
                            // Two-line clamp keeps rows compact when
                            // the first query runs long (server
                            // truncates at ~140 chars regardless).
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}
                    >
                        {s.first_query || t.spotlight.states.untitled}
                    </Typography>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.75,
                            fontSize: "0.75rem",
                            opacity: 0.65,
                        }}
                    >
                        <Box component="span">
                            {relativeTimeLabel(s.last_active_at, t.spotlight)}
                        </Box>
                        <Box component="span" sx={{ opacity: 0.6 }}>
                            ·
                        </Box>
                        <Box component="span">
                            {fmt(t.spotlight.history.turnCount, { count: s.turn_count })}
                        </Box>
                    </Box>
                    {pinError === s.session_id && (
                        <Typography level="body-xs" sx={{ color: "danger.500" }}>
                            {t.genos.sidebar.pinFailed}
                        </Typography>
                    )}
                </Box>

                <AppTooltip
                    placement="top"
                    title={s.is_pinned ? t.genos.sidebar.unpin : t.genos.sidebar.pin}
                >
                    <IconButton
                        aria-label={s.is_pinned ? t.genos.sidebar.unpin : t.genos.sidebar.pin}
                        aria-pressed={s.is_pinned}
                        className="genos-session-pin"
                        size="sm"
                        variant="plain"
                        sx={{
                            flexShrink: 0,
                            mt: 0.25,
                            borderRadius: "8px",
                            // Pinned rows keep their pin visible — it's
                            // state, not just an action. Unpinned ones
                            // reveal it on hover so the list stays quiet,
                            // but focus must reveal it too or the button
                            // is unreachable by keyboard.
                            opacity: s.is_pinned ? 1 : 0,
                            transition: "opacity 100ms ease",
                            "&:focus-visible": { opacity: 1 },
                        }}
                        onClick={() => onTogglePin(s.session_id)}
                    >
                        {s.is_pinned ? (
                            <PushPinRoundedIcon sx={{ fontSize: 15 }} />
                        ) : (
                            <PushPinOutlinedIcon sx={{ fontSize: 15 }} />
                        )}
                    </IconButton>
                </AppTooltip>
            </Box>
        );
    };

    const renderGroupLabel = (label: string) => (
        <Typography
            level="body-xs"
            sx={{ fontWeight: 700, opacity: 0.55, px: 0.5, pt: 0.5, flexShrink: 0 }}
        >
            {label}
        </Typography>
    );

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                height: "100%",
                gap: 1,
                p: 1.5,
            }}
        >
            <Button
                color="neutral"
                size="sm"
                startDecorator={<AddRoundedIcon sx={{ fontSize: 18 }} />}
                variant="outlined"
                sx={{
                    justifyContent: "flex-start",
                    borderRadius: "10px",
                    flexShrink: 0,
                }}
                onClick={onNewChat}
            >
                {t.genos.sidebar.newChat}
            </Button>

            <Input
                placeholder={t.genos.sidebar.searchPlaceholder}
                size="sm"
                startDecorator={<SearchRoundedIcon sx={{ fontSize: 16, opacity: 0.7 }} />}
                value={search}
                endDecorator={
                    isSearching ? (
                        <IconButton
                            aria-label={t.genos.sidebar.searchClear}
                            size="sm"
                            variant="plain"
                            onClick={() => onSearchChange("")}
                        >
                            <CloseRoundedIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                    ) : null
                }
                sx={{ borderRadius: "10px", flexShrink: 0 }}
                onChange={(e) => onSearchChange(e.target.value)}
            />

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 0.5,
                    pt: 0.5,
                    flexShrink: 0,
                }}
            >
                <HistoryRoundedIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                <Typography
                    level="body-xs"
                    sx={{ fontWeight: 700, textTransform: "uppercase", opacity: 0.7 }}
                >
                    {t.genos.sidebar.header}
                </Typography>
            </Box>

            {resumeError && (
                <Typography level="body-xs" sx={{ color: "danger.500", px: 0.5 }}>
                    {t.genos.sidebar.resumeFailed}
                </Typography>
            )}

            <Box
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                }}
            >
                {isLoading && sessions.length === 0 && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5, py: 1 }}>
                        <CircularProgress size="sm" />
                        <Typography level="body-sm" sx={{ opacity: 0.75 }}>
                            {t.genos.sidebar.loading}
                        </Typography>
                    </Box>
                )}

                {!isLoading && sessions.length === 0 && (
                    <Typography level="body-sm" sx={{ opacity: 0.7, px: 0.5, py: 1 }}>
                        {/* An empty result while searching isn't an empty
                            history — saying "ask Genos anything to start
                            one" there would read as if the past asks were
                            gone. */}
                        {isSearching ? t.genos.sidebar.noMatches : t.genos.sidebar.empty}
                    </Typography>
                )}

                {pinnedSessions.length > 0 && renderGroupLabel(t.genos.sidebar.pinned)}
                {pinnedSessions.map(renderRow)}

                {/* Only worth labelling the second group when there's a
                    first one to tell it apart from. */}
                {pinnedSessions.length > 0 &&
                    recentSessions.length > 0 &&
                    renderGroupLabel(t.genos.sidebar.recent)}
                {recentSessions.map(renderRow)}
            </Box>
        </Box>
    );
};
