/**
 * One order for every "…" menu (MIP-903).
 *
 * The same action used to sit in a different place in each menu, so what a
 * user learned from one did not carry to the next. `orderMoreMenuItems` is the
 * single place that decides, from each item's `kind`, where it goes.
 */

import { describe, expect, it } from "vitest";

import {
    MORE_MENU_GROUPS,
    MoreMenuKind,
    orderMoreMenuItems,
} from "../components/ui/moreMenuOrder";

type Item = { id: string; kind?: MoreMenuKind; danger?: boolean; visible?: boolean };

const ids = (items: Item[]) => items.map((i) => i.id);
const ofKind = (kind: MoreMenuKind, id: string = kind): Item => ({ id, kind });

describe("orderMoreMenuItems", () => {
    it("runs the groups in the approved order", () => {
        expect(MORE_MENU_GROUPS.map((g) => g.group)).toEqual([
            "open",
            "share",
            "personal",
            "create",
            "organize",
            "content",
            "mute",
            "edit",
            "delete",
        ]);

        // One kind from each group, handed over back to front.
        const oneOfEach = MORE_MENU_GROUPS.map((g) => g.kinds[0] as MoreMenuKind);
        const shuffled = [...oneOfEach].reverse().map((k) => ofKind(k));
        expect(ids(orderMoreMenuItems(shuffled))).toEqual(oneOfEach);
    });

    it("orders every kind the way the table lists it, whatever order it was written in", () => {
        const all = MORE_MENU_GROUPS.flatMap((g) => g.kinds as readonly MoreMenuKind[]);
        const written = [...all].reverse().map((k) => ofKind(k));
        expect(ids(orderMoreMenuItems(written))).toEqual(all);
    });

    it("orders the named actions as the rule is stated", () => {
        // Spot-checks of the rule as stated: respond, share, personal, create,
        // organize, content, mute, edit, delete.
        const written = (
            [
                "delete",
                "edit",
                "mute",
                "export",
                "import",
                "versionHistory",
                "members",
                "tags",
                "move",
                "rename",
                "newSubfolder",
                "newMilestone",
                "newProject",
                "newChildNote",
                "newNote",
                "newSubTask",
                "newTask",
                "remindMe",
                "flag",
                "favorite",
                "copyLink",
                "share",
                "askGenos",
                "openInNotes",
                "openNote",
                "openThread",
                "openTask",
                "reply",
            ] as MoreMenuKind[]
        ).map((k) => ofKind(k));
        expect(ids(orderMoreMenuItems(written))).toEqual([
            "reply",
            "openTask",
            "openThread",
            "openNote",
            "openInNotes",
            "askGenos",
            "share",
            "copyLink",
            "favorite",
            "flag",
            "remindMe",
            "newTask",
            "newSubTask",
            "newNote",
            "newChildNote",
            "newProject",
            "newMilestone",
            "newSubfolder",
            "rename",
            "move",
            "tags",
            "members",
            "versionHistory",
            "import",
            "export",
            "mute",
            "edit",
            "delete",
        ]);
    });

    it("always puts Delete last, whatever it is tagged and wherever it was written", () => {
        const items: Item[] = [
            { id: "remove", danger: true },
            ofKind("copyLink"),
            { id: "deleteTagged", kind: "delete", danger: true },
            { id: "dangerousCreate", kind: "newProject", danger: true },
            ofKind("reply"),
        ];
        const ordered = ids(orderMoreMenuItems(items));
        expect(ordered.slice(0, 2)).toEqual(["reply", "copyLink"]);
        // The destructive ones keep their written order among themselves.
        expect(ordered.slice(2)).toEqual(["remove", "deleteTagged", "dangerousCreate"]);
    });

    it("keeps the written order of items of the same kind", () => {
        const items: Item[] = [
            ofKind("copyLink", "a"),
            ofKind("reply", "b"),
            ofKind("copyLink", "c"),
            ofKind("reply", "d"),
            ofKind("copyLink", "e"),
        ];
        expect(ids(orderMoreMenuItems(items))).toEqual(["b", "d", "a", "c", "e"]);
    });

    it("skips hidden items and does not let them hold a position", () => {
        const items: Item[] = [
            { ...ofKind("reply"), visible: false },
            ofKind("copyLink"),
            { ...ofKind("edit"), visible: false },
            { ...ofKind("delete"), danger: true, visible: true },
            { id: "untaggedHidden", visible: false },
        ];
        expect(ids(orderMoreMenuItems(items))).toEqual(["copyLink", "delete"]);
    });

    it("treats a missing `visible` as shown", () => {
        expect(ids(orderMoreMenuItems([ofKind("edit"), ofKind("reply")]))).toEqual([
            "reply",
            "edit",
        ]);
    });

    it("keeps an untagged item beside the item written before it", () => {
        const items: Item[] = [
            ofKind("copyLink"),
            { id: "mine" },
            ofKind("reply"),
            { id: "mineToo" },
            { id: "last", danger: true },
        ];
        // `mine` stays behind Copy link, `mineToo` behind Reply — and nothing
        // untagged can end up after Delete.
        expect(ids(orderMoreMenuItems(items))).toEqual([
            "reply",
            "mineToo",
            "copyLink",
            "mine",
            "last",
        ]);
        // An untagged item written first stays first.
        expect(ids(orderMoreMenuItems([{ id: "lead" }, ofKind("reply"), ofKind("edit")]))).toEqual(
            ["lead", "reply", "edit"]
        );
    });

    it("does not reorder the array it was given", () => {
        const items = [ofKind("delete"), ofKind("reply")];
        orderMoreMenuItems(items);
        expect(ids(items)).toEqual(["delete", "reply"]);
    });
});
