import { ReactElement, ReactNode } from "react";
import { Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { purplePalette } from "../../theme/purplePalette";

type Placement =
    | "top"
    | "top-start"
    | "top-end"
    | "bottom"
    | "bottom-start"
    | "bottom-end"
    | "left"
    | "left-start"
    | "left-end"
    | "right"
    | "right-start"
    | "right-end";

export type AppTooltipProps = {
    /** Tooltip body. Must already be localized (i.e. read from `t.*`). */
    title: ReactNode;
    /** Single React element trigger — same constraint Joy's <Tooltip> has. */
    children: ReactElement;
    placement?: Placement;
    /** Default `true`. Most tooltips in this app point at the trigger. */
    arrow?: boolean;
    /** Joy's Tooltip size token. Default `"sm"`. */
    size?: "sm" | "md" | "lg";
    /** Forwarded to Joy. Default `false` — most tooltips are interactive-on-hover only. */
    open?: boolean;
    /** ms before the tooltip opens on hover. Forwarded to Joy. */
    enterDelay?: number;
    /** Skip the hover listener entirely (useful when `title` may be empty). */
    disableHoverListener?: boolean;
};

/**
 * Canonical tooltip for the app. Bakes in the design-system style so
 * every site uses the same purple-tinted, outlined chip. No `sx` escape
 * hatch on purpose: when a site needs a different look (danger color,
 * different padding, etc.) it should fall back to Joy's raw <Tooltip>
 * so the divergence is visible in grep.
 *
 * `title` MUST be already-localized text. Pass `t.foo.bar` from
 * `useTranslation()`, not a string literal.
 */
export const AppTooltip = ({
    title,
    children,
    placement = "top",
    arrow = true,
    size = "sm",
    open,
    enterDelay,
    disableHoverListener,
}: AppTooltipProps) => {
    const { mode } = useColorScheme();
    const P = mode === "dark" ? purplePalette.dark : purplePalette.light;

    return (
        <Tooltip
            arrow={arrow}
            disableHoverListener={disableHoverListener}
            enterDelay={enterDelay}
            open={open}
            placement={placement}
            size={size}
            title={title}
            variant="outlined"
            sx={{
                background: P.menuBg,
                border: `1px solid ${P.menuBorder}`,
                borderRadius: "8px",
            }}
        >
            {children}
        </Tooltip>
    );
};
