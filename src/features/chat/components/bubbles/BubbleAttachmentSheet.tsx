import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import { Box, Stack, Typography } from "@mui/joy";

import { BaseAvatar } from "../../../../components/ui/avatars/BaseAvatar";
import { BubbleMeta } from "../../../../components/ui/bubble";
import { g, type } from "../../../../theme/tokens";

type BubbleAttachmentSheetTypes = {
    fileName: string;
    fileSize: string;
    isSent: boolean;
};

// A file chip in a message. Flat, on the same surface, radius and pointed
// corner as the bubble it replaces (MIP-1130); the accent only marks the icon.
export const BubbleAttachmentSheet = (props: BubbleAttachmentSheetTypes) => {
    const { fileName, fileSize, isSent } = props;

    return (
        <Box
            sx={{
                px: 1.5,
                py: 1.25,
                borderRadius: g.radius.lg,
                ...(isSent
                    ? { borderTopRightRadius: g.radius.xs }
                    : { borderTopLeftRadius: g.radius.xs }),
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
                bgcolor: g.surface.default,
                border: "1px solid",
                borderColor: g.border.default,
                transition: `border-color ${g.motion.fast} ${g.ease}`,
                "&:hover": { borderColor: g.border.strong },
            }}
        >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <BaseAvatar
                    size="lg"
                    sx={{
                        bgcolor: g.accent.subtle,
                        border: "1px solid",
                        borderColor: g.accent.border,
                    }}
                >
                    <InsertDriveFileRoundedIcon
                        sx={{
                            fontSize: 20,
                            color: g.accent.text,
                            "--Icon-color": g.accent.text,
                        }}
                    />
                </BaseAvatar>
                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        sx={{
                            ...type("title-sm"),
                            color: g.text.primary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {fileName}
                    </Typography>
                    <BubbleMeta>{fileSize}</BubbleMeta>
                </Box>
            </Stack>
        </Box>
    );
};
