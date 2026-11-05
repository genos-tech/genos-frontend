import type { ToolResultProjectRef } from "../../services/agentApi";
import { requestInboxResync } from "../inbox/inboxResyncEvent";

// What an approved agent project write changes in the browser, beyond the
// transcript. The tool-result handlers in useAgentQA / useSpotlight call
// `emitProjectToolResult` once per result, so the two cannot drift.
//
//   delete_project         the server has already deleted the project. The
//                          result carries `project: {project_id, deleted}`
//                          and the browser only drops its own copies: it
//                          announces `projectDeleted`, which
//                          useProjectManagement answers (it owns the team
//                          project list and the current project). Nothing
//                          here calls the delete endpoint.
//   approve_join_request   the inbox item changed status on the server, and
//   decline_join_request   no socket event tells this browser. They ask for
//                          the same checkpointed inbox sync the reminder
//                          sweep uses.

export const PROJECT_DELETED_EVENT = "projectDeleted";

export interface ProjectDeletedDetail {
    projectId: number;
}

// The two tools that close a join request in the caller's inbox.
export const JOIN_REQUEST_ANSWER_TOOLS: ReadonlySet<string> = new Set([
    "approve_join_request",
    "decline_join_request",
]);

export const emitProjectToolResult = (toolName: string, project?: ToolResultProjectRef): void => {
    if (JOIN_REQUEST_ANSWER_TOOLS.has(toolName)) {
        requestInboxResync("agent-write");
        return;
    }
    // The ref comes off the wire: take it only from the tool that sends it,
    // and only with a real id.
    if (toolName !== "delete_project" || project?.deleted !== true) return;
    const projectId = Number(project.project_id);
    if (!Number.isFinite(projectId)) return;
    window.dispatchEvent(
        new CustomEvent<ProjectDeletedDetail>(PROJECT_DELETED_EVENT, { detail: { projectId } })
    );
};
