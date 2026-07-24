import { describe, expect, it } from "vitest";

import {
    buildCustomFieldColumns,
    customFieldColKey,
    customFieldValuesEqual,
    getCustomFieldString,
    parseCustomFieldColKey,
    resolveTagOptions,
    setCustomFieldValue,
} from "../features/tasks/utils/customFields";
import { ProjectCustomFieldDef } from "../types/tasks";

const tagDef: ProjectCustomFieldDef = {
    fieldId: 7,
    fieldName: "Customer",
    fieldType: "tag",
    options: [
        { id: "opt-a", label: "Alpha", color: "#ff2323" },
        { id: "opt-b", label: "Beta", color: "#0044c2" },
    ],
    sortOrder: 0,
};

describe("custom field column keys", () => {
    it("round-trips fieldId through the column key", () => {
        expect(customFieldColKey(42)).toBe("cf_42");
        expect(parseCustomFieldColKey("cf_42")).toBe(42);
    });

    it("rejects non-custom keys and malformed suffixes", () => {
        expect(parseCustomFieldColKey("status")).toBeNull();
        expect(parseCustomFieldColKey("cf_")).toBeNull();
        expect(parseCustomFieldColKey("cf_abc")).toBeNull();
        expect(parseCustomFieldColKey("cf_-1")).toBeNull();
        // A built-in column can never collide with the prefix, but a
        // fractional id must not parse either.
        expect(parseCustomFieldColKey("cf_1.5")).toBeNull();
    });
});

describe("buildCustomFieldColumns", () => {
    it("orders by sortOrder then fieldId and namespaces the field key", () => {
        const cols = buildCustomFieldColumns([
            { ...tagDef, fieldId: 9, sortOrder: 2 },
            { ...tagDef, fieldId: 3, fieldName: "Notes", fieldType: "text", sortOrder: 0 },
            { ...tagDef, fieldId: 5, fieldName: "Due", fieldType: "date", sortOrder: 2 },
        ]);
        expect(cols.map((c) => c.field)).toEqual(["cf_3", "cf_5", "cf_9"]);
        expect(cols[0].headerName).toBe("Notes");
        // Custom columns are visible by default and resizable.
        expect(cols.every((c) => c.resizable && !c.hidden)).toBe(true);
        // No headerLabelKey — the label IS the user-defined name, and
        // visibleColumns' i18n resolution must leave it untouched.
        expect(cols.every((c) => c.headerLabelKey === undefined)).toBe(true);
    });
});

describe("resolveTagOptions", () => {
    it("maps stored ids to live options, dropping orphans", () => {
        expect(resolveTagOptions(tagDef, ["opt-b", "opt-deleted", "opt-a"])).toEqual([
            tagDef.options[1],
            tagDef.options[0],
        ]);
    });

    it("returns [] for non-list or empty values", () => {
        expect(resolveTagOptions(tagDef, undefined)).toEqual([]);
        expect(resolveTagOptions(tagDef, "not-a-list")).toEqual([]);
        expect(resolveTagOptions(tagDef, [])).toEqual([]);
    });
});

describe("getCustomFieldString", () => {
    it("returns the stored string and tolerates shape mismatches", () => {
        expect(getCustomFieldString({ "7": "hello" }, 7)).toBe("hello");
        expect(getCustomFieldString({ "7": ["list"] }, 7)).toBe("");
        expect(getCustomFieldString(undefined, 7)).toBe("");
    });
});

describe("setCustomFieldValue", () => {
    it("sets without mutating the source map", () => {
        const source = { "1": "keep" };
        const next = setCustomFieldValue(source, 2, "new");
        expect(next).toEqual({ "1": "keep", "2": "new" });
        expect(source).toEqual({ "1": "keep" });
    });

    it("deletes the key for empty values (null / '' / [])", () => {
        expect(setCustomFieldValue({ "1": "x" }, 1, null)).toEqual({});
        expect(setCustomFieldValue({ "1": "x" }, 1, "")).toEqual({});
        expect(setCustomFieldValue({ "1": ["a"] }, 1, [])).toEqual({});
    });

    it("starts from an empty map when values are undefined", () => {
        expect(setCustomFieldValue(undefined, 3, ["opt-a"])).toEqual({ "3": ["opt-a"] });
    });
});

describe("customFieldValuesEqual", () => {
    it("compares scalar and list values", () => {
        expect(customFieldValuesEqual({ "1": "a" }, { "1": "a" })).toBe(true);
        expect(customFieldValuesEqual({ "1": "a" }, { "1": "b" })).toBe(false);
        expect(customFieldValuesEqual({ "1": ["a", "b"] }, { "1": ["a", "b"] })).toBe(true);
        expect(customFieldValuesEqual({ "1": ["a", "b"] }, { "1": ["b", "a"] })).toBe(false);
        expect(customFieldValuesEqual({ "1": ["a"] }, { "1": "a" })).toBe(false);
    });

    it("treats undefined and {} as equal, extra keys as unequal", () => {
        expect(customFieldValuesEqual(undefined, {})).toBe(true);
        expect(customFieldValuesEqual({ "1": "a" }, {})).toBe(false);
    });
});
