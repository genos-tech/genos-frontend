import { describe, expect, it } from "vitest";

import { groupsBeforePeopleRank, orderGroupsFirst } from "../utils/mentionOrder";

// MIP-1701: chat search and the Spotlight `@` picker listed the people before
// the groups. With 60 people, the department group (`billing · general`) sat
// below the fold, and the picker's 8-row cap cut the groups off.

type Item = { label: string; isGroup: boolean };
const view = (item: Item) => ({ label: item.label, isGroup: item.isGroup });

const person = (label: string): Item => ({ label, isGroup: false });
const group = (label: string): Item => ({ label, isGroup: true });

describe("groupsBeforePeopleRank", () => {
    it("ranks an exact-name match first, whatever its kind", () => {
        expect(groupsBeforePeopleRank("Billing", false, "billing")).toBe(1);
        expect(groupsBeforePeopleRank("billing", true, "billing")).toBe(0);
    });

    it("ranks groups above people that are not an exact match", () => {
        expect(groupsBeforePeopleRank("payments", true, "pay")).toBeLessThan(
            groupsBeforePeopleRank("Pay Lee", false, "pay")
        );
    });

    it("ignores case and surrounding spaces in the query", () => {
        expect(groupsBeforePeopleRank("Payments", true, "  PAYMENTS ")).toBe(0);
    });
});

describe("orderGroupsFirst", () => {
    it("puts the groups ahead of the people for a shared query (chat search: billing)", () => {
        const items = [
            person("Billing Lead"),
            person("Billing Member 1"),
            person("Billing Member 2"),
            person("Billing Member 3"),
            person("Billing Member 4"),
            group("billing · general"),
        ];
        const ordered = orderGroupsFirst(items, "billing", view);
        expect(ordered[0]).toEqual(group("billing · general"));
        expect(ordered.slice(1).map((i) => i.label)).toEqual([
            "Billing Lead",
            "Billing Member 1",
            "Billing Member 2",
            "Billing Member 3",
            "Billing Member 4",
        ]);
    });

    it("keeps the best group inside the first 8 rows of the @ picker (Spotlight: pay)", () => {
        const people = Array.from({ length: 60 }, (_, i) => person(`Pay Person ${i}`));
        const groups = [group("payments"), group("payments-oncall")];
        const ordered = orderGroupsFirst([...people, ...groups], "pay", view).slice(0, 8);
        expect(ordered.map((i) => i.label)).toEqual([
            "payments",
            "payments-oncall",
            ...people.slice(0, 6).map((p) => p.label),
        ]);
    });

    it("keeps an exact-name person above a group that only starts with the query", () => {
        const items = [group("Design guild"), person("Design")];
        expect(orderGroupsFirst(items, "design", view)[0]).toEqual(person("Design"));
    });

    it("keeps the incoming order inside a tier (stable)", () => {
        const items = [person("Ann Pay"), person("Bob Pay"), person("Cy Pay")];
        expect(orderGroupsFirst(items, "pay", view).map((i) => i.label)).toEqual([
            "Ann Pay",
            "Bob Pay",
            "Cy Pay",
        ]);
    });

    it("does not reorder an empty-query list", () => {
        const items = [person("Zed"), group("Alpha")];
        expect(orderGroupsFirst(items, "", view)).toEqual(items);
    });
});
