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
import { NavItem } from "../../components/ui/nav/NavItem";
import { NAV_KEEP_CLASS } from "../../components/ui/nav/navStyles";
import { SectionHeader } from "../../components/ui/nav/SectionHeader";
import { fmt, useTranslation } from "../../i18n";
import type { AgentSessionSummary } from "../../services/agentApi";
import { g } from "../../theme/tokens";
import { relativeTimeLabel } from "../spotlight/SpotlightContent";

interface Props {
    sessions: AgentSessionSummary[];
    isLoading: boolean;
    // The last load failed. With rows showing they are simply kept; with none,
    // the sidebar says it couldn't load (and offers `onRetry`) instead of
    // claiming there are no conversations.
    loadFailed: boolean;
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
    onRetry: () => void;
}

export const GenosSessionSidebar = ({
    sessions,
    isLoading,
    loadFailed,
    activeSessionId,
    resumeError,
    search,
    pinError,
    onSearchChange,
    onTogglePin,
    onSelectSession,
    onNewChat,
    onRetry,
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
        const pinLabel = s.is_pinned ? t.genos.sidebar.unpin : t.genos.sidebar.pin;
        return (
            <NavItem
                key={s.session_id}
                as="div"
                // Title (two-line clamp) over time and turn count: a documented
                // multiple of a density row.
                lines={2}
                selected={isActive}
                sx={{ flexShrink: 0, height: "auto", py: 0.5 }}
                label={s.first_query || t.spotlight.states.untitled}
                // Two-line clamp keeps rows compact when the first query runs
                // long (server truncates at ~140 chars regardless).
                labelSx={{
                    whiteSpace: "normal",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    fontWeight: 500,
                }}
                secondary={
                    <>
                        {relativeTimeLabel(s.last_active_at, t.spotlight)}
                        {" · "}
                        {fmt(t.spotlight.history.turnCount, { count: s.turn_count })}
                        {pinError === s.session_id && (
                            <Box component="span" sx={{ display: "block", color: g.danger.text }}>
                                {t.genos.sidebar.pinFailed}
                            </Box>
                        )}
                    </>
                }
                // The pin is a SIBLING of the row button, not a child: a button
                // inside a button is invalid HTML and browsers do not reliably
                // deliver the inner click. A pinned row keeps its pin showing
                // (it is state, not just an action); the rest appear on hover
                // and, because focus reveals them too, are reachable by keyboard.
                actions={
                    <AppTooltip placement="top" title={pinLabel}>
                        <IconButton
                            aria-label={pinLabel}
                            aria-pressed={s.is_pinned}
                            className={`genos-session-pin${s.is_pinned ? ` ${NAV_KEEP_CLASS}` : ""}`}
                            size="sm"
                            variant="plain"
                            sx={{
                                flexShrink: 0,
                                borderRadius: g.radius.sm,
                                // No plate behind the pin in any state: the icon
                                // carries this on its own. `plainActiveBg` matters
                                // beyond the press: Joy applies its "active"
                                // variant to `[aria-pressed="true"]` as well, which
                                // framed every PINNED pin even at rest.
                                "--variant-plainHoverBg": "transparent",
                                "--variant-plainActiveBg": "transparent",
                                "& svg": { transition: `transform ${g.motion.base} ${g.ease}` },
                                "&:hover": {
                                    color: g.accent.text,
                                    // Reads as pushing the pin in, or backwards,
                                    // pulling it out of a row already pinned.
                                    "& svg": { transform: "rotate(-15deg)" },
                                },
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
                }
                onClick={() => onSelectSession(s.session_id)}
            />
        );
    };

    const renderGroupLabel = (label: string) => (
        <SectionHeader as="div" label={label} sx={{ flexShrink: 0 }} />
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

            <SectionHeader
                as="div"
                icon={<HistoryRoundedIcon />}
                label={t.genos.sidebar.header}
                sx={{ flexShrink: 0 }}
            />

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

                {/* A failed load is neither of the messages below: "no
                    conversations yet" / "no matches" would be a claim the
                    server never made. Gated on `!isLoading` because the host
                    folds a resume-in-progress into it, and a retry shows the
                    spinner above while it runs. */}
                {!isLoading && sessions.length === 0 && loadFailed && (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 1,
                            px: 0.5,
                            py: 1,
                        }}
                    >
                        <Typography level="body-sm" sx={{ color: "danger.500" }}>
                            {t.genos.sidebar.loadFailed}
                        </Typography>
                        <Button color="neutral" size="sm" variant="outlined" onClick={onRetry}>
                            {t.common.actions.retry}
                        </Button>
                    </Box>
                )}

                {!isLoading && sessions.length === 0 && !loadFailed && (
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
