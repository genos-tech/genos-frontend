// Public surface of the noteAsk package. Consumed by NoteHeaderActions
// (the shared right-side action cluster across My / Task / Chat notes).

export { NoteAskModal } from "./NoteAskModal";
export type { NoteSummaryState, UseNoteAskReturn } from "./useNoteAsk";
export { useNoteAsk } from "./useNoteAsk";
