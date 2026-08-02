// "Ask history" sidebar for the Genos page — the ChatGPT-style session
// list on the left. Rows show the session's first question (the model
// has no title field yet), a relative time, and the turn count; the
// row whose session is live is highlighted. Clicking a row RESUMES the
// session (transcript + server-side context) via
// `useSpotlight.resumeSession`; "New chat" starts fresh.

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import { Box, Button, CircularProgress, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

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
    onSelectSession: (sessionId: string) => void;
    onNewChat: () => void;
}

export const GenosSessionSidebar = ({
    sessions,
    isLoading,
    activeSessionId,
    resumeError,
    onSelectSession,
    onNewChat,
}: Props) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

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
                        {t.genos.sidebar.empty}
                    </Typography>
                )}

                {sessions.map((s) => {
                    const isActive = s.session_id === activeSessionId;
                    return (
                        <Box
                            key={s.session_id}
                            aria-current={isActive ? "true" : undefined}
                            component="button"
                            type="button"
                            sx={{
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
                                flexShrink: 0,
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
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};
