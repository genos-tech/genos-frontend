import { Fragment } from "react";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import { Box, Dropdown, IconButton, MenuButton } from "@mui/joy";

import { useTranslation } from "../../i18n";
import { MenuDivider, MenuRow, MenuSurface } from "./menu/MenuParts";
import { menuTriggerSx } from "./menu/menuStyles";
import { MoreMenuKind, orderMoreMenuItems } from "./moreMenuOrder";

// The building blocks, so a menu with its own trigger (a chip, a status label)
// composes the same surface and rows. One import path for every menu (MIP-1128).
export {
    MenuDivider,
    MenuGroupLabel,
    MenuRow,
    MenuSurface,
    type MenuRowProps,
    type MenuSurfaceProps,
} from "./menu/MenuParts";

export type MoreMenuItem = {
    id: string;
    /** Which action this is, so every menu lists it in the same place
     *  (see `moreMenuOrder.ts`). `items` order does not decide position. */
    kind?: MoreMenuKind;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    /** Defaults to true. When false (or undefined-falsy), the item is hidden. */
    visible?: boolean;
    /** Renders the item with the red palette and a divider above it. */
    danger?: boolean;
    /** Highlights the item with the accent color and adds the right-edge dot. */
    active?: boolean;
    /** Shown but not clickable. */
    disabled?: boolean;
    /** A rule above the item (a danger item always gets one), to set a group of
     *  actions apart. Ignored on the first visible item. */
    divider?: boolean;
};

export type MoreMenuProps = {
    items: MoreMenuItem[];
    /** Aligns the menu's right edge to the trigger when "bottom-end". Default: "bottom-start". */
    placement?: "bottom-start" | "bottom-end";
    /** Width/height of the trigger button in px. Default: 28. */
    triggerSize?: number;
    /** Extra sx merged onto the trigger IconButton (after the shared trigger style). */
    triggerSx?: Record<string, any>;
    /** Default: 200. */
    menuMinWidth?: number;
    ariaLabel?: string;
    /** Trigger icon font size. Default: 18. */
    iconFontSize?: number;
    /** Notified when the menu opens (`true`) or closes (`false`). */
    onOpenChange?: (open: boolean) => void;
    /** Stacking level of the dropdown portal. The default (page layer, or the
     *  host's z + 1 inside a modal-hosted note or the task diagram) is fine on
     *  those surfaces, but a menu triggered from inside another higher layer
     *  (e.g. the UrlLinkModal at 10020) must pass its host's z + 1 or the
     *  dropdown opens invisibly BEHIND the host. */
    zIndex?: number;
};

export const MoreMenu = ({
    items,
    placement = "bottom-start",
    triggerSize = 28,
    triggerSx,
    menuMinWidth = 200,
    ariaLabel,
    iconFontSize = 18,
    onOpenChange,
    zIndex,
}: MoreMenuProps) => {
    const { t } = useTranslation();
    const resolvedAriaLabel = ariaLabel ?? t.common.ui.moreMenu.ariaLabel;
    const visibleItems = orderMoreMenuItems(items);

    return (
        <Box sx={{ position: "relative" }}>
            <Dropdown onOpenChange={(_event, open) => onOpenChange?.(open)}>
                <MenuButton
                    slots={{ root: IconButton }}
                    slotProps={{
                        root: {
                            "aria-label": resolvedAriaLabel,
                            size: "sm",
                            variant: "plain",
                            color: "neutral",
                            sx: {
                                width: triggerSize,
                                height: triggerSize,
                                minWidth: triggerSize,
                                minHeight: triggerSize,
                                ...menuTriggerSx,
                                ...(triggerSx ?? {}),
                            },
                        },
                    }}
                    // The trigger usually sits inside a clickable row.
                    onClick={(event) => event.stopPropagation()}
                >
                    <MoreHorizRoundedIcon sx={{ fontSize: iconFontSize }} />
                </MenuButton>
                <MenuSurface placement={placement} sx={{ minWidth: menuMinWidth }} zIndex={zIndex}>
                    {visibleItems.map((item, index) => (
                        <Fragment key={item.id}>
                            {(item.danger || item.divider) && index > 0 && <MenuDivider />}
                            <MenuRow
                                danger={item.danger}
                                disabled={item.disabled}
                                icon={item.icon}
                                mark="dot"
                                selected={item.active}
                                onClick={item.onClick}
                            >
                                {item.label}
                            </MenuRow>
                        </Fragment>
                    ))}
                </MenuSurface>
            </Dropdown>
        </Box>
    );
};
