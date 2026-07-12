import { describe, expect, it } from "vitest";

import type { SpotlightResult } from "../features/spotlight/types";
import {
    canonicalSpotlightHref,
    milestoneIdFromEntityId,
    todoHrefFromEntityId,
} from "../utils/canonicalSpotlightHref";

const base = (overrides: Partial<SpotlightResult>): SpotlightResult =>
    ({
        entity_type: "task",
        entity_id: "",
        title: "",
        snippet: "",
        ...overrides,
    }) as SpotlightResult;

describe("milestoneIdFromEntityId", () => {
    it("parses the chunker convention", () => {
        expect(milestoneIdFromEntityId("milestone:42")).toBe(42);
        expect(milestoneIdFromEntityId("milestone:abc")).toBeNull();
        expect(milestoneIdFromEntityId("task:42")).toBeNull();
        expect(milestoneIdFromEntityId(undefined)).toBeNull();
    });
});

describe("canonicalSpotlightHref", () => {
    it("routes milestone chips to the milestone deep link, not the backing task", () => {
        // The backing-task route broke fresh (e.g. agent-created)
        // milestones: ModalTaskView's reroute resolved the milestone
        // against the HOST page's current project and auto-closed when
        // it missed. The milestone URL opens ModalMilestoneView, which
        // loads + scopes the project itself.
        const href = canonicalSpotlightHref(
            base({
                entity_type: "milestone",
                entity_id: "milestone:7",
                project_id: "3",
                task_id: "99",
            })
        );
        expect(href).toBe("/workspace/tasks/project/3/milestone/7");
    });

    it("falls back to the backing task when entity_id is not parseable", () => {
        const href = canonicalSpotlightHref(
            base({
                entity_type: "milestone",
                entity_id: "",
                project_id: "3",
                task_id: "99",
            })
        );
        expect(href).toBe("/workspace/tasks/project/3/task/99");
    });

    it("returns null for a milestone with neither id source", () => {
        const href = canonicalSpotlightHref(
            base({ entity_type: "milestone", entity_id: "", project_id: "3" })
        );
        expect(href).toBeNull();
    });

    it("keeps the task route for task chips", () => {
        const href = canonicalSpotlightHref(
            base({ entity_type: "task", project_id: "3", task_id: "99" })
        );
        expect(href).toBe("/workspace/tasks/project/3/task/99");
    });

    it("routes todo chips through their entity_id", () => {
        const href = canonicalSpotlightHref(
            base({ entity_type: "todo", entity_id: "todo:2026-07-12:item:88" })
        );
        expect(href).toBe("/workspace/todo/2026-07-12/item/88");
    });
});

describe("todoHrefFromEntityId", () => {
    it("parses the item-level backend convention", () => {
        expect(todoHrefFromEntityId("todo:2026-07-12:item:88")).toBe(
            "/workspace/todo/2026-07-12/item/88"
        );
    });

    it("parses the day-level grouping id", () => {
        expect(todoHrefFromEntityId("todo:2026-07-12")).toBe("/workspace/todo/2026-07-12");
    });

    it("returns null for malformed ids", () => {
        expect(todoHrefFromEntityId("todo::item:5")).toBeNull();
        expect(todoHrefFromEntityId("todo:2026-7-12:item:5")).toBeNull();
        expect(todoHrefFromEntityId("task:42")).toBeNull();
        expect(todoHrefFromEntityId("")).toBeNull();
        expect(todoHrefFromEntityId(undefined)).toBeNull();
    });
});
