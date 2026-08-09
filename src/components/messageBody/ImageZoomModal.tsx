/**
 * Click-to-zoom lightbox for a message-body image.
 *
 * Extracted verbatim from `BnChatPreview`'s inlined modal (the editor path
 * still has its own copy for code/table messages that also carry an image;
 * this one serves the plain-DOM `LightMessageBody`). Kept as its own
 * component so the two renderers don't drift and `LightMessageBody` stays
 * lean.
 */

import DownloadIcon from "@mui/icons-material/Download";
import { Box, IconButton, Modal, ModalDialog } from "@mui/joy";

import { useTranslation } from "../../i18n";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { downloadFile } from "../../utils/downloadUtils";
import { AppTooltip } from "../ui/AppTooltip";

export type ImageZoomModalProps = {
    /** Resolved (blob or public) src to show, or `null` when closed. */
    src: string | null;
    onClose: () => void;
};

export const ImageZoomModal = ({ src, onClose }: ImageZoomModalProps) => {
    const { t } = useTranslation();

    const handleDownload = async (
        url: string,
        filename = `chat-message-image-${getLocalCurrentTimestamp()}.png`
    ) => {
        await downloadFile(url, filename);
    };

    return (
        <Modal open={src !== null} sx={{ zIndex: 10010 }} onClose={onClose}>
            <ModalDialog>
                {src ? (
                    <Box>
                        <img
                            alt={t.common.editor.imagePreviewAlt}
                            src={src}
                            style={{
                                maxWidth: "80vw",
                                maxHeight: "80vh",
                                display: "block",
                            }}
                        />
                        <AppTooltip placement="top" size="sm" title={t.common.editor.download}>
                            <IconButton
                                color="neutral"
                                sx={{ position: "absolute", top: "10px", right: "10px" }}
                                variant="solid"
                                onClick={() => handleDownload(src)}
                            >
                                <DownloadIcon />
                            </IconButton>
                        </AppTooltip>
                    </Box>
                ) : null}
            </ModalDialog>
        </Modal>
    );
};
