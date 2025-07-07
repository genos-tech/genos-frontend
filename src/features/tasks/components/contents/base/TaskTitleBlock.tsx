import { alpha } from "@mui/system";
import {
    Box,
    Chip,
    Snackbar,
    Stack,
    FormControl,
    Input,
    IconButton,
    Dropdown,
    MenuButton,
    Menu,
    MenuItem,
    Typography,
} from "@mui/joy";
import MoreVert from "@mui/icons-material/MoreVert";
import CancelIcon from "@mui/icons-material/Cancel";
import AddIcon from "@mui/icons-material/Add";
import { useColorScheme } from "@mui/joy/styles";

import { TaskProps } from "../../../../../types/tasks";

type TaskTitleBlockProps = {
    taskContents: TaskProps;
    taskTitle: string;
    setTaskTitle: (value: string) => void;
    setIsCreatingTask?: (value: any) => void;
    setTaskClosed?: (value: boolean) => void;
    setOpenCreateProject: (value: boolean) => void;
    setOpenCreateTag: (value: boolean) => void;
    titleError?: string;
    titleErrorOpen?: boolean;
    setTitleErrorOpen?: (value: boolean) => void;
    setTaskUpdated?: (value: boolean) => void;
    isPreviewMode: boolean;
};
export const TaskTitleBlock = (props: TaskTitleBlockProps) => {
    const {
        taskContents,
        taskTitle,
        setTaskTitle,
        setIsCreatingTask,
        setTaskClosed,
        setOpenCreateProject,
        setOpenCreateTag,
        titleError,
        titleErrorOpen,
        setTitleErrorOpen,
        setTaskUpdated,
        isPreviewMode,
    } = props;

    const { mode } = useColorScheme();

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
            }}
        >
            <Stack direction="row" sx={{ width: "100%", alignItems: "center" }}>
                {/* Wrap the title and task status in the same Box */}
                <Box
                    sx={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        flexGrow: 1,
                    }}
                >
                    {isPreviewMode && (
                        <Chip
                            key={taskContents.status.status}
                            size="lg"
                            variant="soft"
                            sx={{
                                backgroundColor: taskContents.status.color
                                    ? alpha(
                                          taskContents.status.color,
                                          mode === "dark" ? 0.5 : 0.75
                                      )
                                    : "transparent",
                                color: taskContents.status.textColor,
                                fontWeight: "bold",
                                borderRadius: "7px",
                            }}
                        >
                            {taskContents.status.status || "Open"}
                        </Chip>
                    )}
                    <FormControl required sx={{ width: "100%" }}>
                        <Input
                            key={"taskTitle"}
                            variant="soft"
                            placeholder="Task Title"
                            value={taskTitle}
                            onChange={(e) => {
                                setTaskTitle(e.target.value);
                            }}
                            onBlur={() => {
                                if (setTaskUpdated) {
                                    setTaskUpdated(true);
                                }
                            }}
                            sx={{
                                width: "100%",
                                fontSize: "20px",
                                fontWeight: "bold",
                                backgroundColor: "transparent",
                            }}
                        />
                    </FormControl>
                    {isPreviewMode && (
                        <Box>
                            <Typography
                                sx={{
                                    ml: "10px",
                                    fontSize: "20px",
                                    fontWeight: "bold",
                                    backgroundColor: "transparent",
                                }}
                            >
                                ID:{taskContents.id}
                            </Typography>
                        </Box>
                    )}
                </Box>

                <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    onClick={() => {
                        if (isPreviewMode === false && setIsCreatingTask) {
                            setIsCreatingTask({
                                flag: false,
                                parentTaskId: null,
                                rootTaskId: null,
                            });
                        }
                        if (isPreviewMode === true && setTaskClosed) {
                            setTaskClosed(true);
                        }
                    }}
                >
                    <CancelIcon />
                </IconButton>
                <Dropdown>
                    <MenuButton
                        size="sm"
                        slots={{ root: IconButton }}
                        slotProps={{ root: { color: "neutral" } }}
                    >
                        <MoreVert />
                    </MenuButton>
                    <Menu size="sm">
                        <MenuItem
                            onClick={() => {
                                setOpenCreateProject(true);
                            }}
                        >
                            <AddIcon />
                            New Project
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                setOpenCreateTag(true);
                            }}
                        >
                            <AddIcon />
                            New Tag
                        </MenuItem>
                    </Menu>
                </Dropdown>

                {isPreviewMode === false && titleError && titleErrorOpen !== undefined && (
                    <Snackbar
                        autoHideDuration={5000}
                        open={titleErrorOpen}
                        variant="soft"
                        color="danger"
                        anchorOrigin={{ vertical: "top", horizontal: "right" }}
                        onClose={(event, reason) => {
                            if (reason === "clickaway") {
                                return;
                            }
                            if (setTitleErrorOpen) {
                                setTitleErrorOpen(false);
                            }
                        }}
                    >
                        {titleError}
                    </Snackbar>
                )}
            </Stack>
        </Box>
    );
};
