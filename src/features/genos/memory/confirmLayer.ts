// Above the Genos settings dialog. `SpotlightSettingsModal` pins itself at
// 13200 so it can sit over the Spotlight overlay (13100), and a Joy Modal
// opened from inside it is a SIBLING portal at the default 1300, i.e. BEHIND
// it and unclickable. Tooltips are 13300, so this stays under them. In the
// main Settings modal (1300) the same value is simply "on top".
export const GENOS_MEMORY_CONFIRM_Z_INDEX = 13250;
