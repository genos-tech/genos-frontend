import { g } from "../../../theme/tokens";
import { NAV_HOVER_MEDIA } from "../nav/navStyles";

/**
 * The quiet hover and keyboard-focus plate of a row in a Settings panel
 * (MIP-1458, part of MIP-1106). Same recipe as the sidebar rows in
 * `nav/navStyles.ts`, minus what a settings row must not have:
 *
 *  - the plate is the `hover` role, a background colour only. No movement, no scale, and
 *    the text does not change colour (a row holds two lines of text and a control);
 *  - it fades in over the `fast` motion step on the shared curve, and
 *    `prefers-reduced-motion: reduce` makes it instant;
 *  - the pointer plate needs a real pointer (`NAV_HOVER_MEDIA`): a sticky `:hover` on a phone
 *    would stay lit after a tap;
 *  - the keyboard plate follows `:focus-visible` on the control inside, which only a keyboard
 *    sets, so it is not sticky either. The control keeps its own focus ring;
 *  - a press (`:active`) is one step stronger: on a phone, where nothing hovers, the whole
 *    row lights while the finger is down on it or on its control, which ties the text to the
 *    toggle it belongs to. It is released with the finger, so nothing sticks;
 *  - a row whose control is disabled gets none of these: it must not look clickable;
 *  - a row with an enabled switch has the pointer cursor: a click on its text flips the switch.
 *
 * The plate sits in the row's own padding, pulled back with a negative margin, so the text
 * stays aligned with the rest of the panel.
 */

/** Class on every row, for tests and for a surface that needs to find the rows. */
export const SETTING_ROW_CLASS = "SettingRow";

/**
 * Hover colour of a row that already has a fill (`background.level1`, the muted lists).
 * `g.hover` is translucent, so as a replacement it would LIGHTEN the row; this is the same
 * ink laid over that fill, opaque, so the transition has a real colour to animate to.
 */
export const SETTING_ROW_FILLED_HOVER =
    "color-mix(in srgb, var(--joy-palette-background-level1) 94%, var(--g-text))";
/** The same for a press, one step stronger (`active` is stronger than `hover`). */
export const SETTING_ROW_FILLED_ACTIVE =
    "color-mix(in srgb, var(--joy-palette-background-level1) 90%, var(--g-text))";

type SettingRowStyleOptions = {
    /** The row's control is disabled: no plate. */
    disabled?: boolean;
    /** The row has its own fill, so the plate is mixed over it instead of replacing it. */
    filled?: boolean;
};

export const settingRowSx = ({
    disabled = false,
    filled = false,
}: SettingRowStyleOptions = {}) => {
    const plate = filled ? SETTING_ROW_FILLED_HOVER : g.hover;
    const pressed = filled ? SETTING_ROW_FILLED_ACTIVE : g.active;
    return {
        borderRadius: g.radius.sm,
        // A filled row (the muted lists) brings its own padding and fill.
        ...(filled ? {} : { marginInline: -1, paddingInline: 1, paddingBlock: 0.5 }),
        transition: `background-color ${g.motion.fast} ${g.ease}`,
        ...(disabled
            ? {}
            : {
                  [NAV_HOVER_MEDIA]: { "&:hover": { backgroundColor: plate } },
                  // Its own rule: a browser that does not know `:has()` drops the whole
                  // selector list, and the hover rule above must survive that.
                  "&:has(:focus-visible)": { backgroundColor: plate },
                  // A row with a switch answers a click on its text too (`toggleRowSwitch`): it
                  // reads as clickable. Its own rule, for the same `:has()` reason.
                  "&:has(input[type='checkbox']:not(:disabled))": { cursor: "pointer" },
                  // A press, for a touch screen that has no hover: it lasts while the finger
                  // is down on the row or its control, so the two read as one. Last, so it
                  // out-ranks the hover plate on a mouse press.
                  "&:active": { backgroundColor: pressed },
              }),
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
    } as const;
};
