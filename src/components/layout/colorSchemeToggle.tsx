import * as React from "react";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeIcon from "@mui/icons-material/LightMode";
import IconButton, { IconButtonProps } from "@mui/joy/IconButton";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../i18n";
import { AppTooltip } from "../ui/AppTooltip";

export const ColorSchemeToggle = (props: IconButtonProps) => {
    const { onClick, sx, ...other } = props;
    const { mode, setMode } = useColorScheme();
    const { t } = useTranslation();
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);
    if (!mounted) {
        return (
            <IconButton color="neutral" size="sm" variant="outlined" {...other} sx={sx} disabled />
        );
    }
    return (
        <AppTooltip placement="right-start" size="sm" title={t.common.ui.colorScheme.switchTheme}>
            <IconButton
                color="neutral"
                data-screenshot="toggle-mode"
                size="sm"
                variant="outlined"
                {...other}
                sx={[
                    mode === "dark"
                        ? { "& > *:first-of-type": { display: "none" } }
                        : { "& > *:first-of-type": { display: "initial" } },
                    mode === "light"
                        ? { "& > *:last-of-type": { display: "none" } }
                        : { "& > *:last-of-type": { display: "initial" } },
                    ...(Array.isArray(sx) ? sx : [sx]),
                ]}
                onClick={(event) => {
                    if (mode === "light") {
                        setMode("dark");
                    } else {
                        setMode("light");
                    }
                    onClick?.(event);
                }}
            >
                <DarkModeRoundedIcon />
                <LightModeIcon />
            </IconButton>
        </AppTooltip>
    );
};
