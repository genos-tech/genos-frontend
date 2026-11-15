// Whether an "Ask Genos" entry point may be offered where this hook runs (MIP-1058).
//
// Not inside a link-preview modal (the UrlLinkModal that a chat, task, milestone, note or to-do link
// opens over the page): Spotlight opens above it, but the modal's focus trap keeps the question's input
// from taking focus, which is why a task preview in one has no Ask item either (#694). The modal
// provides `NoteModalHostZIndexContext` around EVERY body it renders (not only notes), and a page
// surface has no provider, so the context being set is exactly "inside a link-preview modal".

import { useNoteModalHostZIndex } from "../../components/modals/noteModalHostZIndex";

export const useAskGenosAvailable = (): boolean => useNoteModalHostZIndex() === undefined;
