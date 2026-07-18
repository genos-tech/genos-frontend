import { describe, expect, it } from "vitest";

import {
    entityTypesForFilter,
    SPOTLIGHT_FILTER_SERVICES,
    toggleFilterService,
} from "../features/spotlight/spotlightFilters";

describe("toggleFilterService", () => {
    it("adds a service that is not selected", () => {
        expect(toggleFilterService([], "chat")).toEqual(["chat"]);
        expect(toggleFilterService(["chat"], "task")).toEqual(["chat", "task"]);
    });

    it("removes a service that is already selected", () => {
        expect(toggleFilterService(["chat", "task"], "chat")).toEqual(["task"]);
        expect(toggleFilterService(["todo"], "todo")).toEqual([]);
    });

    it("preserves the order of the remaining selection", () => {
        expect(toggleFilterService(["note", "chat", "todo"], "chat")).toEqual(["note", "todo"]);
    });

    it("does not mutate the input array", () => {
        const current = ["chat" as const];
        toggleFilterService(current, "task");
        toggleFilterService(current, "chat");
        expect(current).toEqual(["chat"]);
    });
});

describe("entityTypesForFilter", () => {
    it("returns undefined for an empty selection (no filter → omit the key)", () => {
        expect(entityTypesForFilter([])).toBeUndefined();
    });

    it("maps chat/note/todo one-to-one", () => {
        expect(entityTypesForFilter(["chat"])).toEqual(["chat"]);
        expect(entityTypesForFilter(["note"])).toEqual(["note"]);
        expect(entityTypesForFilter(["todo"])).toEqual(["todo"]);
    });

    it("expands the task service to task + milestone", () => {
        expect(entityTypesForFilter(["task"])).toEqual(["task", "milestone"]);
    });

    it("maps the answer service to the spotlight_answer lane (search side)", () => {
        expect(entityTypesForFilter(["answer"])).toEqual(["spotlight_answer"]);
        expect(entityTypesForFilter(["task", "answer"])).toEqual([
            "task",
            "milestone",
            "spotlight_answer",
        ]);
    });

    it("flattens a multi-service selection in selection order", () => {
        expect(entityTypesForFilter(["chat", "task"])).toEqual(["chat", "task", "milestone"]);
    });

    it("covers every advertised service", () => {
        // If a new service is added to SPOTLIGHT_FILTER_SERVICES without
        // a mapping, flatMap would produce undefined entries — guard it.
        const all = entityTypesForFilter([...SPOTLIGHT_FILTER_SERVICES]);
        expect(all).toBeDefined();
        expect(all!.every((t) => typeof t === "string")).toBe(true);
    });
});
