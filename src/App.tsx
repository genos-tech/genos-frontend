import "./App.css";

import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";
import { Navigate, Route, Routes } from "react-router-dom";

import { InitialLoad } from "./components/ui/misc/InitialLoad";
import { ChatHome } from "./features/chat/chatHome";
import { InboxHome } from "./features/inbox/inboxHome";
import { NoteHome } from "./features/notes/NoteHome";
import { TaskHome } from "./features/tasks/taskHome";
import { useAppInitialization } from "./hooks/common/useAppInitialization";
import { useProjectTaskManagement } from "./hooks/common/useProjectTaskManagement";
import { useServiceInitialization } from "./hooks/common/useServiceInitialization";
import { webSocketSync } from "./hooks/common/useSyncManagement";
import { useThreadTaskHandling } from "./hooks/common/useThreadTaskHandling";
import { useWebSocket } from "./hooks/common/useWebSocket";

export const App = () => {
    // Initialize app with authentication and basic setup
    const { accessToken, myself, setMyself, useUISM, useTEM } = useAppInitialization();

    // WebSocket management
    const { socketInstance } = useWebSocket(accessToken, myself, useTEM.currentTeamId);

    // Project and task management
    const { usePM, useTM } = useProjectTaskManagement({
        myself,
        accessToken: accessToken || "",
        currentTeamId: useTEM.currentTeamId,
    });

    // Service-specific initialization and management
    const { useNM, useCM, useIM } = useServiceInitialization({
        myself,
        accessToken: accessToken || "",
        currentTeamId: useTEM.currentTeamId,
        isLoading: useUISM.isLoading,
        openingService: useUISM.openingService,
        socketInstance,
    });

    // Handle thread task interactions
    useThreadTaskHandling({ useCM, useTM });

    // WebSocket synchronization
    webSocketSync({
        useCM: useCM,
        accessToken: accessToken,
        currentPreviewTaskId: useTM.currentPreviewTaskId,
        currentProject: usePM.currentProject,
        funcSetInboxItems: useIM.funcSetInboxItems,
        isLoading: useUISM.isLoading,
        myself: myself,
        setIsTaskCommentUpdated: useTM.setIsTaskCommentUpdated,
        setIsTaskUpdatedBySomeone: useTM.setIsTaskUpdatedBySomeone,
        socket: socketInstance,
    });

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            {useUISM.isLoading ? (
                <InitialLoad
                    myself={myself}
                    setCurrentMainChat={useCM.setCurrentMainChat}
                    setIsLoading={useUISM.setIsLoading}
                />
            ) : (
                <div className="main-container">
                    <Routes>
                        <Route
                            path="inbox/*"
                            element={
                                <InboxHome
                                    useCM={useCM}
                                    useIM={useIM}
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socketInstance}
                                    useTEM={useTEM}
                                    useUISM={useUISM}
                                />
                            }
                        />
                        <Route
                            path="chat/*"
                            element={
                                <ChatHome
                                    useCM={useCM}
                                    useIM={useIM}
                                    myself={myself}
                                    useNM={useNM}
                                    usePM={usePM}
                                    setMyself={setMyself}
                                    socket={socketInstance}
                                    useTEM={useTEM}
                                    useTM={useTM}
                                    useUISM={useUISM}
                                />
                            }
                        />
                        <Route
                            path="tasks/*"
                            element={
                                <TaskHome
                                    useCM={useCM}
                                    useIM={useIM}
                                    myself={myself}
                                    useNM={useNM}
                                    usePM={usePM}
                                    setMyself={setMyself}
                                    socket={socketInstance}
                                    useTEM={useTEM}
                                    useTM={useTM}
                                    useUISM={useUISM}
                                />
                            }
                        />
                        <Route
                            path="notes/*"
                            element={
                                <NoteHome
                                    useCM={useCM}
                                    useIM={useIM}
                                    myself={myself}
                                    useNM={useNM}
                                    usePM={usePM}
                                    setMyself={setMyself}
                                    socket={socketInstance}
                                    useTEM={useTEM}
                                    useTM={useTM}
                                    useUISM={useUISM}
                                />
                            }
                        />
                        {/* Default redirect to inbox */}
                        <Route path="" element={<Navigate to="inbox" replace />} />
                    </Routes>
                </div>
            )}
        </CssVarsProvider>
    );
};
