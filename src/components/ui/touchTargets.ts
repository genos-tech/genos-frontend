/**
 * Tap targets on a touch screen (MIP-1319). A pointer is "coarse" when the primary input is a
 * finger: there every control a finger has to hit is 44px, with a mouse nothing changes. The
 * rules live here so a header or a chip row does not carry its own number.
 */

/** The size of a tap target on a touch screen, in px. */
export const TOUCH_TARGET = 44;

/** `min` 44 x 44 for whatever `selector` matches inside the element, on a touch screen only. */
export const touchTargetSx = (selector: string) =>
    ({
        "@media (pointer: coarse)": {
            [selector]: { minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET },
        },
    }) as const;

/**
 * Every icon button inside a header is a 44px target on a touch screen. Spread into the page
 * header frame (so the chat headers and `PageHeader` get it) and onto the rows of the headers
 * that do not wear the frame (the note actions, the task and milestone preview headers).
 *
 * `min` sizes only, so a button that is already bigger stays, and the 28 / 32px triggers of
 * `MoreMenu` and the Joy `sm` icon buttons grow without being touched one by one.
 */
export const headerTouchTargetsSx = touchTargetSx("& .MuiIconButton-root");

/** Height of a Joy `Chip` at `size="sm"`, in px: what the hit area below reaches around. */
const CHIP_SM_HEIGHT = 20;
const CHIP_REACH = (TOUCH_TARGET - CHIP_SM_HEIGHT) / 2;

/**
 * A row of Joy `Chip`s that are filters (`size="sm"`, 20px). Joy paints a clickable chip's fill
 * on the `MuiChip-action` button laid over it, so growing that button would grow the chip. The
 * chip keeps its look instead, and an invisible hit area reaches 12px above and below it, so a
 * tap anywhere in a 44px band lands on the chip. The row is 44px tall, so one row's bands never
 * overlap the next row's. A row that wraps would need a `rowGap` of 24px for the same reason.
 * Nothing changes with a mouse.
 */
export const chipRowTouchSx = {
    "@media (pointer: coarse)": {
        minHeight: TOUCH_TARGET,
        "& .MuiChip-action::after": {
            content: '""',
            position: "absolute",
            top: -CHIP_REACH,
            bottom: -CHIP_REACH,
            left: -4,
            right: -4,
        },
    },
} as const;
