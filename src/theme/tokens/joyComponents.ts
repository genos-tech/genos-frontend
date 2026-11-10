/**
 * Joy component defaults from the design tokens (MIP-1118).
 *
 * Deliberately small. `styleOverrides` merge BEFORE a call site's `sx`, so
 * everything hand-styled today keeps winning and nothing here can undo a
 * look someone chose; these only change what an unstyled component does.
 * Geometry (heights, padding, radius) is NOT touched: Joy's sizes already
 * match the control scale (sm 32 = control-md, md 36 = control-lg), and the
 * density setting (MIP-1119) will drive them through the same variables.
 *
 * What this does:
 *  - The one gradient left in the app: a PRIMARY SOLID Button. Disabled
 *    keeps Joy's flat disabled look (its `&.Mui-disabled` rule is more
 *    specific than the plain `background` here).
 *  - Buttons move only the properties that change (never `transition: all`),
 *    with the shared durations and curve, off under reduced motion.
 *  - `touch-action: manipulation` on buttons: no double-tap zoom delay.
 *  - Select / Autocomplete listboxes and Joy menus are lifted above the toast and banner
 *    regions (MIP-1393), the way `MenuSurface` is (MIP-1327).
 */

import { POPUP_Z_INDEX_CSS } from "../../components/ui/feedback/toastLayers";

const transition = {
    transitionProperty: "background-color, border-color, color, box-shadow, opacity",
    transitionDuration: "var(--g-motion-fast)",
    transitionTimingFunction: "var(--g-ease)",
    touchAction: "manipulation",
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
} as const;

type OwnerState = { variant?: string; color?: string };

const ENABLED = "&:not(.Mui-disabled):not(.MuiButton-loading)";

export const joyComponents = {
    JoyButton: {
        styleOverrides: {
            root: ({ ownerState }: { ownerState: OwnerState }) => ({
                ...transition,
                ...(ownerState.variant === "solid" &&
                    ownerState.color === "primary" && {
                        background: "var(--g-brand-gradient)",
                        // Enabled only: a disabled or loading button must not
                        // light up on hover (the `&.Mui-disabled` rule is as
                        // specific as `:hover`, and this one is emitted later).
                        [`${ENABLED}:hover, ${ENABLED}:active`]: {
                            background: "var(--g-brand-gradient-hover)",
                        },
                    }),
            }),
        },
    },
    JoyIconButton: {
        styleOverrides: {
            root: transition,
        },
    },
    // A popup opened under the phone header starts where the persistent top banner is.
    JoySelect: { styleOverrides: { listbox: { zIndex: POPUP_Z_INDEX_CSS } } },
    JoyAutocomplete: { styleOverrides: { listbox: { zIndex: POPUP_Z_INDEX_CSS } } },
    JoyMenu: { styleOverrides: { root: { zIndex: POPUP_Z_INDEX_CSS } } },
};
