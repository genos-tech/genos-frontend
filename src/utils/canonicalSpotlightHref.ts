import type { SpotlightResult } from "../features/spotlight/types";

// Build the canonical in-app URL for a SpotlightResult so callers can
// feed it to UrlLinkModalProvider.openModalByHref (which parses URLs via
// parseInternalUrl into a ModalTarget). Returns null when there's no
// modal-capable URL — either the entity_type doesn't have a modal view
// yet (project) or the source is missing the ids needed to deep-link.
// Extracted from App.tsx so the chip → URL mapping is unit-testable;
// keep in sync with the URL shapes in `handleSpotlightSelect`.

// Milestone chips carry their id only inside `entity_id`
// ("milestone:<id>", the chunker convention — the flat SpotlightResult
// shape has no milestone_id field).
export const milestoneIdFromEntityId = (entityId: string | undefined | null): number | null => {
    const m = /^milestone:(\d+)$/.exec(entityId || "");
    if (!m) return null;
    const id = Number(m[1]);
    return Number.isFinite(id) && id > 0 ? id : null;
};

export const canonicalSpotlightHref = (r: SpotlightResult): string | null => {
    // Milestones get their own deep link so the preview opens through
    // ModalMilestoneView, which loads the milestone and points the
    // project context at the milestone's own project. Routing through
    // the backing task instead (the old behavior) worked only when the
    // host page's current project happened to be the milestone's:
    // ModalTaskView's milestone reroute resolves the milestone from
    // projectMilestones[currentProject.projectId], so from a chat page
    // the lookup missed forever and the preview auto-closed after 3s —
    // exactly what a fresh agent-created milestone chip hit.
    if (r.entity_type === "milestone" && r.project_id) {
        const milestoneId = milestoneIdFromEntityId(r.entity_id);
        if (milestoneId != null) {
            return `/workspace/tasks/project/${r.project_id}/milestone/${milestoneId}`;
        }
        // Chips from older indexes may lack the parseable entity_id —
        // fall back to the backing-task link (degraded but not broken
        // when the project context matches).
        if (r.task_id) {
            return `/workspace/tasks/project/${r.project_id}/task/${r.task_id}`;
        }
        return null;
    }
    if (r.entity_type === "task" && r.task_id && r.project_id) {
        return `/workspace/tasks/project/${r.project_id}/task/${r.task_id}`;
    }
    if (r.entity_type === "chat" && r.chat_type && r.chat_id) {
        const base = `/workspace/chat/${r.chat_type}/${r.chat_id}`;
        const withThread = r.thread_id ? `${base}/thread/${r.thread_id}` : base;
        return r.message_id ? `${withThread}/message/${r.message_id}` : withThread;
    }
    if (r.entity_type === "note" && r.note_id) {
        if (r.note_type === "personal") {
            return `/workspace/notes/my/${r.note_id}`;
        }
        if (r.note_type === "task" && r.project_id && r.task_id) {
            return (
                `/workspace/notes/task/project/${r.project_id}` +
                `/task/${r.task_id}/note/${r.note_id}`
            );
        }
        if (r.note_type === "chat" && r.chat_type && r.chat_id) {
            // Chat notes can live on a thread or on the main channel;
            // thread_id=0 is the sentinel for "not in a thread" per the
            // existing parseInternalUrl convention.
            const tid = r.thread_id ?? "0";
            return (
                `/workspace/notes/chat/${r.chat_type}` +
                `/${r.chat_id}/thread/${tid}/note/${r.note_id}`
            );
        }
    }
    return null;
};
