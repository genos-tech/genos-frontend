import { ComponentType } from "react";
import DensityLargeRoundedIcon from "@mui/icons-material/DensityLargeRounded";
import DensityMediumRoundedIcon from "@mui/icons-material/DensityMediumRounded";
import DensitySmallRoundedIcon from "@mui/icons-material/DensitySmallRounded";
import { Box, Divider, Option, Select, Stack, Typography } from "@mui/joy";

import { useDensityPreference } from "../../hooks/common/densityContext";
import { useTranslation } from "../../i18n";
import { Density, isDensity } from "../../theme/density";
import { SettingRow } from "../ui/settings/SettingRow";

/**
 * Settings -> General -> Appearance -> Density (MIP-1119): the row height of
 * lists and tables. Applies instantly (`data-density` on `<html>`) and syncs
 * across devices; see `useDensityPreference`.
 *
 * Renders its own divider so `AppearanceSection` only mounts one element.
 */

const ICONS: Record<Density, ComponentType<{ sx?: object }>> = {
    compact: DensitySmallRoundedIcon,
    default: DensityMediumRoundedIcon,
    comfortable: DensityLargeRoundedIcon,
};

export const DensitySetting = () => {
    const { density, setDensity } = useDensityPreference();
    const { t } = useTranslation();
    const a = t.settings.appearance;
    const labels: Record<Density, string> = {
        compact: a.densityCompact,
        default: a.densityDefault,
        comfortable: a.densityComfortable,
    };

    return (
        <>
            <Divider sx={{ my: 1.5 }} />
            <SettingRow
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                spacing={2}
            >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography id="density-setting-label" level="title-sm">
                        {a.densityLabel}
                    </Typography>
                    <Typography level="body-xs">{a.densityHelper}</Typography>
                </Box>
                <Select
                    data-testid="density-select"
                    size="sm"
                    slotProps={{ button: { "aria-labelledby": "density-setting-label" } }}
                    sx={{ minWidth: 140 }}
                    value={density}
                    onChange={(_e, value) => {
                        if (isDensity(value)) setDensity(value);
                    }}
                >
                    {(Object.keys(labels) as Density[]).map((d) => {
                        const Icon = ICONS[d];
                        return (
                            <Option key={d} value={d}>
                                <Stack alignItems="center" direction="row" spacing={1}>
                                    <Icon sx={{ fontSize: 18 }} />
                                    <Typography level="body-sm">{labels[d]}</Typography>
                                </Stack>
                            </Option>
                        );
                    })}
                </Select>
            </SettingRow>
        </>
    );
};
