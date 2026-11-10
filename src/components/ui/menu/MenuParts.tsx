/**
 * The pieces every menu is built from (MIP-1128). `MoreMenu` is the "..."
 * button + items-array form; anything with its own trigger (a chip, a status
 * label, a header button) composes these inside a Joy `Dropdown` and gets the
 * same surface, rows, danger styling, dividers, keyboard handling and layer.
 *
 *     <Dropdown>
 *         <MenuButton>...</MenuButton>
 *         <MenuSurface placement="bottom-end">
 *             <MenuRow icon={<EditIcon />} onClick={rename}>Rename</MenuRow>
 *             <MenuDivider />
 *             <MenuRow danger icon={<DeleteIcon />} onClick={remove}>Delete</MenuRow>
 *         </MenuSurface>
 *     </Dropdown>
 *
 * Joy's `Menu` already does the keyboard work (Arrow keys, Home / End,
 * typeahead, Escape closing the menu and returning focus to the trigger); these
 * parts keep it and put the shared look on top.
 */

import { forwardRef, type ReactNode } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import {
    Box,
    ListDivider,
    ListItem,
    Menu,
    MenuItem,
    type MenuItemProps,
    type MenuProps,
} from "@mui/joy";

import { useDiagramZIndex } from "../../../features/tasks/diagram/diagramZIndex";
import { g } from "../../../theme/tokens";
import { useNoteModalHostZIndex } from "../../modals/noteModalHostZIndex";
import {
    MENU_POPPER_MODIFIERS,
    menuDividerSx,
    menuGroupLabelSx,
    menuRowSx,
    menuSurfaceSx,
} from "./menuStyles";

export type MenuSurfaceProps = Omit<MenuProps, "size" | "color" | "variant"> & {
    /** Exact layer. Default: the host's z + 1 when a modal-hosted note or the task
     *  diagram provides one, else the page layer. A menu opened from a
     *  UrlLinkModal-hosted surface passes `hostZIndex + 1` (the modal sits at 10020+;
     *  a Joy `Menu` has `role="menu"`, so the modal's listbox re-stamp never lifts it). */
    zIndex?: number;
};

const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

/**
 * The dropdown surface. Portals bubble through the REACT tree, so a click, key
 * or press inside the menu would otherwise reach the row, modal or canvas that
 * renders it (an item click opening the row, Enter re-triggering the row's
 * handler, Escape closing the dialog the menu sits in). All of them stop here;
 * Joy's own handlers sit on the same node and still run (genos-ui rule 4).
 */
export const MenuSurface = forwardRef<HTMLDivElement, MenuSurfaceProps>(function MenuSurface(
    { zIndex, sx, modifiers, onClick, onKeyDown, onPointerDown, onMouseDown, ...rest },
    ref
) {
    const noteHostZ = useNoteModalHostZIndex();
    const diagramZ = useDiagramZIndex();
    // The diagram context defaults to the page layer (9999), so +1 is only a
    // real lift when a host provided something higher.
    const layer = zIndex ?? (noteHostZ ?? diagramZ) + 1;
    return (
        <Menu
            {...rest}
            ref={ref}
            modifiers={modifiers ?? MENU_POPPER_MODIFIERS}
            size="sm"
            sx={[menuSurfaceSx, { zIndex: layer }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
            onClick={(event) => {
                stop(event);
                onClick?.(event);
            }}
            onKeyDown={(event) => {
                stop(event);
                onKeyDown?.(event);
            }}
            onMouseDown={(event) => {
                stop(event);
                onMouseDown?.(event);
            }}
            onPointerDown={(event) => {
                stop(event);
                onPointerDown?.(event);
            }}
        />
    );
});

export type MenuRowProps = Omit<MenuItemProps, "color" | "variant"> & {
    /** Leading icon, drawn at 16px in the row's color. */
    icon?: ReactNode;
    /** Red text, red hover. The item for a destructive action. */
    danger?: boolean;
    /** Accent text and hover for an action that should stand out ("Clear filter").
     *  Use this, not `sx.color`: Joy's hover color would win over `sx`. */
    accent?: boolean;
    /** What marks `selected`: a check (a choice among several, the default), a dot
     *  (an item that is switched on) or nothing (the row draws its own mark). */
    mark?: "check" | "dot" | "none";
    /** Content at the end of the row, after the selected mark. */
    trailing?: ReactNode;
    /** Joy closes a menu when an item is clicked. A multi-select picker sets this
     *  to stay open while the user ticks several values. */
    keepOpen?: boolean;
};

const SelectedMark = ({ mark }: { mark: "check" | "dot" }) =>
    mark === "dot" ? (
        <Box
            component="span"
            sx={{
                width: 6,
                height: 6,
                borderRadius: g.radius.full,
                background: g.accent.solid,
                flexShrink: 0,
            }}
            aria-hidden
        />
    ) : (
        <CheckRoundedIcon sx={{ fontSize: 16, flexShrink: 0 }} aria-hidden />
    );

export const MenuRow = forwardRef<HTMLDivElement, MenuRowProps>(function MenuRow(
    {
        icon,
        danger = false,
        accent = false,
        mark = "check",
        trailing,
        keepOpen,
        selected,
        sx,
        onClick,
        children,
        ...rest
    },
    ref
) {
    return (
        <MenuItem
            {...rest}
            ref={ref}
            selected={selected}
            sx={[
                menuRowSx(danger ? "danger" : accent ? "accent" : "default"),
                ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
            ]}
            onClick={(event) => {
                if (keepOpen) {
                    // `useMenuItem` checks this flag before it dispatches its close.
                    (event as unknown as { defaultMuiPrevented?: boolean }).defaultMuiPrevented =
                        true;
                }
                onClick?.(event);
            }}
        >
            {icon != null && (
                <Box
                    component="span"
                    sx={{
                        display: "inline-flex",
                        flexShrink: 0,
                        "& > svg.MuiSvgIcon-root": { fontSize: 16 },
                    }}
                    aria-hidden
                >
                    {icon}
                </Box>
            )}
            {children}
            {((selected && mark !== "none") || trailing != null) && (
                <Box
                    component="span"
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        // Pushes the mark to the row's end in either direction.
                        marginInlineStart: "auto",
                        paddingInlineStart: "8px",
                    }}
                >
                    {trailing}
                    {selected && mark !== "none" && <SelectedMark mark={mark} />}
                </Box>
            )}
        </MenuItem>
    );
});

/** A rule between groups of rows. */
export const MenuDivider = () => <ListDivider sx={menuDividerSx} />;

/** A small heading over a group of rows. Not focusable: arrow keys skip it. */
export const MenuGroupLabel = ({ children }: { children: ReactNode }) => (
    <ListItem role="presentation" sx={menuGroupLabelSx}>
        {children}
    </ListItem>
);
