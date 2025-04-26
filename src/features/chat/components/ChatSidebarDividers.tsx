import { Stack, Typography, IconButton } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import { useColorScheme } from '@mui/joy/styles';

export const PinnedDivider = () => {
    const { mode } = useColorScheme();
    return (
        <Stack
            direction="row"
            spacing={1}
            sx={{
                backgroundColor: mode === 'dark' ? 'black' : 'rgb(217, 217, 217)',
                alignItems: "center",
                justifyContent: "space-between",
                px: 2,
                py: 1,
            }}
        >
            <Typography
                component="h1"
                sx={{ fontSize: { xs: 13 }, fontWeight: "lg", mr: "auto" }}
            >
                Pinned
            </Typography>
        </Stack>
    )
}

type GMDividerProps = {
    setOpenCreateGM: (value: boolean) => void;
}
export const GMDivider = (props: GMDividerProps) => {
    const { setOpenCreateGM } = props
    const { mode } = useColorScheme();
    return (
        <Stack
            direction="row"
            spacing={1}
            sx={{
                backgroundColor: mode === 'dark' ? 'black' : 'rgb(217, 217, 217)',
                alignItems: "center",
                justifyContent: "space-between",
                px: 2,
                py: 0.5,
            }}
        >
            <Typography
                component="h1"
                sx={{ fontSize: { xs: 13 }, fontWeight: "lg", mr: "auto" }}
            >
                GMs
            </Typography>
            <IconButton
                component='a'
                size="sm"
                variant="plain"
                color="neutral"
                onClick={() => setOpenCreateGM(true)}
            >
                <AddIcon />
            </IconButton>
        </Stack>
    )
}

export const DMDivider = () => {
    const { mode } = useColorScheme();
    return (
        <Stack
            direction="row"
            spacing={1}
            sx={{
                backgroundColor: mode === 'dark' ? 'black' : 'rgb(217, 217, 217)',
                alignItems: "center",
                justifyContent: "space-between",
                px: 2,
                py: 1,
            }}
        >
            <Typography
                component="h1"
                sx={{ fontSize: { xs: 13 }, fontWeight: "lg", mr: "auto" }}
            >
                DMs
            </Typography>
        </Stack>
    )
}
