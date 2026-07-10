// Trailing debounce for pushing the serialized editor document into parent
// state. `editor.document` is a full ProseMirror→JSON conversion and
// `setBody` re-renders a large parent tree (TaskPreview / CreateTaskForm /
// the note panels) — doing both synchronously on every keystroke is what
// made typing lag in the collaborative editors.
//
// 1000ms (was 250ms): at 250ms the trailing timer fired at nearly every
// inter-word pause DURING a typing session, and each fire blocked the main
// thread with the serialize + parent re-render — keystrokes landing in that
// window buffered and flushed ~half a second late. One second is above
// natural intra-sentence pauses, so the sync lands when the user actually
// stops. Freshness is still ample: the auto-save debounce (3s, re-armed by
// this sync) and the blur `flush()` are the only consumers, and Yjs (not
// this sync) is the authoritative document store — a pending sync dropped
// on unmount only leaves the REST snapshot briefly stale and self-heals on
// the next edit. The timer-path state commit is additionally wrapped in
// `startTransition` at the call sites so even a mid-typing fire yields to
// keystrokes instead of blocking them.
export const EDITOR_BODY_SYNC_DEBOUNCE_MS = 1000;
