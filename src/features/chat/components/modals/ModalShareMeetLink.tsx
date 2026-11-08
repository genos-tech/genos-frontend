import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import { Box, Button, Typography } from "@mui/joy";

import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";

type Props = {
    open: boolean;
    link: string | null;
    onShare: () => void;
    onCancel: () => void;
};

export const ModalShareMeetLink = ({ open, link, onShare, onCancel }: Props) => {
    const { t } = useTranslation();

    return (
        <ModalFrame
            description={t.chat.modals.shareMeetLink.description}
            icon={<VideoCameraFrontRoundedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="sm"
            title={t.chat.modals.shareMeetLink.title}
            zIndex={10010}
            actions={
                <>
                    <Button color="neutral" variant="plain" onClick={onCancel}>
                        {t.chat.modals.shareMeetLink.cancel}
                    </Button>
                    <Button onClick={onShare}>{t.chat.modals.shareMeetLink.share}</Button>
                </>
            }
            onClose={onCancel}
        >
            {link && (
                <Box
                    sx={{
                        borderRadius: g.radius.md,
                        border: `1px solid ${g.border.default}`,
                        background: g.bg.subtle,
                        p: 1.25,
                        wordBreak: "break-all",
                    }}
                >
                    <Typography
                        level="body-sm"
                        sx={{ color: g.text.primary, fontFamily: g.font.mono }}
                    >
                        {link}
                    </Typography>
                </Box>
            )}
        </ModalFrame>
    );
};
