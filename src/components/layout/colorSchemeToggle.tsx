import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeIcon from "@mui/icons-material/LightMode";
import { Tooltip } from "@mui/joy";
import IconButton, { IconButtonProps } from "@mui/joy/IconButton";
import { useColorScheme } from "@mui/joy/styles";
import * as React from "react";

export const ColorSchemeToggle = (props: IconButtonProps) => {
    const { onClick, sx, ...other } = props;
    const { mode, setMode } = useColorScheme();
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
        <Tooltip placement="right-start" size="sm" title="Switch Theme" variant="outlined">
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
        </Tooltip>
    );
};
