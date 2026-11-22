import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import { Link, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../i18n";
import { g } from "../../theme/tokens";

/**
 * One quiet line (MIP-2022): a connected AI app has recorded nothing for `days` days, with a link
 * to the setup steps. A plain secondary-colour line, not an alert: no colour, no dismiss, no
 * toast and no email, because a quiet week is often just a quiet week.
 */
export const AgentQuietNotice = ({
    days,
    onCheck,
    testId = "agent-quiet-notice",
}: {
    days: number;
    onCheck: () => void;
    testId?: string;
}) => {
    const { t } = useTranslation();
    const ai = t.settings.connectedApps.connectAi;
    return (
        <Typography
            data-testid={testId}
            level="body-sm"
            startDecorator={<HelpOutlineRoundedIcon sx={{ fontSize: 18, mt: 0.125 }} />}
            sx={{ color: g.text.secondary, display: "flex", gap: 0.75, alignItems: "flex-start" }}
        >
            <span>
                {fmt(ai.quietLine, { days })}{" "}
                <Link component="button" type="button" onClick={onCheck}>
                    {ai.quietAction}
                </Link>
            </span>
        </Typography>
    );
};
