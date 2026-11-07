// Genos settings modal (the gear on the Spotlight bar, next to History).
//
// Opened from the gear icon so a user can switch the AI effort / model and
// toggle AI answers / web search without leaving Spotlight and hunting
// through the full app Settings modal. It reuses the exact same pieces the
// main SettingsModal renders on its "Genos" tab: `LlmModelSection` (the
// model / effort picker), `SpotlightSection` (AI answers + web search) and,
// through `GenosSettingsPanel`, the "What Genos remembers" sub-view. The
// two sections are self-contained; only the panel needs the team.
//
// z-index: the Spotlight overlay sits at 13100 and stays open behind
// this modal, so the dialog is pinned above it (13200). Joy's default
// Modal z-index (~1300) would otherwise render it *behind* Spotlight.

import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";

import { LlmModelSection, SpotlightSection } from "../../components/layout/SettingsModal";
import { ModalFrame } from "../../components/ui/modal/ModalFrame";
import { useTranslation } from "../../i18n";
import { g } from "../../theme/tokens";
import { GenosSettingsPanel } from "../genos/memory/GenosSettingsPanel";

interface Props {
    open: boolean;
    onClose: () => void;
    // The team the workspace is showing; "What Genos remembers" lists and
    // deletes within it.
    teamId: string;
}

// The frame writes the picker layer (13210) above this layer on the modal
// root, so the Select popups clear the dialog (they used to be pinned to 13300).
const SPOTLIGHT_SETTINGS_Z_INDEX = 13200;

export const SpotlightSettingsModal = ({ open, onClose, teamId }: Props) => {
    const { t } = useTranslation();
    return (
        <ModalFrame
            icon={<SettingsRoundedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="md"
            headerDivider
            onClose={onClose}
            title={t.spotlight.settings.title}
            // Above the Spotlight overlay (13100), which remains open behind us.
            zIndex={SPOTLIGHT_SETTINGS_Z_INDEX}
        >
            <GenosSettingsPanel teamId={teamId}>
                <LlmModelSection />
                <SpotlightSection />
            </GenosSettingsPanel>
        </ModalFrame>
    );
};
