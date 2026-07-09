// Spotlight-scoped settings modal.
//
// Opened from the gear icon on the Spotlight bar (next to History) so a
// user can switch LLM model (Gemini / Claude) and toggle AI answers /
// web search without leaving Spotlight and hunting through the full
// app Settings modal. It reuses the exact same section components the
// main SettingsModal renders on its "Spotlight" tab — `LlmModelSection`
// (the must-have model picker) and `SpotlightSection` (AI answers + web
// search) — both self-contained, so there are no props to thread.
//
// z-index: the Spotlight overlay sits at 13100 and stays open behind
// this modal, so the dialog is pinned above it (13200). Joy's default
// Modal z-index (~1300) would otherwise render it *behind* Spotlight.

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { Box, Divider, IconButton, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { LlmModelSection, SpotlightSection } from "../../components/layout/SettingsModal";
import { useTranslation } from "../../i18n";

interface Props {
    open: boolean;
    onClose: () => void;
}

export const SpotlightSettingsModal = ({ open, onClose }: Props) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    return (
        <Modal
            open={open}
            sx={{
                // Above the Spotlight overlay (13100), which remains open
                // behind us.
                zIndex: 13200,
                // Joy pins the Select/Autocomplete listbox popup z-index to
                // `calc(theme.zIndex.modal + 1)` (≈1301) via a
                // `--unstable_popup-zIndex` CSS var it stamps on the modal
                // root AND on sibling portaled `[role="listbox"]` nodes — it
                // does NOT track this `sx` z-index override. Left as-is the
                // model-picker dropdowns would open at 1301, *behind* this
                // 13200 dialog and be unclickable. Re-stamp the same var in
                // both scopes above the dialog so the popups win.
                "--unstable_popup-zIndex": 13300,
                '& ~ [role="listbox"]': { "--unstable_popup-zIndex": 13300 },
            }}
            onClose={onClose}
        >
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                size="md"
                sx={{
                    width: { xs: "92vw", sm: 480 },
                    maxHeight: "85vh",
                    overflowY: "auto",
                    overflowX: "hidden",
                    borderRadius: "xl",
                    p: 2.5,
                }}
            >
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                    <SettingsRoundedIcon />
                    <Typography level="title-lg">{t.spotlight.settings.title}</Typography>
                    <Box sx={{ flex: 1 }} />
                    <IconButton variant="plain" onClick={onClose}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                    <LlmModelSection />
                    <SpotlightSection />
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
