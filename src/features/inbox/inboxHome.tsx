import { useState } from "react";
import { Box, Sheet, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { InboxHeader } from "./components/InboxHeader";
import { InboxSection } from "./components/InboxSection";
import { InboxTab, InboxTabHeader } from "./components/InboxTabHeader";
import { useInboxItems } from "./hooks/useInboxItems";
import { useInboxScroll } from "./hooks/useInboxScroll";
import { InboxHomeProps } from "./types/inboxTypes";

import { Sidebar } from "../../components/layout/sidebar";

export const InboxHome = (props: InboxHomeProps) => {
    const { useTEM, useIM, myself, socket, setMyself, useCM, useUISM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const [activeTab, setActiveTab] = useState<InboxTab>("activities");
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
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    requestCount={
                        useIM.unReadInboxItemCount > 0 ? useIM.unReadInboxItemCount : undefined
                    }
                />

                {/* Content Area */}
                <Box
                    sx={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        position: "relative",
                    }}
                >
                    {/* Activities Tab Content */}
                    <Box
                        sx={{
                            display: activeTab === "activities" ? "flex" : "none",
                            flexDirection: "column",
                            height: "100%",
                            animation: activeTab === "activities" ? "fadeIn 0.3s ease" : "none",
                            "@keyframes fadeIn": {
                                from: { opacity: 0 },
                                to: { opacity: 1 },
                            },
                        }}
                    >
                        <InboxSection
                            ref={activityVirtuosoRef}
                            useCM={useCM}
                            itemKeyPrefix="inbox-general-items-bubble"
                            items={activityInboxItems}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            emptyTitle="No activities yet"
                            emptySubtitle="New updates and notifications will appear here"
                            isRequest={false}
                        />
                    </Box>

                    {/* Requests Tab Content */}
                    <Box
                        sx={{
                            display: activeTab === "requests" ? "flex" : "none",
                            flexDirection: "column",
                            height: "100%",
                            animation: activeTab === "requests" ? "fadeIn 0.3s ease" : "none",
                            "@keyframes fadeIn": {
                                from: { opacity: 0 },
                                to: { opacity: 1 },
                            },
                        }}
                    >
                        <InboxSection
                            ref={requestVirtuosoRef}
                            useCM={useCM}
                            itemKeyPrefix="inbox-request-bubble"
                            items={requestInboxItems}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            emptyTitle="No pending requests"
                            emptySubtitle="Team and project requests will show up here"
                            isRequest={true}
                        />
                    </Box>
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
