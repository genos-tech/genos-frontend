import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
    Box,
    Chip,
    Dropdown,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Tooltip,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { ProjectAvatar } from "../../../../components/common/ProjectAvatar";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { TaskProps } from "../../../../types/tasks";

interface NoteActionsProps {
    isInTaskPage: boolean;
    currentTask: TaskProps | undefined;
    pmChat: AllChatProps | undefined;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: any;
    funcSetAllChats: () => Promise<void>;
    setCurrentMainChat: (chat: any) => void;
    setOpeningService: (service: number) => void;
    teamMemberProfiles: Record<string, UserProps>;
    onCreateChildNote: () => void;
    onOpenInNotes: () => void;
    onOpenTask: () => void;
    onDeleteNote: () => void;
    onCloseNotes: () => void;
}

export const NoteActions = ({
    isInTaskPage,
    currentTask,
    pmChat,
    myself,
    setMyself,
    socket,
    funcSetAllChats,
    setCurrentMainChat,
    setOpeningService,
    teamMemberProfiles,
    onCreateChildNote,
    onOpenInNotes,
    onOpenTask,
    onDeleteNote,
    onCloseNotes,
}: NoteActionsProps) => {
    const { mode } = useColorScheme();

    return (
        <Stack direction={"row"}>
            {isInTaskPage && (
                <IconButton
                    color="neutral"
                    component="button"
                    variant="plain"
                    sx={{
                        fontSize: "14px",
                        paddingRight: "10px",
                        height: "5px",
                    }}
                    onClick={onCreateChildNote}
                >
                    <AddIcon />
                    Child Note
                </IconButton>
            )}

            {isInTaskPage && (
                <Tooltip title="Open in Notes">
                    <IconButton
                        color="neutral"
                        size="sm"
                        sx={{ mb: "5px" }}
                        variant="plain"
                        onClick={onOpenInNotes}
                    >
                        <OpenInNewIcon />
                    </IconButton>
                </Tooltip>
            )}

            {!isInTaskPage && (
                <>
                    {currentTask && (
                        <>
                            {pmChat && (
                                <Box sx={{ mt: "2px" }}>
                                    <ProjectAvatar
                                        myself={myself}
                                        pmChat={pmChat}
                                        setMyself={setMyself}
                                        socket={socket}
                                        funcSetAllChats={funcSetAllChats}
                                        setCurrentMainChat={setCurrentMainChat}
                                        setOpeningService={setOpeningService}
                                        teamMemberProfiles={teamMemberProfiles}
                                    />
                                </Box>
                            )}
                            {currentTask.id && (
                                <Tooltip title="Open Task">
                                    <Chip
                                        key={`task-note-task-id${currentTask.id}`}
                                        color="neutral"
                                        size="sm"
                                        variant="outlined"
                                        sx={{
                                            mt: "3px",
                                            mx: "5px",
                                            height: "30px",
                                            borderRadius: "5px",
                                            fontWeight: "bold",
                                        }}
                                        onClick={onOpenTask}
                                    >
                                        ID: {currentTask.id}
                                    </Chip>
                                </Tooltip>
                            )}
                            <Chip
                                key={`task-title-${currentTask.id}`}
                                color="primary"
                                size="sm"
                                variant="outlined"
                                sx={{
                                    mt: "3px",
                                    mr: "5px",
                                    height: "30px",
                                    borderRadius: "5px",
                                    fontWeight: "bold",
                                }}
                            >
                                Title:{" "}
                                {currentTask.title.length > 14
                                    ? `${currentTask.title.slice(0, 14)}...`
                                    : currentTask.title || "N/A"}
                            </Chip>
                            {currentTask.status.status && (
                                <Chip
                                    key={`task-status-${currentTask.status.status}`}
                                    size="sm"
                                    sx={{
                                        mt: "3px",
                                        mr: "5px",
                                        height: "30px",
                                        backgroundColor: currentTask.status.color
                                            ? alpha(
                                                  currentTask.status.color,
                                                  mode === "dark" ? 0.5 : 0.75
                                              )
                                            : "transparent",
                                        color: currentTask.status.textColor,
                                        fontWeight: "bold",
                                        borderRadius: "5px",
                                    }}
                                >
                                    {currentTask.status.status}
                                </Chip>
                            )}
                        </>
                    )}
                </>
            )}

            <Dropdown>
                <Tooltip title="More Options">
                    <MenuButton
                        slots={{ root: IconButton }}
                        sx={{ mb: "5px" }}
                        slotProps={{
                            root: { color: "neutral" },
                        }}
                    >
                        <MoreVert />
                    </MenuButton>
                </Tooltip>
                <Menu size="sm">
                    <MenuItem onClick={onCreateChildNote}>
                        <AddIcon />
                        Child Note
                    </MenuItem>
                    <MenuItem
                        sx={{
                            color: "red",
                            fontWeight: "bold",
                        }}
                        onClick={onDeleteNote}
                    >
                        <DeleteIcon sx={{ color: "red" }} />
                        Delete Note
                    </MenuItem>
                </Menu>
            </Dropdown>

            {isInTaskPage && (
                <Tooltip title="Close Notes">
                    <IconButton
                        color="neutral"
                        size="sm"
                        sx={{ mb: "5px" }}
                        variant="plain"
                        onClick={onCloseNotes}
                    >
                        <CancelIcon />
                    </IconButton>
                </Tooltip>
            )}
        </Stack>
    );
};
