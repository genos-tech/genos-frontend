/**
 * `isNoteEditable` — the editors' edit-vs-view decision (MIP-731).
 *
 * The explicit member list only knows `NotePermissionMaster` rows. A user
 * who reaches a Team Note through a folder grant has none, so the explicit
 * role is `null` — which used to mean "editable" — while the server
 * resolves them to Viewer and, since MIP-714, opens their collab
 * connection read-only and drops every keystroke. The collab scope is the
 * server's answer, so it has to win.
 */

import { describe, expect, it } from "vitest";

import {
    isNoteEditable,
    NOTE_ROLE_EDITOR,
    NOTE_ROLE_OWNER,
    NOTE_ROLE_VIEWER,
} from "../features/notes/common/utils/noteRoles";

describe("isNoteEditable", () => {
    it("is read-only for a folder-granted viewer: no explicit role, read-only collab scope", () => {
        expect(isNoteEditable(null, "readonly")).toBe(false);
    });

    it("stays editable for the implicit owner of an unshared note", () => {
        expect(isNoteEditable(null, "read-write")).toBe(true);
    });

    it("leaves the explicit role in charge until collab has authenticated", () => {
        expect(isNoteEditable(null, undefined)).toBe(true);
        expect(isNoteEditable(NOTE_ROLE_VIEWER, undefined)).toBe(false);
    });

    it("keeps an explicit viewer read-only whatever the scope", () => {
        expect(isNoteEditable(NOTE_ROLE_VIEWER, "read-write")).toBe(false);
    });

    it("follows the server when an explicit editor's role changed after the list loaded", () => {
        expect(isNoteEditable(NOTE_ROLE_EDITOR, "readonly")).toBe(false);
        expect(isNoteEditable(NOTE_ROLE_OWNER, "read-write")).toBe(true);
    });
});
