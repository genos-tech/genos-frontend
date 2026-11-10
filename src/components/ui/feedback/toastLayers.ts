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
