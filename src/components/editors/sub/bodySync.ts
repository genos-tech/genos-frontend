// Trailing debounce for pushing the serialized editor document into parent
// state. `editor.document` is a full ProseMirror→JSON conversion and
// `setBody` re-renders a large parent tree (TaskPreview / CreateTaskForm /
// the note panels) — doing both synchronously on every keystroke is what
// made typing lag in the collaborative editors. 250ms keeps the parent
// comfortably fresher than the 3s auto-save debounce while staying off the
// keystroke path. Yjs (not this sync) is the authoritative document store,
// so a pending sync dropped on unmount only leaves the REST snapshot
// briefly stale — it self-heals on the next edit.
export const EDITOR_BODY_SYNC_DEBOUNCE_MS = 250;
