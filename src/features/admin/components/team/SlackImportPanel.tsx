import { useState } from "react";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import { Box, Button, FormControl, FormLabel, Typography } from "@mui/joy";

import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { ModalImportSlack } from "./ModalImportSlack";

interface Props {
    /** The team's owner, and only them. The panel renders nothing for anyone else. */
    isOwner: boolean;
    teamId: string;
    zIndex: number;
}

/** The "Import from Slack…" row of the team profile (MIP-1836). */
export const SlackImportPanel = ({ isOwner, teamId, zIndex }: Props) => {
    const { t } = useTranslation();
    const c = t.admin.slackImport;
    const [open, setOpen] = useState(false);
    if (!isOwner) return null;
    return (
        <>
            <FormControl sx={{ mt: 1 }}>
                <FormLabel
                    sx={{
                        color: g.text.secondary,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        mb: 0.5,
                    }}
                >
                    {c.title}
                </FormLabel>
                <Typography level="body-sm" sx={{ color: g.text.secondary, mb: 1 }}>
                    {c.panelDescription}
                </Typography>
                <Box>
                    <Button
                        color="neutral"
                        data-testid="slack-import-open"
                        size="sm"
                        startDecorator={<UploadFileRoundedIcon fontSize="small" />}
                        variant="outlined"
                        onClick={() => setOpen(true)}
                    >
                        {c.button}
                    </Button>
                </Box>
            </FormControl>
            <ModalImportSlack
                hostZIndex={zIndex}
                open={open}
                teamId={teamId}
                onClose={() => setOpen(false)}
            />
        </>
    );
};
