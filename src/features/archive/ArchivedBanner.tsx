import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import { Box, Button, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";
import { g, type } from "../../theme/tokens";

type Props = {
    /** What is archived: its banner names a project or a group chat. */
    kind: "project" | "chat";
    /** A project's chat: the title says the project's chat, not "this group" (kind "chat" only). */
    projectChat?: boolean;
    /** Set for the owner only: the banner then offers Unarchive. A member gets the reason alone. */
    onRestore?: () => void;
    /** The restore is in flight: the button shows it and cannot be pressed twice. */
    busy?: boolean;
};

/**
 * The read-only notice in an archived project or group chat (MIP-1693). It says what is
 * archived, that nothing was removed, and why the write controls are off. It is a polite status,
 * so a screen reader hears it when the item opens.
 */
export const ArchivedBanner = ({ kind, projectChat = false, onRestore, busy = false }: Props) => {
    const { t } = useTranslation();
    const copy = t.common.archive;
    const isProject = kind === "project";

    return (
        <Box
            role="status"
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                flexWrap: "wrap",
                px: 1.5,
                py: 1,
                mx: 1,
                mt: 1,
                borderRadius: g.radius.md,
                background: g.warning.subtle,
                border: `1px solid ${g.warning.border}`,
            }}
        >
            <ArchiveOutlinedIcon sx={{ fontSize: 18, color: g.warning.text }} aria-hidden />
            <Box sx={{ flex: 1, minWidth: 180 }}>
                <Typography level="body-sm" sx={{ color: g.text.primary, fontWeight: 600 }}>
                    {isProject
                        ? copy.projectBannerTitle
                        : projectChat
                          ? copy.chatBannerProjectTitle
                          : copy.chatBannerTitle}
                </Typography>
                <Typography level="body-xs" sx={{ ...type("body-xs"), color: g.text.secondary }}>
                    {isProject ? copy.projectBannerBody : copy.chatBannerBody}
                </Typography>
            </Box>
            {onRestore && (
                <Button
                    loading={busy}
                    size="sm"
                    sx={{ borderRadius: g.radius.sm }}
                    variant="outlined"
                    onClick={onRestore}
                >
                    {copy.unarchiveAction}
                </Button>
            )}
        </Box>
    );
};
