/**
 * The layer of the toast and banner regions (`Toast.tsx`). A constants module
 * so a menu can derive its own layer from it without importing the component.
 *
 * Above every modal and the Spotlight layer (13300): a toast is the one thing
 * that must never be hidden by the surface that caused it.
 */
export const TOAST_REGION_Z_INDEX = 13500;

/**
 * The lowest layer a menu may sit on. A menu opened from a page header on a
 * phone starts under the persistent top banner (y = 48 against a banner over
 * the top ~56 px), so on the host's own layer its first row would be covered
 * and untappable (MIP-1327). A menu is the topmost transient surface by
 * definition (it closes on an outside tap), so it clears the banner; the
 * host-derived layer still wins when it is higher.
 */
export const MENU_MIN_Z_INDEX = TOAST_REGION_Z_INDEX + 1;

/**
 * A Joy `Select` / `Autocomplete` listbox or `Menu` never sits below `MENU_MIN_Z_INDEX`
 * (MIP-1393). Joy gives them `var(--unstable_popup-zIndex, <popup token>)`, and every Joy
 * `Modal` root in the document re-stamps that variable on the listboxes that follow it
 * (`~ [role="listbox"]`: calc(modal + 1) = 1301), so the theme's popup token alone never
 * applied on a page with a Modal in the tree: a listbox opened under the phone header was
 * painted below the connection banner. A host that stamps a HIGHER layer (a dialog's
 * `layer + 10`) keeps it; an explicit `sx` / `slotProps.listbox.sx` z-index on a call site
 * wins over the theme as always.
 */
export const POPUP_Z_INDEX_CSS = `max(var(--unstable_popup-zIndex, 0), ${MENU_MIN_Z_INDEX})`;

/**
 * Tooltips stay the topmost transient layer (they were 13300, above every modal and the
 * Spotlight layer): one above the menus and listboxes, so a tooltip on a menu row or a
 * listbox option is not hidden by the surface it describes.
 */
export const TOOLTIP_Z_INDEX = MENU_MIN_Z_INDEX + 1;
