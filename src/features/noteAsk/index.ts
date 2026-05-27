// Public surface of the noteAsk package. Consumed by NoteHeaderActions
// (the shared right-side action cluster across My / Task / Chat notes).

export { useNoteAsk } from "./useNoteAsk";
export { NoteAskModal } from "./NoteAskModal";
export type { UseNoteAskReturn, NoteSummaryState } from "./useNoteAsk";
