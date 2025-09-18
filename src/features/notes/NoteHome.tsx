import { Socket } from "socket.io-client";
import { useState, useEffect } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { Box, CssBaseline, Typography } from "@mui/joy";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { PartialBlock } from "@blocknote/core";

import { UserProps } from "../../types/admin";
import { Sidebar } from "../../components/layout/sidebar";
import { NoteSidebar } from "./components/NoteSidebar";
import { ChatProps } from "../../types/chat";
import { NoteMain } from "./components/NoteMain";

type NoteHomeProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (value: ChatProps) => void;
    unReadInboxItemCount: number;
    unReadChatAndActivityCounts: number;
};

export const NoteHome = (props: NoteHomeProps) => {
    const {
        teamMemberProfiles,
        socket,
        teamMembers,
        myself,
        setMyself,
        openingService,
        setOpeningService,
        setCurrentMainChat,
        unReadInboxItemCount,
        unReadChatAndActivityCounts,
    } = props;

    const tmpCurrentBody: any[] = [];
    const [body, setBody] = useState<PartialBlock[]>(tmpCurrentBody);
    const [taskBodyUpdated, setNoteBodyUpdated] = useState(false);
    const [taskBodySaved, setNoteBodySaved] = useState(false);

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
                <Sidebar
                    teamMemberProfiles={teamMemberProfiles}
                    socket={socket}
                    myself={myself}
                    setMyself={setMyself}
                    openingService={openingService}
                    setOpeningService={setOpeningService}
                    setCurrentMainChat={setCurrentMainChat}
                    unReadInboxItemCount={unReadInboxItemCount}
                    unReadChatAndActivityCounts={unReadChatAndActivityCounts}
                />
                <PanelGroup direction="horizontal">
                    <Panel id={"1"} order={1} minSize={5} maxSize={20}>
                        <NoteSidebar myself={myself} />
                    </Panel>

                    {/* Resizable Handle with MUI sx Styling */}
                    <PanelResizeHandle
                        style={{
                            width: "1px",
                            backgroundColor: "#f0f0f0",
                            transition: "all 0.3s ease-in-out",
                            cursor: "col-resize",
                        }}
                        className="resize-handle"
                    />

                    <Panel id={"2"} order={2} minSize={5} maxSize={95}>
                        <Box sx={{ padding: 2 }}>
                            {/* Main content goes here */}
                            <Typography fontSize={"20px"}>Note Home</Typography>
                            <NoteMain
                                teamMemberProfiles={teamMemberProfiles}
                                socket={socket}
                                teamMembers={teamMembers}
                                myself={myself}
                                setMyself={setMyself}
                                body={body}
                                setBody={setBody}
                                setOpeningService={setOpeningService}
                                setNoteBodyUpdated={setNoteBodyUpdated}
                                setNoteBodySaved={setNoteBodySaved}
                                setCurrentChat={setCurrentMainChat}
                            />
                        </Box>
                    </Panel>
                </PanelGroup>
            </Box>
        </CssVarsProvider>
    );
};
