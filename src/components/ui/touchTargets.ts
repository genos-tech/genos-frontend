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

/** Height of a compact filter row, in px: the chip (20) plus 6px above and below. */
export const COMPACT_ROW = 32;

/**
 * `chipRowTouchSx` for a phone header that has to be short: the row is `COMPACT_ROW` tall
 * instead of 44, and the invisible hit area still reaches 12px above and below the chip, so the
 * tap target is the same 44px band. With 6px of room around the chip the band stops exactly at
 * the edge of the chip in the next row, so a tap never lands on the wrong chip; it only overlaps
 * that row's own band, which holds nothing to hit.
 */
export const compactChipRowTouchSx = {
    "@media (pointer: coarse)": {
        ...chipRowTouchSx["@media (pointer: coarse)"],
        minHeight: COMPACT_ROW,
    },
} as const;

/**
 * One Joy `Chip` of any height that is a button on its own, not in a row of chips (the Unread
 * filter beside the chat list tabs, 26px): the same invisible hit area as `chipRowTouchSx`, grown
 * to 44px high (not wider) around the chip, and nothing else (the row it sits in owns its height).
 */
export const chipHitAreaSx = (chipHeight: number) =>
    ({
        "@media (pointer: coarse)": {
            "& .MuiChip-action::after": {
                content: '""',
                position: "absolute",
                top: -(TOUCH_TARGET - chipHeight) / 2,
                bottom: -(TOUCH_TARGET - chipHeight) / 2,
                // Tall only: a lone chip's neighbours (the tabs beside it) can be 1px away.
                left: 0,
                right: 0,
            },
        },
    }) as const;

/**
 * Like `invisibleHitAreaSx`, but only TALL: 44px high and exactly as wide as the control. For a
 * control whose neighbours sit closer than 22px on the sides, where a 44px-wide area would
 * cover them (avatars overlapped in a stack, the buttons of a toolbar). The target is then
 * `width x 44`, not 44 x 44: a thumb misses a short control far more often than a narrow one.
 */
export const tallHitAreaSx = (selector = "&") =>
    ({
        "@media (pointer: coarse)": {
            [selector]: { position: "relative" },
            [`${selector}::after`]: {
                content: '""',
                position: "absolute",
                top: "50%",
                left: 0,
                width: "100%",
                height: TOUCH_TARGET,
                transform: "translateY(-50%)",
            },
        },
    }) as const;

/**
 * A control that must keep its size and look (a task id chip in a row of text, an avatar in a
 * header) is still a 44 x 44 target on a touch screen: an invisible hit area, centred on it,
 * reaches out to 44px (and never narrower than the control itself). Nothing is painted, nothing
 * moves, and with a mouse the rule does not exist.
 *
 * `selector` picks the control inside the element the sx is spread on (`"&"` for the element
 * itself). The control becomes the hit area's containing block, so it must not already be
 * positioned some other way (`position: relative` is what this sets).
 *
 * The area overlaps whatever sits within 22px of the control's centre, so use it where the
 * neighbours are at least that far away (a row of 44px, the end of a header), as the To-Do
 * chip row (`chipRowTouchSx`) does.
 */
export const invisibleHitAreaSx = (selector = "&") =>
    ({
        "@media (pointer: coarse)": {
            [selector]: { position: "relative" },
            [`${selector}::after`]: {
                content: '""',
                position: "absolute",
                top: "50%",
                left: "50%",
                width: `max(100%, ${TOUCH_TARGET}px)`,
                height: TOUCH_TARGET,
                transform: "translate(-50%, -50%)",
            },
        },
    }) as const;
