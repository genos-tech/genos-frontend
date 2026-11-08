import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import { Typography } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

import { useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { ModalFrame } from "../../ui/modal/ModalFrame";
import { SchedulesSection } from "./SchedulesSection";

type Props = {
    open: boolean;
    onClose: () => void;
    /** The team on screen; the schedules are listed and edited within it. */
    teamId: string | null | undefined;
};

/**
 * The schedules, outside Settings (MIP-1200): the Genos page opens the SAME
 * `SchedulesSection` that Settings > Schedules renders, in the project's dialog
 * frame, so a member who is looking at Genos does not have to find the setting.
 *
 * Layer: Joy's own modal layer, like the Settings dialog. The section raises Select
 * popups (the report, the days) that Joy pins just above that layer; a higher dialog
 * would hide them behind itself.
 */
export const SchedulesModal = ({ open, onClose, teamId }: Props) => {
    const { t } = useTranslation();
    const theme = useTheme();
    return (
        <ModalFrame
            clearBottomBar
            icon={<EventRepeatRoundedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="lg"
            title={t.settings.schedules.title}
            zIndex={theme.zIndex.modal}
            headerDivider
            onClose={onClose}
        >
            {teamId ? (
                <SchedulesSection showHeading={false} teamId={teamId} onNavigateAway={onClose} />
            ) : (
                // The team has not resolved yet: say so rather than open an empty dialog.
                <Typography level="body-sm" role="status" sx={{ color: g.text.secondary }}>
                    {t.settings.schedules.loading}
                </Typography>
            )}
        </ModalFrame>
    );
};
