// Service filter for the Spotlight search typeahead.
//
// The overlay exposes one chip per *service* (what a user thinks of as
// "chat", "tasks", "notes", "todos") rather than one per raw backend
// `entity_type` — services are the user-facing vocabulary, and some
// services span multiple entity types (milestones live inside the task
// service: they render through the same task views and share task ids).
//
// Selection semantics: an EMPTY selection means "no filter" — the
// request omits `entity_types` entirely, which keeps the backend's
// default typeahead behavior (all workspace entities plus collected
// "Previous answer" rows; see `search.py` default-search exclusions).
// A non-empty selection is authoritative: only the mapped entity types
// are searched, so e.g. picking Chat+Task naturally drops note/todo
// AND "Previous answer" rows.

import type { EntityType } from "./types";

export const SPOTLIGHT_FILTER_SERVICES = ["chat", "task", "note", "todo", "answer"] as const;

export type SpotlightFilterService = (typeof SPOTLIGHT_FILTER_SERVICES)[number];

const SERVICE_ENTITY_TYPES: Record<SpotlightFilterService, EntityType[]> = {
    chat: ["chat"],
    // Milestones are part of the task service — a "Tasks" filter that
    // silently hid milestone hits would read as a bug.
    task: ["task", "milestone"],
    note: ["note"],
    todo: ["todo"],
    // "Previous answers" — the collected past-Genos-answer lane. Like
    // every chip, this narrows typeahead ONLY; the filter never scopes
    // the agent (see useSpotlight.onAsk — asks are always unscoped).
    answer: ["spotlight_answer"],
};

// Toggle one service in/out of the selection, preserving click order.
export const toggleFilterService = (
    current: SpotlightFilterService[],
    service: SpotlightFilterService
): SpotlightFilterService[] =>
    current.includes(service) ? current.filter((s) => s !== service) : [...current, service];

// Map the selected services to the `entity_types` request field.
// Undefined (not []) when nothing is selected so callers can spread it
// away and the request omits the key — `[]` would be falsy on the
// backend too, but omitting keeps the wire format identical to today.
export const entityTypesForFilter = (
    services: SpotlightFilterService[]
): EntityType[] | undefined =>
    services.length === 0 ? undefined : services.flatMap((s) => SERVICE_ENTITY_TYPES[s]);

// ---- Project filter -------------------------------------------------
//
// The second axis of the filter row, and a different KIND of control:
// the service chips are toggles over a fixed vocabulary, while projects
// are a per-team list the user picks from a dropdown. Same selection
// semantics though — empty means "no filter" and the request omits the
// key.
//
// Unlike the service chips, this one narrows the backend query itself
// (`project_ids` → an OpenSearch `terms` filter). Filtering the
// response client-side would be wrong: the backend already truncated to
// the top ~20 hits by workspace-wide relevance, so a project that
// doesn't dominate the query would show zero rows even when it has
// matches.
//
// Like every filter here it is SEARCH-ONLY and must never reach
// `/agent/ask/` — see the note in `useSpotlight.onAsk`.

// Map the selected project ids to the `project_ids` request field.
// Undefined (not []) when nothing is selected so callers can spread it
// away and keep the unfiltered wire format byte-identical, matching
// `entityTypesForFilter`. Ids are stringified because project ids are
// numbers in the app but keywords in the index.
export const projectIdsForFilter = (projectIds: number[]): string[] | undefined =>
    projectIds.length === 0 ? undefined : projectIds.map((id) => String(id));
