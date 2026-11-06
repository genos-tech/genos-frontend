// Spotlight's search by task id (MIP-1040): the row the id lookup pins at the top.
//
// OpenSearch cannot find "MIP-890": the display id is in no chunk and no query. A
// query that is only an id is looked up by number instead (`lookupTaskByDisplayId`,
// `GET /search/taskByDisplayId/`: any status, only projects the person can reach),
// and the one row it finds is shaped like a search result so it renders, opens and
// highlights like any other.

import type { SearchTeamTasksResponse } from "../../types/tasks";
import type { EntityType, SpotlightResult } from "./types";

/** The lookup's row as a Spotlight result. A milestone is a `milestone` result
 *  carrying its own id in `entity_id` (how the app opens one); without the id (an
 *  older backend) it is the backing task's route. */
export const spotlightResultForTask = (row: SearchTeamTasksResponse): SpotlightResult => {
    const isMilestone = row.isMilestone === true;
    const entityType: EntityType = isMilestone ? "milestone" : "task";
    return {
        entity_type: entityType,
        entity_id:
            isMilestone && row.milestoneId != null
                ? `milestone:${row.milestoneId}`
                : `task:${row.taskId}`,
        title: row.title,
        snippet: null,
        score: 1,
        keyword_rank: null,
        vector_rank: null,
        matched_chunk_types: [],
        matched_terms: [],
        updated_at: row.tsUpdated ?? null,
        chat_type: null,
        chat_id: null,
        thread_id: null,
        message_id: null,
        task_id: String(row.taskId),
        task_display_id: row.displayId ?? null,
        task_status: row.status?.status ?? null,
        note_id: null,
        note_type: null,
        project_id: String(row.projectId),
        related_entity_ids: [],
    };
};

/** Whether the person's filter chips and project scope let this row through. A
 *  search-only filter (see `spotlightFilters`): with Chat selected, an id search
 *  must not pin a task above the chat results, and with a project picked it must
 *  not pin a task of another project. */
export const idHitPassesFilter = (
    hit: SpotlightResult,
    entityTypes: readonly EntityType[] | undefined,
    projectIds: readonly string[] | undefined
): boolean =>
    (!entityTypes || entityTypes.includes(hit.entity_type)) &&
    (!projectIds || (hit.project_id != null && projectIds.includes(hit.project_id)));

/** `results` with the id hit first, and the same task dropped from the rest (the
 *  search may have found it by title, as a task or as its milestone). Returns
 *  `results` itself when there is no hit, so a plain search renders as before. */
export const withIdHit = (
    results: SpotlightResult[],
    hit: SpotlightResult | null
): SpotlightResult[] =>
    hit
        ? [
              hit,
              ...results.filter(
                  (r) =>
                      !(
                          (r.entity_type === "task" || r.entity_type === "milestone") &&
                          r.task_id === hit.task_id
                      )
              ),
          ]
        : results;
