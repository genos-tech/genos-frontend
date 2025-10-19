import AddIcon from "@mui/icons-material/Add";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
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
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { ProjectAvatar } from "../../../../components/common/ProjectAvatar";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { TaskProps } from "../../../../types/tasks";

interface NoteActionsProps {
    noteType: number;
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
    onCreateNewNote: () => void;
    onCreateChildNote: () => void;
    onOpenTask: () => void;
    onDeleteNote: () => void;
    onCloseNotes: () => void;
}

export const NoteActions = ({
    noteType,
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
    onCreateNewNote,
    onCreateChildNote,
    onOpenTask,
    onDeleteNote,
    onCloseNotes,
}: NoteActionsProps) => {
    const { mode } = useColorScheme();

    return (
        <Stack direction={"row"}>
            {noteType === 1 && (
                <Tooltip title="Create a New Note">
                    <IconButton
                        color="neutral"
                        size="sm"
                        variant="plain"
                        sx={{
                            mt: "3px",
                            mx: "5px",
                            height: "30px",
                            borderRadius: "5px",
                        }}
                        onClick={onCreateNewNote}
                    >
                        <AddIcon />
                        New Note
                    </IconButton>
                </Tooltip>
            )}

            {noteType === 2 && !isInTaskPage && currentTask && currentTask.id && pmChat && (
                <>
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

                    <Tooltip title="Open Task">
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
                            onClick={onOpenTask}
                        >
                            Title:{" "}
                            {currentTask.title.length > 14
                                ? `${currentTask.title.slice(0, 14)}...`
                                : currentTask.title || "N/A"}
                        </Chip>
                    </Tooltip>

                    <Chip
                        key={`task-status-${currentTask.status.status}`}
                        size="sm"
                        sx={{
                            mt: "3px",
                            mr: "5px",
                            height: "30px",
                            backgroundColor: currentTask.status.color
                                ? alpha(currentTask.status.color, mode === "dark" ? 0.5 : 0.75)
                                : "transparent",
                            color: currentTask.status.textColor,
                            fontWeight: "bold",
                            borderRadius: "5px",
                        }}
                    >
                        {currentTask.status.status}
                    </Chip>
                </>
            )}

            <Dropdown>
                <Tooltip title="More Options" placement="left-start">
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
                    {noteType === 2 && currentTask && currentTask.id && (
                        <MenuItem onClick={onOpenTask}>
                            <AssignmentRoundedIcon />
                            <Typography level="title-sm" sx={{ mb: "3px" }}>
                                Open Task
                            </Typography>
                        </MenuItem>
                    )}
                    {noteType === 2 && isInTaskPage && (
                        <MenuItem onClick={onOpenTask}>
                            <NoteAltIcon />
                            <Typography level="title-sm" sx={{ mb: "3px" }}>
                                Move to Notes
                            </Typography>
                        </MenuItem>
                    )}

                    {noteType === 1 && (
                        <MenuItem onClick={onCreateNewNote}>
                            <AddIcon />
                            <Typography level="title-sm" sx={{ mb: "3px" }}>
                                New Note
                            </Typography>
                        </MenuItem>
                    )}

                    <MenuItem onClick={onCreateChildNote}>
                        <AddIcon />
                        <Typography level="title-sm" sx={{ mb: "3px" }}>
                            Child Note
                        </Typography>
                    </MenuItem>
                    <MenuItem
                        sx={{
                            color: "red",
                            fontWeight: "bold",
                        }}
                        onClick={onDeleteNote}
                    >
                        <DeleteIcon sx={{ color: "red" }} />
                        <Typography color="danger" level="title-sm" sx={{ mb: "3px" }}>
                            Delete Note
                        </Typography>
                    </MenuItem>
                </Menu>
            </Dropdown>

            {isInTaskPage && (
                <Tooltip title="Close">
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
