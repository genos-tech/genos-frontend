// How long a row or card click waits for a follow-up click before it opens
// the task. Only a click that FOLLOWS another within this window waits; the
// first click opens right after the next painted frame, once its own highlight
// has been drawn (see `useLeadingDebouncedCallback`). Shared by the task table
// and the sprint board so the two feel the same.
export const PREVIEW_SWITCH_DEBOUNCE_MS = 150;
