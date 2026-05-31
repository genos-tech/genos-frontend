import { useTheme } from "@mui/joy/styles";
import { useMediaQuery } from "@mui/material";

// True when the viewport is narrower than MUI Joy's `md` breakpoint (900px).
// Single source of truth for "mobile vs desktop" layout decisions across the app.
export const useIsMobile = (): boolean => {
    const theme = useTheme();
    return useMediaQuery(theme.breakpoints.down("md"));
};
