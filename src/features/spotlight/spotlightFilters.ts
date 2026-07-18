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

export const SPOTLIGHT_FILTER_SERVICES = ["chat", "task", "note", "todo"] as const;

export type SpotlightFilterService = (typeof SPOTLIGHT_FILTER_SERVICES)[number];

const SERVICE_ENTITY_TYPES: Record<SpotlightFilterService, EntityType[]> = {
    chat: ["chat"],
    // Milestones are part of the task service — a "Tasks" filter that
    // silently hid milestone hits would read as a bug.
    task: ["task", "milestone"],
    note: ["note"],
    todo: ["todo"],
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
