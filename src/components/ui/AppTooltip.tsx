import { ReactElement, ReactNode, useState } from "react";
import { Tooltip } from "@mui/joy";

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
    /**
     * Most tooltips in this app point at their trigger, so this defaults
     * to `true` — EXCEPT with `surface="none"`, where the wrapper has no
     * surface for the arrow to be an arrow of and drawing one puts a bare
     * untinted wedge under a card that paints itself. There it defaults to
     * whether you passed `arrowColor`, which is the only way anything here
     * can know what color the card's edge is.
     */
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
    /**
     * Cap the width so a long sentence wraps instead of spanning the
     * viewport. A real layout decision, which is why it is a prop and not
     * something to reach for `sx` over.
     */
    maxWidth?: number | "none";
    /**
     * `"chip"` (default) is the design-system surface. `"none"` is for a
     * hover CARD — a `title` that paints its own panel — where the
     * tooltip's own background would stack a second surface behind it.
     */
    surface?: "chip" | "none";
    /**
     * Point the arrow at a self-painted card's surface color. Only
     * meaningful with `surface="none"`, where nothing else can know it.
     */
    arrowColor?: string;
};

const LIGHT = purplePalette.light;
const DARK = purplePalette.dark;

/**
 * Canonical tooltip for the app. Bakes in the design-system style so every
 * site uses the same purple-tinted, outlined chip, and so "is this the app's
 * tooltip or the browser's" is answered by one grep.
 *
 * `title` MUST be already-localized text. Pass `t.foo.bar` from
 * `useTranslation()`, not a string literal.
 *
 * The light/dark split is a CSS ancestor selector rather than
 * `useColorScheme()`, which is not a style preference: that hook THROWS
 * without a `CssVarsProvider` above it, where Joy's own Tooltip renders
 * fine. So the design-system tooltip was the one component that could not
 * be used in a bare-rendered tree, and swapping it in broke component
 * tests that had every reason to expect a tooltip to be inert. Joy sets
 * `data-joy-color-scheme` on `<html>`, above the portal this renders into,
 * and the browser re-resolves it on repaint — see `App.css`, which leans on
 * the same attribute.
 */
export const AppTooltip = ({
    title,
    children,
    placement = "top",
    arrow,
    size = "sm",
    open,
    suppressed,
    enterDelay,
    disableHoverListener,
    maxWidth,
    surface = "chip",
    arrowColor,
}: AppTooltipProps) => {
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

    const painted = surface === "chip";
    const showArrow = arrow ?? (painted || arrowColor !== undefined);

    return (
        <Tooltip
            arrow={showArrow}
            disableHoverListener={disableHoverListener}
            enterDelay={enterDelay}
            open={resolvedOpen}
            placement={placement}
            size={size}
            title={title}
            variant={painted ? "outlined" : "plain"}
            sx={{
                ...(painted
                    ? {
                          background: LIGHT.menuBg,
                          border: `1px solid ${LIGHT.menuBorder}`,
                          borderRadius: "8px",
                          '[data-joy-color-scheme="dark"] &': {
                              background: DARK.menuBg,
                              border: `1px solid ${DARK.menuBorder}`,
                          },
                      }
                    : {
                          bgcolor: "transparent",
                          border: "none",
                          boxShadow: "none",
                          p: 0,
                          maxWidth: "none",
                      }),
                ...(maxWidth !== undefined ? { maxWidth } : {}),
                ...(arrowColor ? { "--Tooltip-arrowColor": arrowColor } : {}),
            }}
            onClose={() => setHoverOpen(false)}
            onOpen={() => setHoverOpen(true)}
        >
            {children}
        </Tooltip>
    );
};
