// The Genos main page (/workspace/genos) — the app's landing surface.
//
// ChatGPT-style layout: an "Ask history" session sidebar on the left
// (resumable — clicking a row restores the transcript AND continues
// the server-side session) and the shared SpotlightContent surface as
// the main column. Empty state centers the input hero-style; once a
// conversation is active the panel fills the column with the input
// pinned at the bottom (SpotlightContent's own agent-mode order flip).
//
// All conversation state lives in `useSpotlight` at the App root — the
// SAME instance that drives the Cmd-K overlay — so the two surfaces
// are viewports onto one conversation. This component is a plain lazy
// route (not a keep-alive pane): unmounting loses nothing.
//
// Mounted INSIDE the authed provider tree (unlike the overlay), but
// mention/project data still arrives via props — one code path for
// both hosts of SpotlightContent.

import { useCallback, useEffect, useState } from "react";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import { Box, IconButton, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { useTranslation } from "../../i18n";
import type { MentionGroup } from "../../services/mentionGroupsApi";
import { purplePalette } from "../../theme/purplePalette";
import type { UserProps } from "../../types/admin";
import type { ProjectProps } from "../../types/tasks";
import { hasAskContent, SpotlightContent } from "../spotlight/SpotlightContent";
import type { SpotlightResult } from "../spotlight/types";
import type { UseSpotlightReturn } from "../spotlight/useSpotlight";
import { GenosSessionSidebar } from "./GenosSessionSidebar";
import { useGenosSessions } from "./useGenosSessions";

interface GenosHomeProps {
    // The App-root Spotlight hook return — one instance, two viewports
    // (this page + the Cmd-K overlay).
    spotlight: UseSpotlightReturn;
    accessToken: string | null;
    teamId: string | null | undefined;
    // Same prop bundle the overlay gets (see App.tsx) so SpotlightContent
    // keeps one code path across hosts.
    mentionMembers?: UserProps[];
    mentionGroups?: MentionGroup[];
    projects?: ProjectProps[];
    onSelect: (r: SpotlightResult) => void;
    onPreview: (r: SpotlightResult) => void;
    onOpenSettings: () => void;
}

const SIDEBAR_WIDTH = 268;

export const GenosHome = ({
    spotlight,
    accessToken,
    teamId,
    mentionMembers,
    mentionGroups,
    projects,
    onSelect,
    onPreview,
    onOpenSettings,
}: GenosHomeProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    // Theme-reactive tokens (CSS variables) — the accent wash, card
    // borders, and hero gradient all follow the active color theme.
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const isMobile = useIsMobile();
    // Mobile: the session sidebar is an overlay drawer, toggled from a
    // floating history button. Desktop always shows it.
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // Session list refresh: `turns.length` changes exactly when a turn
    // completes (or a session is resumed / cleared), which is when the
    // sidebar's rows can change.
    const {
        sessions,
        isLoading: sessionsLoading,
        search: sessionSearch,
        setSearch: setSessionSearch,
        pinError: sessionPinError,
        togglePin: toggleSessionPin,
    } = useGenosSessions({
        accessToken,
        teamId,
        refreshKey: spotlight.turns.length,
    });

    // Mirror of SpotlightContent's `inAgentMode`: hero-center the input
    // while there's no conversation, chat-layout once there is one.
    const conversationActive =
        spotlight.turns.length > 0 ||
        Boolean(spotlight.ask.sessionId) ||
        hasAskContent(spotlight.ask) ||
        spotlight.historyMode !== "closed";

    const handleSelectSession = useCallback(
        (sessionId: string) => {
            spotlight.resumeSession(sessionId);
            setMobileSidebarOpen(false);
        },
        [spotlight]
    );

    const handleNewChat = useCallback(() => {
        spotlight.onNewConversation();
        setMobileSidebarOpen(false);
    }, [spotlight]);

    // Leaving the page closes the mobile drawer so it doesn't reopen
    // stale on the next visit.
    useEffect(() => () => setMobileSidebarOpen(false), []);

    const sidebar = (
        <GenosSessionSidebar
            activeSessionId={spotlight.ask.sessionId}
            isLoading={sessionsLoading || spotlight.resumeIsLoading}
            pinError={sessionPinError}
            resumeError={spotlight.resumeError}
            search={sessionSearch}
            sessions={sessions}
            onNewChat={handleNewChat}
            onSearchChange={setSessionSearch}
            onSelectSession={handleSelectSession}
            onTogglePin={toggleSessionPin}
        />
    );

    return (
        <Box
            sx={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                // Clear the BottomTabBar on mobile; full height on desktop.
                height: {
                    xs: "calc(100dvh - var(--BottomTabBar-height, 60px))",
                    md: "100dvh",
                },
                position: "relative",
                overflow: "hidden",
                // Soft accent wash from the top — enough theme color to
                // not read as a blank white/black sheet, subtle enough to
                // stay out of the content's way. Theme-reactive.
                background: `radial-gradient(1000px 480px at 50% -8%, rgba(${palette.accentRgb}, ${
                    isDark ? 0.14 : 0.08
                }) 0%, transparent 65%)`,
            }}
        >
            {/* Session sidebar — static column on desktop. */}
            {!isMobile && (
                <Box
                    sx={{
                        width: SIDEBAR_WIDTH,
                        flexShrink: 0,
                        borderRight: "1px solid",
                        borderColor: palette.divider,
                        // The app-standard panel surface (theme-reactive
                        // gradient) instead of a flat tint.
                        background: palette.surface,
                        minHeight: 0,
                    }}
                >
                    {sidebar}
                </Box>
            )}

            {/* Mobile: drawer-style overlay + backdrop. */}
            {isMobile && mobileSidebarOpen && (
                <>
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 5,
                            background: "rgba(0,0,0,0.35)",
                        }}
                        onClick={() => setMobileSidebarOpen(false)}
                    />
                    <Box
                        sx={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: 0,
                            zIndex: 6,
                            width: "min(85vw, 320px)",
                            background: palette.surfaceSolid,
                            borderRight: "1px solid",
                            borderColor: palette.divider,
                            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                        }}
                    >
                        {sidebar}
                    </Box>
                </>
            )}

            {/* Main conversation column. */}
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    px: { xs: 1, sm: 3 },
                    py: { xs: 1, sm: 2 },
                }}
            >
                {isMobile && (
                    <AppTooltip
                        placement="right"
                        size="sm"
                        title={
                            mobileSidebarOpen
                                ? t.genos.sidebar.closeLabel
                                : t.genos.sidebar.openLabel
                        }
                    >
                        <IconButton
                            color="neutral"
                            size="sm"
                            sx={{ alignSelf: "flex-start", mb: 0.5 }}
                            variant="soft"
                            onClick={() => setMobileSidebarOpen((v) => !v)}
                        >
                            <HistoryRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </AppTooltip>
                )}
                <Box
                    sx={{
                        width: "100%",
                        maxWidth: 860,
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        // Empty state: center the input hero-style (the
                        // fragment's DOM order is input → chips → results,
                        // exactly the ChatGPT-like hero). With a
                        // conversation, SpotlightContent's agent-mode
                        // `order` flip pins the input to the bottom and
                        // the panel fills the column.
                        //
                        // The input has exactly TWO search-mode positions:
                        // centered while the box is empty, and lifted to a
                        // fixed offset the moment anything is typed. The
                        // flip is NOT driven from here — SpotlightContent
                        // overrides this centering with a spacer + an auto
                        // margin on the results card. That keeps it keyed
                        // to the *input's own* text rather than to the
                        // debounced `query` or the result count, so the
                        // box can't drift as results land and re-narrow
                        // while the user types.
                        justifyContent: conversationActive ? "flex-start" : "center",
                    }}
                >
                    {/* Empty-state hero greeting. Gradient title picks up
                        the active theme's accent (accentGradient is a
                        CSS-var-driven linear-gradient). */}
                    {!conversationActive && (
                        <Box sx={{ textAlign: "center", mb: 3, px: 2 }}>
                            <Typography
                                level="h2"
                                sx={{
                                    fontWeight: 700,
                                    letterSpacing: "-0.02em",
                                    background: palette.accentGradient,
                                    backgroundClip: "text",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                }}
                            >
                                {t.genos.hero.title}
                            </Typography>
                            <Typography
                                level="body-md"
                                sx={{ mt: 0.75, opacity: isDark ? 0.7 : 0.6 }}
                            >
                                {t.genos.hero.subtitle}
                            </Typography>
                        </Box>
                    )}
                    <SpotlightContent
                        aiAnswersEnabled={spotlight.aiAnswersEnabled}
                        ask={spotlight.ask}
                        backToHistoryList={spotlight.backToHistoryList}
                        closeHistory={spotlight.closeHistory}
                        error={spotlight.error}
                        filterProjectIds={spotlight.filterProjectIds}
                        filterServices={spotlight.filterServices}
                        historyDetail={spotlight.historyDetail}
                        historyIsLoading={spotlight.historyIsLoading}
                        historyMode={spotlight.historyMode}
                        historySessions={spotlight.historySessions}
                        isLoading={spotlight.isLoading}
                        mentionGroups={mentionGroups}
                        mentionMembers={mentionMembers}
                        openHistory={spotlight.openHistory}
                        projects={projects}
                        query={spotlight.query}
                        registerInputFocus={spotlight.registerPageInputFocus}
                        results={spotlight.results}
                        turns={spotlight.turns}
                        variant="page"
                        viewHistorySession={spotlight.viewHistorySession}
                        onApprove={spotlight.onApprove}
                        onAsk={spotlight.onAsk}
                        onCancel={spotlight.onCancel}
                        onChangeFilterProjects={spotlight.onChangeFilterProjects}
                        onFeedback={spotlight.submitFeedback}
                        onNewConversation={spotlight.onNewConversation}
                        onOpenSettings={onOpenSettings}
                        onPreview={onPreview}
                        onQueryChange={spotlight.setQuery}
                        onReject={spotlight.onReject}
                        onSelect={onSelect}
                        onToggleFilterService={spotlight.onToggleFilterService}
                    />
                </Box>
            </Box>
        </Box>
    );
};
