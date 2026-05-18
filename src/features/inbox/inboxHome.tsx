import { Box, Sheet, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { InboxHeader } from "./components/InboxHeader";
import { InboxSection } from "./components/InboxSection";
import { InboxTabHeader } from "./components/InboxTabHeader";
import { useInboxItems } from "./hooks/useInboxItems";
import { useInboxScroll } from "./hooks/useInboxScroll";
import { InboxHomeProps } from "./types/inboxTypes";

import { LayoutStyles } from "../../components/ui/styles/commonStyle";
import { useTranslation } from "../../i18n";
import { purplePalette } from "../../theme/purplePalette";

// Wrapper component for Activities section with item routing
const ActivitiesSection = (props: InboxHomeProps & { items: any[]; virtuosoRef: any }) => {
    const { itemId } = useParams<{ itemId?: string }>();
    const { items, virtuosoRef, useCM, myself, setMyself, socket, useTEM, useUISM } = props;
    const { t } = useTranslation();

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
            emptyTitle={t.inbox.emptyStates.activitiesTitle}
            emptySubtitle={t.inbox.emptyStates.activitiesSubtitle}
            isRequest={false}
            selectedItemId={
                itemId && !Number.isNaN(parseInt(itemId, 10)) ? parseInt(itemId, 10) : undefined
            }
        />
    );
};

// Wrapper component for Requests section with item routing
const RequestsSection = (props: InboxHomeProps & { items: any[]; virtuosoRef: any }) => {
    const { itemId } = useParams<{ itemId?: string }>();
    const { items, virtuosoRef, useCM, myself, setMyself, socket, useTEM, useUISM } = props;
    const { t } = useTranslation();

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
            emptyTitle={t.inbox.emptyStates.requestsTitle}
            emptySubtitle={t.inbox.emptyStates.requestsSubtitle}
            isRequest={true}
            selectedItemId={
                itemId && !Number.isNaN(parseInt(itemId, 10)) ? parseInt(itemId, 10) : undefined
            }
        />
    );
};

export const InboxHome = (props: InboxHomeProps) => {
    const { useIM } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const { activityInboxItems, requestInboxItems } = useInboxItems(useIM.inboxItems);
    const activityVirtuosoRef = useInboxScroll(activityInboxItems);
    const requestVirtuosoRef = useInboxScroll(requestInboxItems);

    const ls = isDark ? LayoutStyles.dark : LayoutStyles.light;
    const p = isDark ? purplePalette.dark : purplePalette.light;

    return (
        <Box sx={LayoutStyles.outerWrapper}>
            <Sheet sx={{ width: "100%", ...ls.serviceSurface }}>
                {/* Background decorations */}
                <Box sx={ls.decorTopRight} />
                <Box sx={ls.decorBottomLeft} />

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

                        {/* Default redirect to requests */}
                        <Route path="" element={<Navigate to="requests" replace />} />
                    </Routes>
                </Box>

                {/* Footer */}
                <Box
                    sx={{
                        px: 3,
                        py: 1.5,
                        borderTop: "1px solid",
                        borderColor: p.borderMuted,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Typography level="body-xs" sx={{ color: p.textSubtle, fontSize: 10 }}>
                        {t.inbox.footer.tagline}
                    </Typography>
                </Box>
            </Sheet>
        </Box>
    );
};
