import { ReactElement, ReactNode, useState } from "react";
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
    /**
     * Force the tooltip shut while another surface owns the user's
     * attention (an open menu, say) WITHOUT giving up normal hover
     * behaviour the rest of the time.
     *
     * Use this instead of `open={someCondition ? false : undefined}`.
     * That idiom flips the tooltip between controlled (`false`) and
     * uncontrolled (`undefined`) as the condition changes, which is
     * exactly what MUI warns about: "A component is changing the
     * uncontrolled open state of Tooltip to be controlled." Passing a
     * boolean here keeps `open` defined for the component's whole
     * lifetime, so control never switches.
     */
    suppressed?: boolean;
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
    suppressed,
    enterDelay,
    disableHoverListener,
}: AppTooltipProps) => {
    const { mode } = useColorScheme();
    const P = mode === "dark" ? purplePalette.dark : purplePalette.light;

    // Hover state is only tracked when the caller opted into
    // suppression; otherwise Joy manages its own and this stays unused.
    const [hoverOpen, setHoverOpen] = useState(false);

    // A caller passes `open` OR `suppressed` OR neither, and which one it
    // is doesn't change over a mount — so `resolvedOpen` is defined for
    // the whole lifetime in the first two cases and undefined in the
    // third. That stability is the entire point: see `suppressed`.
    const resolvedOpen =
        open !== undefined
            ? open
            : suppressed !== undefined
              ? !suppressed && hoverOpen
              : undefined;

    return (
        <Tooltip
            arrow={arrow}
            disableHoverListener={disableHoverListener}
            enterDelay={enterDelay}
            open={resolvedOpen}
            placement={placement}
            size={size}
            title={title}
            variant="outlined"
            sx={{
                background: P.menuBg,
                border: `1px solid ${P.menuBorder}`,
                borderRadius: "8px",
            }}
            onClose={() => setHoverOpen(false)}
            onOpen={() => setHoverOpen(true)}
        >
            {children}
        </Tooltip>
    );
};
