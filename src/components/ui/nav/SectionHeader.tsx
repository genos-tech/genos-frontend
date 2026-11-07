import { ReactNode, Ref, SyntheticEvent } from "react";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import { Box, ListItem, ListItemButton } from "@mui/joy";
import type { ListItemButtonProps } from "@mui/joy/ListItemButton";
import type { SxProps } from "@mui/joy/styles/types";

import { g, type } from "../../../theme/tokens";
import { NAV_HOVER_MEDIA, NAV_ICON_SIZE, NAV_PAD_X, navFocusSx } from "./navStyles";

/**
 * The heading of a sidebar section (MIP-1127): "Projects", "Favorites",
 * "Pinned", a milestone folder, a project's recents.
 *
 * A heading is smaller and quieter than a row (`control.sm`, caption-weight
 * secondary text) so rows stay the loudest thing in a list. It does not
 * follow the density setting: density is about the rows you scan and click.
 *
 * Collapsible when it gets `expanded`: the whole heading is the toggle, the
 * chevron leads, and `aria-expanded` says which. `actions` (a filter menu, a
 * "+") sit beside it, never inside it: a button inside a button is invalid.
 * Plain when `expanded` is undefined: just a label (the chat dividers). A plain
 * header is not interactive, so `onClick`, `aria-*` and the other button props
 * apply only to a collapsible one.
 */
export type SectionHeaderProps = {
    label: ReactNode;
    icon?: ReactNode;
    /** Trailing count, quiet and tabular. */
    count?: ReactNode;
    /** `true` is open. Leave undefined for a heading that does not collapse. */
    expanded?: boolean;
    /** Toggle handler for a collapsible heading. */
    onToggleExpanded?: (event: SyntheticEvent) => void;
    /** Beside the heading, always visible (a filter, a "+"). */
    actions?: ReactNode;
    as?: "li" | "div";
    sx?: SxProps;
    rootProps?: Record<string, unknown>;
    ref?: Ref<HTMLElement>;
} & Omit<
    ListItemButtonProps,
    "children" | "sx" | "ref" | "color" | "variant" | "onToggleExpanded"
>;

export const SectionHeader = ({
    label,
    icon,
    count,
    expanded,
    onToggleExpanded,
    actions,
    as = "li",
    sx,
    rootProps,
    ref,
    onClick,
    ...buttonProps
}: SectionHeaderProps) => {
    const collapsible = expanded !== undefined;
    const hasActions = actions !== undefined && actions !== null && actions !== false;

    const content = (
        <>
            {collapsible && (
                <Box
                    className="SectionHeader-chevron"
                    sx={{
                        display: "inline-flex",
                        flexShrink: 0,
                        color: g.text.tertiary,
                        "& svg": {
                            fontSize: NAV_ICON_SIZE,
                            color: "inherit",
                            transition: `transform ${g.motion.base} ${g.ease}`,
                            transform: expanded ? "rotate(90deg)" : "none",
                        },
                        "[dir='rtl'] & svg": {
                            transform: expanded ? "rotate(90deg)" : "scaleX(-1)",
                        },
                    }}
                    aria-hidden
                >
                    <ChevronRightRounded />
                </Box>
            )}
            {icon !== undefined && icon !== null && (
                <Box
                    className="SectionHeader-icon"
                    sx={{
                        display: "inline-flex",
                        flexShrink: 0,
                        "& > svg": { fontSize: NAV_ICON_SIZE },
                    }}
                >
                    {icon}
                </Box>
            )}
            <Box
                className="SectionHeader-label"
                sx={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {label}
            </Box>
            {count !== undefined && count !== null && (
                <Box
                    component="span"
                    sx={{
                        ...type("caption"),
                        flexShrink: 0,
                        color: g.text.tertiary,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {count}
                </Box>
            )}
        </>
    );

    const look = {
        ...type("title-sm"),
        fontWeight: 600,
        color: g.text.secondary,
        "--Icon-color": g.text.secondary,
    };

    return (
        <ListItem
            ref={ref as Ref<HTMLLIElement>}
            component={as}
            sx={
                [
                    {
                        p: 0,
                        m: 0,
                        minWidth: 0,
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        height: g.control.sm,
                        borderRadius: g.radius.sm,
                        ...look,
                        ...(collapsible && {
                            transition: `background-color ${g.motion.fast} ${g.ease}`,
                            [NAV_HOVER_MEDIA]: {
                                "&:hover": { background: g.hover, color: g.text.primary },
                            },
                        }),
                    },
                    ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
                ] as SxProps
            }
            {...rootProps}
        >
            {collapsible ? (
                <ListItemButton
                    aria-expanded={expanded}
                    color="neutral"
                    variant="plain"
                    {...buttonProps}
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        alignSelf: "stretch",
                        minHeight: 0,
                        m: 0,
                        paddingBlock: 0,
                        paddingInline: `${NAV_PAD_X}px ${hasActions ? 0 : NAV_PAD_X}px`,
                        gap: 0.75,
                        borderRadius: "inherit",
                        background: "transparent",
                        color: "inherit",
                        font: "inherit",
                        letterSpacing: "inherit",
                        textAlign: "start",
                        // Joy paints its own hover/active plate on the button with a
                        // selector that out-ranks ours; its variables are read first,
                        // so the row box (which carries the look) is the only plate.
                        "--variant-plainHoverBg": "transparent",
                        "--variant-plainActiveBg": "transparent",
                        "--variant-plainHoverColor": "inherit",
                        "&:hover, &:active": { background: "transparent", color: "inherit" },
                        ...navFocusSx,
                    }}
                    onClick={(event) => {
                        onClick?.(event);
                        onToggleExpanded?.(event);
                    }}
                >
                    {content}
                </ListItemButton>
            ) : (
                <Box
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        paddingInline: `${NAV_PAD_X}px`,
                    }}
                >
                    {content}
                </Box>
            )}
            {hasActions && (
                <Box
                    className="SectionHeader-actions"
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        flexShrink: 0,
                        gap: 0.25,
                        paddingInlineEnd: 0.5,
                    }}
                >
                    {actions}
                </Box>
            )}
        </ListItem>
    );
};
