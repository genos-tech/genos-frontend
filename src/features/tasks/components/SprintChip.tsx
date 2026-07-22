import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { Chip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../i18n";

type SprintChipProps = {
    /** Resolved sprint name, or null/undefined when the row/milestone has
     *  no sprint — in which case a muted "No Sprint" is shown. */
    name: string | null | undefined;
};

/**
 * Compact, read-only sprint indicator. Shows the sprint name, or a muted
 * "No Sprint" when there's none. Shared by the dashboard's "Up Next" and
 * "Top by Weight" task rows and the "Assigned Milestones" card so the sprint
 * pill reads the same everywhere.
 */
export const SprintChip = ({ name }: SprintChipProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const has = !!(name && name.trim());
    return (
        <Chip
            size="sm"
            startDecorator={<BoltRoundedIcon sx={{ fontSize: 11 }} />}
            variant="outlined"
            sx={{
                fontSize: "0.6rem",
                fontWeight: 600,
                borderRadius: "6px",
                maxWidth: 130,
                flexShrink: 0,
                color: has
                    ? isDark
                        ? "rgba(255,255,255,0.75)"
                        : "rgba(0,0,0,0.7)"
                    : isDark
                      ? "rgba(255,255,255,0.4)"
                      : "rgba(0,0,0,0.4)",
                borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)",
            }}
        >
            {has ? name : t.tasks.fields.noSprint}
        </Chip>
    );
};
