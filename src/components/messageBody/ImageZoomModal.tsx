/**
 * Click-to-zoom lightbox for an image in a message, note or task body.
 *
 * One component for every surface that zooms an image (the chat bubble editor,
 * the plain-DOM `LightMessageBody`, the note and task editors, the task tabs and
 * the attachment strip of the create form). Each of them used to inline its own
 * copy of the dialog, in a hand-built frame; they now share the `ModalFrame`
 * (MIP-1126): a title row with the download action and the X, and the image in a
 * dialog as wide as the image.
 */

import DownloadIcon from "@mui/icons-material/Download";
import { IconButton } from "@mui/joy";

import { useTranslation } from "../../i18n";
import { focusRing, g } from "../../theme/tokens";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { downloadFile } from "../../utils/downloadUtils";
import { AppTooltip } from "../ui/AppTooltip";
import { ModalFrame } from "../ui/modal/ModalFrame";

export type ImageZoomModalProps = {
    /** Resolved (blob or public) src to show, or `null` when closed. */
    src: string | null;
    onClose: () => void;
    /** Start of the downloaded file's name (`<stem>-<timestamp>.png`). */
    filenameStem?: string;
    /** Replaces the default download (fetch the src, save it under `filenameStem`). */
    onDownload?: (src: string) => void | Promise<void>;
    /** Exact layer; the frame's page layer (10010) when omitted. */
    zIndex?: number;
    /** The layer of the surface that opened the lightbox; the frame sits above it. */
    hostZIndex?: number;
};

export const ImageZoomModal = ({
    src,
    onClose,
    filenameStem = "chat-message-image",
    onDownload,
    zIndex,
    hostZIndex,
}: ImageZoomModalProps) => {
    const { t } = useTranslation();

    const handleDownload = async (url: string) => {
        if (onDownload) {
            await onDownload(url);
            return;
        }
        await downloadFile(url, `${filenameStem}-${getLocalCurrentTimestamp()}.png`);
    };

    return (
        <ModalFrame
            hostZIndex={hostZIndex}
            open={src !== null}
            size="fit"
            title={t.common.editor.imagePreviewTitle}
            zIndex={zIndex}
            headerAccessory={
                src ? (
                    <AppTooltip placement="bottom" size="sm" title={t.common.editor.download}>
                        <IconButton
                            aria-label={t.common.editor.download}
                            color="neutral"
                            size="sm"
                            variant="plain"
                            sx={{
                                mt: "-4px",
                                color: g.text.secondary,
                                "&:hover": { background: g.hover, color: g.text.primary },
                                "&:focus:not(:focus-visible)": { outline: "none" },
                                "&:focus-visible": focusRing,
                            }}
                            onClick={() => void handleDownload(src)}
                        >
                            <DownloadIcon />
                        </IconButton>
                    </AppTooltip>
                ) : null
            }
            flush
            headerDivider
            onClose={onClose}
        >
            {src ? (
                <img
                    alt={t.common.editor.imagePreviewAlt}
                    src={src}
                    style={{
                        display: "block",
                        maxWidth: "calc(100vw - 26px)",
                        maxHeight: "calc(100dvh - 130px)",
                        margin: "0 auto",
                    }}
                />
            ) : null}
        </ModalFrame>
    );
};
