/** Set on a milestone row (the `li`) while its actions are being used by something the row's
 *  own CSS cannot see: keyboard focus on the star or the menu button (they come after the row
 *  button, and CSS cannot look back at a later sibling), or an open menu. The row then gives
 *  way to the actions exactly as it does on hover (MIP-1156). Written by
 *  `MilestoneRowActions`, read by the row's styles in `MilestonesListItem`. */
export const ROW_ACTIONS_ENGAGED_ATTR = "data-actions-engaged";
