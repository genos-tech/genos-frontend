import CheckIcon from "@mui/icons-material/Check";
import { Chip, Stack } from "@mui/joy";

type TaskCustomBarBlockProps = {
    taskBodySaved: boolean;
};

export const TaskCustomBarBlock = (props: TaskCustomBarBlockProps) => {
    const { taskBodySaved } = props;

    if (!taskBodySaved) {
        return null;
    }

    return (
        <Stack
            direction="row"
            sx={{
                width: "100%",
                alignItems: "center",
                gap: 1.5,
                justifyContent: "flex-end",
            }}
        >
            <Chip
                color="neutral"
                size="sm"
                startDecorator={<CheckIcon sx={{ fontSize: 14 }} />}
                variant="soft"
                sx={{
                    fontWeight: 500,
                    fontSize: "13px",
                    "--Chip-paddingInline": "10px",
                    animation: "fadeIn 0.3s ease-in-out",
                    "@keyframes fadeIn": {
                        from: { opacity: 0, transform: "scale(0.95)" },
                        to: { opacity: 1, transform: "scale(1)" },
                    },
                }}
            >
                Saved
            </Chip>
        </Stack>
    );
};
