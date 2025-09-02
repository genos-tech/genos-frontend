import { Stack, Typography, IconButton, Button } from "@mui/joy";
import AddIcon from "@mui/icons-material/Add";
import { useColorScheme } from "@mui/joy/styles";

export const PinnedDivider = () => {
    const { mode } = useColorScheme();
    return (
        <Stack
            direction="row"
            spacing={1}
            sx={{
                backgroundColor: mode === "dark" ? "black" : "rgb(217, 217, 217)",
                py: 0.7,
                justifyContent: "center",
                alignItems: "center",
                mt: "3px",
            }}
        >
            <Typography
                component="h1"
                sx={{
                    fontSize: 14,
                }}
            >
                Pinned Messages
            </Typography>
        </Stack>
    );
};

type GMDividerProps = {
    setOpenCreateGM: (value: boolean) => void;
};
export const GMDivider = (props: GMDividerProps) => {
    const { setOpenCreateGM } = props;
    const { mode } = useColorScheme();
    return (
        <Stack
            direction="row"
            spacing={1}
            sx={{
                backgroundColor: mode === "dark" ? "black" : "rgb(217, 217, 217)",
                justifyContent: "center",
                alignItems: "center",
                mt: "3px",
            }}
        >
            <Typography
                component="h1"
                sx={{
                    fontSize: 14,
                }}
            >
                Group Messages
            </Typography>
            <IconButton
                component="a"
                size="sm"
                variant="plain"
                color="neutral"
                onClick={() => setOpenCreateGM(true)}
            >
                <AddIcon />
            </IconButton>
        </Stack>
    );
};

export const DMDivider = () => {
    const { mode } = useColorScheme();
    return (
        <Stack
            direction="row"
            spacing={1}
            sx={{
                backgroundColor: mode === "dark" ? "black" : "rgb(217, 217, 217)",
                py: 0.55,
                justifyContent: "center",
                alignItems: "center",
                mt: "3px",
            }}
        >
            <Typography
                component="h1"
                sx={{
                    fontSize: 14,
                }}
            >
                Direct Messages
            </Typography>
        </Stack>
    );
};

export const PMDivider = () => {
    const { mode } = useColorScheme();
    return (
        <Stack
            direction="row"
            spacing={1}
            sx={{
                backgroundColor: mode === "dark" ? "black" : "rgb(217, 217, 217)",
                py: 0.7,
                justifyContent: "center",
                alignItems: "center",
                mt: "3px",
            }}
        >
            <Typography
                component="h1"
                sx={{
                    fontSize: 14,
                }}
            >
                Project Updates
            </Typography>
        </Stack>
    );
};

type ActivityDividerProps = {
    currentActivityMessageType: number;
    setCurrentActivityMessageType: (value: number) => void;
};
export const ActivityDivider = (props: ActivityDividerProps) => {
    const { currentActivityMessageType, setCurrentActivityMessageType } = props;
    const { mode } = useColorScheme();

    return (
        <Stack
            direction="column"
            spacing={1}
            sx={{
                backgroundColor: mode === "dark" ? "black" : "rgb(217, 217, 217)",
                py: 0.7,
                justifyContent: "center",
                alignItems: "center",
                mt: "3px",
            }}
        >
            <Typography
                component="h1"
                sx={{
                    fontSize: 14,
                }}
            >
                Recent Activities
            </Typography>
            <Stack direction={"row"} spacing={0.5}>
                <Button
                    component="p"
                    size="sm"
                    variant={currentActivityMessageType === 0 ? "soft" : "outlined"}
                    sx={{ fontSize: "13px", my: "1px" }}
                    onClick={() => {
                        setCurrentActivityMessageType(0);
                    }}
                >
                    All
                </Button>
                <Button
                    component="p"
                    size="sm"
                    variant={currentActivityMessageType === 1 ? "soft" : "outlined"}
                    sx={{ fontSize: "13px", my: "1px" }}
                    onClick={() => {
                        if (currentActivityMessageType !== 1) {
                            setCurrentActivityMessageType(1);
                        } else {
                            setCurrentActivityMessageType(0);
                        }
                    }}
                >
                    Thread
                </Button>
                <Button
                    component="p"
                    size="sm"
                    variant={currentActivityMessageType === 2 ? "soft" : "outlined"}
                    sx={{ fontSize: "13px", my: "1px" }}
                    onClick={() => {
                        if (currentActivityMessageType !== 2) {
                            setCurrentActivityMessageType(2);
                        } else {
                            setCurrentActivityMessageType(0);
                        }
                    }}
                >
                    Task
                </Button>
                <Button
                    component="p"
                    size="sm"
                    variant={currentActivityMessageType === 3 ? "soft" : "outlined"}
                    sx={{ fontSize: "13px", my: "1px" }}
                    onClick={() => {
                        if (currentActivityMessageType !== 3) {
                            setCurrentActivityMessageType(3);
                        } else {
                            setCurrentActivityMessageType(0);
                        }
                    }}
                >
                    Mention
                </Button>
                <Button
                    component="p"
                    size="sm"
                    variant={currentActivityMessageType === 4 ? "soft" : "outlined"}
                    sx={{ fontSize: "13px", my: "1px" }}
                    onClick={() => {
                        if (currentActivityMessageType !== 4) {
                            setCurrentActivityMessageType(4);
                        } else {
                            setCurrentActivityMessageType(0);
                        }
                    }}
                >
                    Reaction
                </Button>
            </Stack>
        </Stack>
    );
};
