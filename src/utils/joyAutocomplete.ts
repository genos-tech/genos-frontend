/** Joy's Autocomplete hands `renderOption` a props object that includes
 * its internal `ownerState`. Spreading that straight onto a DOM-rendering
 * element (`<li>`, `Box component="li"`) forwards it to the DOM node and
 * trips React's "does not recognize the `ownerState` prop" dev warning on
 * every rendered option.
 *
 * Joy's own `<AutocompleteOption>` consumes the prop — prefer it when its
 * default option styling is wanted. Use this strip when the option row is
 * a bespoke `<li>`/Box that must keep its exact current styling. */
export const stripOwnerState = <T extends object>(props: T): Omit<T, "ownerState"> => {
    const { ownerState: _ownerState, ...rest } = props as T & { ownerState?: unknown };
    return rest;
};
