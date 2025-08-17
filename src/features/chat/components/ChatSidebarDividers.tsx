import { Stack, Typography, IconButton } from "@mui/joy";
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
                py: 0.5,
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
                py: 0.5,
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
                py: 0.5,
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

export const ActivityDivider = () => {
    const { mode } = useColorScheme();
    return (
        <Stack
            direction="row"
            spacing={1}
            sx={{
                backgroundColor: mode === "dark" ? "black" : "rgb(217, 217, 217)",
                py: 0.5,
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
        </Stack>
    );
};
