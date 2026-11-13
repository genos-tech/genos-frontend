import type { MouseEvent } from "react";

/** What inside a row handles its own clicks: a click on it is never "on the label". */
const OWN_CLICKS =
    'a, button, input, select, textarea, label, summary, [role="button"], [role="switch"], ' +
    '[role="checkbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="menuitem"], ' +
    '[role="option"], [role="slider"], [role="tab"], [contenteditable="true"]';

/**
 * A click on a row's text (the label or the description, or the gap between them and the
 * control) flips the row's switch, as a click on a `<label>` would (MIP-1463): the hover plate
 * covers the whole row, so the whole row has to answer. A real `<label>` cannot be used here,
 * because the text is `<p>` blocks (a label may hold phrasing content only) and a row can hold
 * other controls.
 *
 * Only a row with exactly one checkbox / switch, enabled, flips; a click on any control in the
 * row (the switch itself, a button, a select, a link) is that control's own; and a click that
 * ends a text selection (someone copying the description) flips nothing.
 */
export const toggleRowSwitch = (event: MouseEvent<HTMLElement>): void => {
    if (event.defaultPrevented) return;
    const row = event.currentTarget;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const own = target.closest(OWN_CLICKS);
    if (own && row.contains(own)) return;
    const inputs = row.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    if (inputs.length !== 1 || inputs[0].disabled) return;
    if (window.getSelection()?.toString()) return;
    inputs[0].click();
};
