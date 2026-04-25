import { Box, Sheet, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { InboxHeader } from "./components/InboxHeader";
import { InboxSection } from "./components/InboxSection";
import { InboxTabHeader } from "./components/InboxTabHeader";
import { useInboxItems } from "./hooks/useInboxItems";
import { useInboxScroll } from "./hooks/useInboxScroll";
import { InboxHomeProps } from "./types/inboxTypes";

import { Sidebar } from "../../components/layout/sidebar";

// Wrapper component for Activities section with item routing
const ActivitiesSection = (props: InboxHomeProps & { items: any[]; virtuosoRef: any }) => {
    const { itemId } = useParams<{ itemId?: string }>();
    const { items, virtuosoRef, useCM, myself, setMyself, socket, useTEM, useUISM } = props;

    // If there's an itemId in the URL, we could scroll to it or highlight it
    // For now, we just render the section normally
    return (
        <InboxSection
            ref={virtuosoRef}
            useCM={useCM}
            itemKeyPrefix="inbox-general-items-bubble"
            items={items}
            myself={myself}
            setMyself={setMyself}
            socket={socket}
            useTEM={useTEM}
            useUISM={useUISM}
            emptyTitle="No activities yet"
            emptySubtitle="New updates and notifications will appear here"
            isRequest={false}
            selectedItemId={itemId && !Number.isNaN(parseInt(itemId, 10)) ? parseInt(itemId, 10) : undefined}
        />
    );
};

// Wrapper component for Requests section with item routing
const RequestsSection = (props: InboxHomeProps & { items: any[]; virtuosoRef: any }) => {
    const { itemId } = useParams<{ itemId?: string }>();
    const { items, virtuosoRef, useCM, myself, setMyself, socket, useTEM, useUISM } = props;

    return (
        <InboxSection
            ref={virtuosoRef}
            useCM={useCM}
            itemKeyPrefix="inbox-request-bubble"
            items={items}
            myself={myself}
            setMyself={setMyself}
            socket={socket}
            useTEM={useTEM}
            useUISM={useUISM}
            emptyTitle="No pending requests"
            emptySubtitle="Team and project requests will show up here"
            isRequest={true}
            selectedItemId={itemId && !Number.isNaN(parseInt(itemId, 10)) ? parseInt(itemId, 10) : undefined}
        />
    );
};

export const InboxHome = (props: InboxHomeProps) => {
    const { useTEM, useIM, myself, socket, setMyself, useCM, useUISM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const { activityInboxItems, requestInboxItems } = useInboxItems(useIM.inboxItems);
    const activityVirtuosoRef = useInboxScroll(activityInboxItems);
    const requestVirtuosoRef = useInboxScroll(requestInboxItems);

    return (
        <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
            <Sidebar
                useCM={useCM}
                useIM={useIM}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useTEM={useTEM}
                useUISM={useUISM}
            />

            <Sheet
                sx={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    background: isDark
                        ? "linear-gradient(180deg, rgba(18,18,22,1) 0%, rgba(12,12,16,1) 100%)"
                        : "linear-gradient(180deg, rgba(248,248,252,1) 0%, rgba(244,244,250,1) 100%)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Background decoration */}
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: "50%",
                        height: "60%",
                        background: isDark
                            ? "radial-gradient(ellipse at top right, rgba(99,102,241,0.06) 0%, transparent 60%)"
                            : "radial-gradient(ellipse at top right, rgba(79,70,229,0.04) 0%, transparent 60%)",
                        pointerEvents: "none",
                    }}
                />
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        width: "40%",
                        height: "40%",
                        background: isDark
                            ? "radial-gradient(ellipse at bottom left, rgba(139,92,246,0.04) 0%, transparent 60%)"
                            : "radial-gradient(ellipse at bottom left, rgba(124,58,237,0.03) 0%, transparent 60%)",
                        pointerEvents: "none",
                    }}
                />

                {/* Header */}
                <InboxHeader />

                {/* Tab Navigation */}
                <InboxTabHeader
                    requestCount={
                        useIM.unReadInboxItemCount > 0 ? useIM.unReadInboxItemCount : undefined
                    }
                />

                {/* Content Area with Routes */}
                <Box
                    sx={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        position: "relative",
                    }}
                >
                    <Routes>
                        {/* Activities routes */}
                        <Route
                            path="activities"
                            element={
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        height: "100%",
                                        animation: "fadeIn 0.3s ease",
                                        "@keyframes fadeIn": {
                                            from: { opacity: 0 },
                                            to: { opacity: 1 },
                                        },
                                    }}
                                >
                                    <ActivitiesSection
                                        {...props}
                                        items={activityInboxItems}
                                        virtuosoRef={activityVirtuosoRef}
                                    />
                                </Box>
                            }
                        />
                        <Route
                            path="activities/:itemId"
                            element={
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        height: "100%",
                                        animation: "fadeIn 0.3s ease",
                                        "@keyframes fadeIn": {
                                            from: { opacity: 0 },
                                            to: { opacity: 1 },
                                        },
                                    }}
                                >
                                    <ActivitiesSection
                                        {...props}
                                        items={activityInboxItems}
                                        virtuosoRef={activityVirtuosoRef}
                                    />
                                </Box>
                            }
                        />

                        {/* Requests routes */}
                        <Route
                            path="requests"
                            element={
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        height: "100%",
                                        animation: "fadeIn 0.3s ease",
                                        "@keyframes fadeIn": {
                                            from: { opacity: 0 },
                                            to: { opacity: 1 },
                                        },
                                    }}
                                >
                                    <RequestsSection
                                        {...props}
                                        items={requestInboxItems}
                                        virtuosoRef={requestVirtuosoRef}
                                    />
                                </Box>
                            }
                        />
                        <Route
                            path="requests/:itemId"
                            element={
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        height: "100%",
                                        animation: "fadeIn 0.3s ease",
                                        "@keyframes fadeIn": {
                                            from: { opacity: 0 },
                                            to: { opacity: 1 },
                                        },
                                    }}
                                >
                                    <RequestsSection
                                        {...props}
                                        items={requestInboxItems}
                                        virtuosoRef={requestVirtuosoRef}
                                    />
                                </Box>
                            }
                        />

                        {/* Default redirect to activities */}
                        <Route path="" element={<Navigate to="activities" replace />} />
                    </Routes>
                </Box>

                {/* Footer */}
                <Box
                    sx={{
                        px: 3,
                        py: 1.5,
                        borderTop: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Typography
                        level="body-xs"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)",
                            fontSize: 10,
                        }}
                    >
                        Keep your inbox tidy
                    </Typography>
                </Box>
            </Sheet>
        </Box>
    );
};
