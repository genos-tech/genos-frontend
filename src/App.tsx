import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";

import { AppContent } from "./components/App/AppContent";
import { InitialLoad } from "./components/utils/InitialLoad";
import { useAppInitialization } from "./hooks/common/useAppInitialization";
import { useProjectTaskManagement } from "./hooks/common/useProjectTaskManagement";
import { useServiceInitialization } from "./hooks/common/useServiceInitialization";
import { webSocketSync } from "./hooks/common/useSyncManagement";
import { useThreadTaskHandling } from "./hooks/common/useThreadTaskHandling";
import { useWebSocket } from "./hooks/common/useWebSocket";

import "./App.css";

export const App = () => {
    // Initialize app with authentication and basic setup
    const { accessToken, myself, setMyself, UIM, TEM } = useAppInitialization();

    // WebSocket management
    const { socketInstance } = useWebSocket(accessToken, myself, TEM.currentTeamId);

    // Project and task management
    const { PM, TM } = useProjectTaskManagement({
        myself,
        accessToken: accessToken || "",
        currentTeamId: TEM.currentTeamId,
    });

    // Service-specific initialization and management
    const { NM, CM, IM } = useServiceInitialization({
        myself,
        accessToken: accessToken || "",
        currentTeamId: TEM.currentTeamId,
        isLoading: UIM.isLoading,
        openingService: UIM.openingService,
        socketInstance,
    });

    // Handle thread task interactions
    useThreadTaskHandling({ CM, TM });

    // WebSocket synchronization
    webSocketSync({
        CM: CM,
        accessToken: accessToken,
        currentPreviewTaskId: TM.currentPreviewTaskId,
        currentProject: PM.currentProject,
        funcSetInboxItems: IM.funcSetInboxItems,
        isLoading: UIM.isLoading,
        myself: myself,
        setIsTaskCommentUpdated: TM.setIsTaskCommentUpdated,
        setIsTaskUpdatedBySomeone: TM.setIsTaskUpdatedBySomeone,
        socket: socketInstance,
    });

    return UIM.isLoading || CM.currentMainChat === undefined ? (
        <InitialLoad
            myself={myself}
            setCurrentMainChat={CM.setCurrentMainChat}
            setIsLoading={UIM.setIsLoading}
        />
    ) : (
        <div className="main-container">
            <CssVarsProvider disableTransitionOnChange>
                <CssBaseline />
                <AppContent
                    openingService={UIM.openingService}
                    myself={myself}
                    setMyself={setMyself}
                    setOpeningService={UIM.setOpeningService}
                    socketInstance={socketInstance}
                    TEM={TEM}
                    PM={PM}
                    TM={TM}
                    NM={NM}
                    CM={CM}
                    IM={IM}
                    UIM={UIM}
                />
            </CssVarsProvider>
        </div>
    );
};
