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
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { TaskProps } from "../../../../types/tasks";

interface NoteHeaderActionsProps {
    noteType: number;
    isInTaskPage: boolean;
    currentTask: TaskProps | undefined;
    pmChat: AllChatProps | undefined;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: any;
    funcSetAllChats: () => Promise<void>;
    setCurrentMainChat: (chat: any) => void;
    UIM: UIStateManagementState;
    teamMemberProfiles: Record<string, UserProps>;
    onCreateNewNote: () => void;
    onCreateChildNote: () => void;
    onOpenTask: () => void;
    onDeleteNote: () => void;
    onCloseNotes: () => void;
}

export const NoteHeaderActions = ({
    noteType,
    isInTaskPage,
    currentTask,
    pmChat,
    myself,
    setMyself,
    socket,
    funcSetAllChats,
    setCurrentMainChat,
    UIM,
    teamMemberProfiles,
    onCreateNewNote,
    onCreateChildNote,
    onOpenTask,
    onDeleteNote,
    onCloseNotes,
}: NoteHeaderActionsProps) => {
    const { mode } = useColorScheme();

    return (
        <Stack direction={"row"}>
            {noteType === 1 && (
                <Tooltip size="sm" title="Create a New Note" variant="outlined">
                    <IconButton
                        color="neutral"
                        size="sm"
                        variant="plain"
                        sx={{
                            pt: "1px",
                            px: "5px",
                            mt: "5px",
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
                <Stack direction={"row"} sx={{ mt: "5px" }}>
                    <ProjectAvatar
                        funcSetAllChats={funcSetAllChats}
                        myself={myself}
                        pmChat={pmChat}
                        setCurrentMainChat={setCurrentMainChat}
                        setMyself={setMyself}
                        UIM={UIM}
                        socket={socket}
                        teamMemberProfiles={teamMemberProfiles}
                    />

                    <Tooltip size="sm" title="Open Task on Click" variant="outlined">
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

                    <Tooltip size="sm" title={currentTask.title} variant="outlined">
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
                            {currentTask.title.length > 30
                                ? `${currentTask.title.slice(0, 30)}...`
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
                </Stack>
            )}

            <Dropdown>
                <MenuButton
                    slots={{ root: IconButton }}
                    sx={{ mt: "5px" }}
                    slotProps={{
                        root: { color: "neutral" },
                    }}
                >
                    <MoreVert />
                </MenuButton>
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
                <Tooltip size="sm" title="Close" variant="outlined">
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
