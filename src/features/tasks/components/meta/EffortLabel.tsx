import { Box } from "@mui/joy";

import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { effortLevels, taskMetaLabel } from "../../utils/taskMeta";

/** Effort as a tinted chip in the level's own color (the same colors the task preview
 *  uses): a faint wash, a hairline and a dot of that color, the word in the neutral
 *  text color so it stays readable on every theme. Not a solid fill (MIP-1175). */
export const EffortLabel = ({ level }: { level: string }) => {
    const { t } = useTranslation();
    const tone = effortLevels.find((e) => e.level === level)?.color;
    return (
        <Box
            component="span"
            data-effort-level={level}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                maxWidth: "100%",
                height: 22,
                px: "8px",
                borderRadius: g.radius.sm,
                boxSizing: "border-box",
                fontSize: "var(--g-type-body-sm-size)",
                color: g.text.primary,
                whiteSpace: "nowrap",
                background: tone ? `color-mix(in srgb, ${tone} 16%, transparent)` : "transparent",
                boxShadow: tone
                    ? `inset 0 0 0 1px color-mix(in srgb, ${tone} 38%, transparent)`
                    : "none",
            }}
        >
            {tone && (
                <Box
                    component="span"
                    sx={{
                        width: 8,
                        height: 8,
                        flexShrink: 0,
                        borderRadius: "50%",
                        background: tone,
                    }}
                    aria-hidden
                />
            )}
            <Box
                component="span"
                sx={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
            >
                {taskMetaLabel(level, t.tasks.filters) || level}
            </Box>
        </Box>
    );
};
