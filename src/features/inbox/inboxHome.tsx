import { Box, Sheet } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { InboxHeader } from "./components/InboxHeader";
import { InboxSection } from "./components/InboxSection";
import { InboxTabHeader } from "./components/InboxTabHeader";
import { useInboxItems } from "./hooks/useInboxItems";
import { InboxHomeProps } from "./types/inboxTypes";

import { LayoutStyles } from "../../components/ui/styles/commonStyle";
import { useTranslation } from "../../i18n";
import { InboxItemProps } from "../../types/common";

// Wrapper component for Activities section with item routing
const ActivitiesSection = (props: InboxHomeProps & { items: InboxItemProps[] }) => {
    const { itemId } = useParams<{ itemId?: string }>();
    const { items, useCM, myself, setMyself, socket, useTEM, useUISM } = props;
    const { t } = useTranslation();

    // If there's an itemId in the URL, we could scroll to it or highlight it
    // For now, we just render the section normally
    return (
        <InboxSection
            emptySubtitle={t.inbox.emptyStates.activitiesSubtitle}
            emptyTitle={t.inbox.emptyStates.activitiesTitle}
            isRequest={false}
            itemKeyPrefix="inbox-general-items-bubble"
            items={items}
            myself={myself}
            setMyself={setMyself}
            socket={socket}
            useCM={useCM}
            useTEM={useTEM}
            useUISM={useUISM}
            selectedItemId={
                itemId && !Number.isNaN(parseInt(itemId, 10)) ? parseInt(itemId, 10) : undefined
            }
            onItemChanged={props.useIM.funcSetInboxItems}
        />
    );
};

// Wrapper component for Requests section with item routing
const RequestsSection = (props: InboxHomeProps & { items: InboxItemProps[] }) => {
    const { itemId } = useParams<{ itemId?: string }>();
    const { items, useCM, myself, setMyself, socket, useTEM, useUISM } = props;
    const { t } = useTranslation();

    return (
        <InboxSection
            emptySubtitle={t.inbox.emptyStates.requestsSubtitle}
            emptyTitle={t.inbox.emptyStates.requestsTitle}
            isRequest={true}
            itemKeyPrefix="inbox-request-bubble"
            items={items}
            myself={myself}
            setMyself={setMyself}
            socket={socket}
            useCM={useCM}
            useTEM={useTEM}
            useUISM={useUISM}
            selectedItemId={
                itemId && !Number.isNaN(parseInt(itemId, 10)) ? parseInt(itemId, 10) : undefined
            }
            onItemChanged={props.useIM.funcSetInboxItems}
        />
    );
};

export const InboxHome = (props: InboxHomeProps) => {
    const { useIM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const { activityInboxItems, requestInboxItems } = useInboxItems(useIM.inboxItems);

    const ls = isDark ? LayoutStyles.dark : LayoutStyles.light;

    return (
        <Box sx={LayoutStyles.outerWrapper}>
            <Sheet sx={{ width: "100%", ...ls.serviceSurface }}>
                {/* Background decorations */}

                {/* Header */}
                <InboxHeader
                    activityItems={activityInboxItems}
                    myself={props.myself}
                    onItemsChanged={useIM.funcSetInboxItems}
                />

                {/* Tab Navigation */}
                <InboxTabHeader
                    activityCount={
                        useIM.unReadActivityCount > 0 ? useIM.unReadActivityCount : undefined
                    }
                    requestCount={
                        useIM.unReadRequestCount > 0 ? useIM.unReadRequestCount : undefined
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
                                    <RequestsSection {...props} items={requestInboxItems} />
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
                                    <RequestsSection {...props} items={requestInboxItems} />
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
                                    <ActivitiesSection {...props} items={activityInboxItems} />
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
                                    <ActivitiesSection {...props} items={activityInboxItems} />
                                </Box>
                            }
                        />

                        {/* Default = Activities, matching the tab order
                            (it's the leftmost tab and where the steady
                            stream lands); the Requests badge still pulls
                            attention when something needs a decision. */}
                        <Route element={<Navigate to="activities" replace />} path="" />
                    </Routes>
                </Box>
            </Sheet>
        </Box>
    );
};
