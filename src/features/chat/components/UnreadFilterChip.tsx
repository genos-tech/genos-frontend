import { Chip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { chipHitAreaSx } from "../../../components/ui/touchTargets";
import { useTranslation } from "../../../i18n";

type UnreadFilterChipProps = {
    active: boolean;
    onToggle: () => void;
    "data-testid"?: string;
};

/** The "Unread" filter toggle: the chat list's header chip, shared with the Inbox (MIP-2597). */
export const UnreadFilterChip = ({
    active,
    onToggle,
    "data-testid": testId,
}: UnreadFilterChipProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    return (
        <Chip
            color={active ? "primary" : "neutral"}
            data-testid={testId}
            size="sm"
            slotProps={{ action: { "aria-pressed": active } }}
            variant={active ? "solid" : "soft"}
            sx={{
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.7rem",
                px: 1,
                height: 26,
                // A 44px tap band around the 26px chip (MIP-1319).
                ...chipHitAreaSx(26),
                borderRadius: "8px",
                transition: "all 0.2s ease",
                background: active
                    ? isDark
                        ? "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brand-800) 100%)"
                        : "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brand-800) 100%)"
                    : isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.04)",
                border: "1px solid",
                borderColor: active
                    ? "transparent"
                    : isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.06)",
                "&:hover": {
                    background: active
                        ? isDark
                            ? "linear-gradient(135deg, var(--gp-brandalt-400) 0%, var(--gp-brand-400) 100%)"
                            : "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brand-800) 100%)"
                        : isDark
                          ? "rgba(255,255,255,0.1)"
                          : "rgba(0,0,0,0.06)",
                },
            }}
            onClick={onToggle}
        >
            {t.chat.sidebar.unreadFilter}
        </Chip>
    );
};
