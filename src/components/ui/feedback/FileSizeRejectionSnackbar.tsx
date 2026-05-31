import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import { IconButton, Snackbar, Stack, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import {
    FileSizeRejection,
    formatBytes,
    MAX_UPLOAD_FILE_SIZE_LABEL,
} from "../../../utils/uploadLimits";

type FileSizeRejectionSnackbarProps = {
    /** When non-null, the snackbar is open and lists the rejected files.
     *  Pair with `useFileSizeGuard` to manage the value automatically. */
    rejection: FileSizeRejection | null;
    onDismiss: () => void;
    /** Auto-hide delay in ms. Defaults to 6000 — long enough to read a
     *  multi-file rejection, short enough not to be sticky. */
    autoHideDuration?: number;
};

/** How many file names the snackbar shows verbatim before collapsing
 *  the rest into "+ N more". Keeps a giant drag-and-drop from making
 *  the toast scroll the viewport. */
const PREVIEW_NAME_LIMIT = 3;

export const FileSizeRejectionSnackbar = ({
    rejection,
    onDismiss,
    autoHideDuration = 6000,
}: FileSizeRejectionSnackbarProps) => {
    const { t } = useTranslation();
    const open = rejection !== null;
    const previewFiles = rejection?.files.slice(0, PREVIEW_NAME_LIMIT) ?? [];
    const overflow = (rejection?.files.length ?? 0) - previewFiles.length;

    return (
        <Snackbar
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            autoHideDuration={autoHideDuration}
            color="warning"
            open={open}
            startDecorator={<WarningRoundedIcon />}
            variant="soft"
            endDecorator={
                <IconButton
                    color="warning"
                    size="sm"
                    sx={{ ml: 1, alignSelf: "flex-start" }}
                    variant="soft"
                    onClick={onDismiss}
                >
                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
            }
            sx={{
                zIndex: 12000,
                maxWidth: 420,
                alignItems: "flex-start",
            }}
            onClose={(_event, reason) => {
                if (reason === "clickaway") return;
                onDismiss();
            }}
        >
            <Stack spacing={0.25}>
                <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                    {fmt(t.common.ui.fileSize.limitExceededTitle, {
                        label: MAX_UPLOAD_FILE_SIZE_LABEL,
                    })}
                </Typography>
                {previewFiles.map((f) => (
                    <Typography key={`${f.name}-${f.size}`} level="body-xs">
                        {`• ${f.name} (${formatBytes(f.size)})`}
                    </Typography>
                ))}
                {overflow > 0 && (
                    <Typography level="body-xs" sx={{ opacity: 0.8 }}>
                        {fmt(t.common.ui.fileSize.overflowMore, { count: overflow })}
                    </Typography>
                )}
            </Stack>
        </Snackbar>
    );
};
