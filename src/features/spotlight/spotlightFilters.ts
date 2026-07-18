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
    // "Previous answers" — the collected past-Genos-answer lane. SEARCH
    // ONLY: filtering typeahead to (or including) prior answers is
    // useful, but it must never scope the AGENT — feeding the
    // spotlight_answer lane into grounding is the answer→grounding loop
    // the backend forbids (and whitelists out server-side). See
    // agentEntityTypesForFilter, which drops it.
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

// Entity types that are never a valid AGENT grounding scope — the
// spotlight_answer lane is search-only (feeding a past answer back into
// a new answer is the loop the backend guards against; it also
// whitelists these out of /ask/). A set so future search-only lanes are
// a one-line add.
const AGENT_NON_GROUNDABLE: ReadonlySet<EntityType> = new Set(["spotlight_answer"]);

// Agent variant of entityTypesForFilter: the ask pin with search-only
// lanes stripped. A "Previous answers"-only selection therefore leaves
// the agent UNSCOPED (undefined) rather than pinning it to a lane it
// can't ground on — same effect as no chips.
export const agentEntityTypesForFilter = (
    services: SpotlightFilterService[]
): EntityType[] | undefined => {
    const all = (entityTypesForFilter(services) ?? []).filter((t) => !AGENT_NON_GROUNDABLE.has(t));
    return all.length === 0 ? undefined : all;
};
