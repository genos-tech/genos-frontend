/**
 * Whether a key event belongs to an input-method composition (Japanese,
 * Chinese, Korean, or accented input).
 *
 * While a composition is active, Enter CONFIRMS the candidate and Escape
 * cancels it, and the arrow keys drive the candidate window; none of them is
 * the app's Enter / Escape. `isComposing` is the modern signal; `keyCode` 229
 * is the sentinel Safari still sends for the confirming Enter (it fires
 * `keydown` after `compositionend`, when `isComposing` is already false).
 *
 * Every text field that treats Enter or Escape as a command asks this first.
 */
export const isImeComposing = (event: {
    nativeEvent?: { isComposing?: boolean };
    isComposing?: boolean;
    keyCode?: number;
}): boolean =>
    event.nativeEvent?.isComposing === true || event.isComposing === true || event.keyCode === 229;
