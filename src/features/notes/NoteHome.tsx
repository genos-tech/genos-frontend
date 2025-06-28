import { Socket } from "socket.io-client";
import { CssVarsProvider } from "@mui/joy/styles";
import { Box, CssBaseline } from "@mui/joy";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

import { UserProps } from "../../types/admin";
import { Sidebar } from "../../components/layout/sidebar";
import { NoteSidebar } from "./components/NoteSidebar";

type NoteHomeProps = {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setOpeningService: (service: number) => void;
};

export const NoteHome = (props: NoteHomeProps) => {
    const { socket, myself, setMyself, setOpeningService } = props;

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
                <Sidebar
                    myself={myself}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
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
                            <h1>Note Home</h1>
                        </Box>
                    </Panel>
                </PanelGroup>
            </Box>
        </CssVarsProvider>
    );
};
