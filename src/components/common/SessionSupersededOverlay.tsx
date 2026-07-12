import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import { Box, Button, Sheet, Stack, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../i18n";

interface SessionSupersededOverlayProps {
    // The team that took over the browser session in another tab, or null
    // while this tab is still the active session.
    teamName: string | null;
}

// Full-screen blocking overlay shown when another browser tab signs in to
// a different team/user. The browser holds a single session (one refresh
// cookie), so this tab is now orphaned — we freeze it and ask the user to
// reload, which reboots cleanly onto the winning team with no cross-team
// data mixing. Rendered near the App root so it sits above every route
// and modal; returns null in the normal (non-superseded) case.
export const SessionSupersededOverlay = ({ teamName }: SessionSupersededOverlayProps) => {
    const { t } = useTranslation();
    if (teamName === null) return null;

    const displayTeam = teamName || t.common.sessionSuperseded.fallbackTeam;

    return (
        <Box
            sx={{
                position: "fixed",
                inset: 0,
                // Above every in-app layer (the highest app overlays sit
                // in the 13000s; UrlLinkModal citation previews at 13200).
                zIndex: 20000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 2,
                backdropFilter: "blur(4px)",
                backgroundColor: "rgba(0, 0, 0, 0.55)",
            }}
        >
            <Sheet
                variant="outlined"
                sx={{
                    maxWidth: 440,
                    width: "100%",
                    borderRadius: "16px",
                    p: 3,
                    boxShadow: "lg",
                }}
            >
                <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "primary.softBg",
                            color: "primary.plainColor",
                        }}
                    >
                        <SwapHorizRoundedIcon />
                    </Box>
                    <Typography level="title-lg">{t.common.sessionSuperseded.title}</Typography>
                    <Typography level="body-md" sx={{ color: "text.secondary" }}>
                        {fmt(t.common.sessionSuperseded.body, { team: displayTeam })}
                    </Typography>
                    <Button
                        fullWidth
                        size="lg"
                        startDecorator={<RefreshRoundedIcon />}
                        onClick={() => window.location.reload()}
                    >
                        {t.common.sessionSuperseded.reload}
                    </Button>
                </Stack>
            </Sheet>
        </Box>
    );
};
