import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    deleteTeamNoteTemplate,
    loadTeamNoteTemplate,
    loadTeamNoteTemplates,
    saveTeamNoteTemplate,
} from "../features/notes/templates/teamNoteTemplates";
import {
    buildTemplateMenuItems,
    defaultTemplatePick,
    resolveTemplate,
} from "../features/notes/templates/templateMenuItems";
import { en } from "../i18n/locales/en";

const api = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
}));
vi.mock("../services/api", () => ({ authApi: () => api }));

const copy = en.notes.noteTemplates;
const myself = { teamId: "team-1", userId: "u1" } as never;
const row = (templateId: number, name: string) => ({
    templateId,
    teamId: "team-1",
    name,
    title: "",
    defaultFolderId: null,
    createdBy: "u1",
    createdByName: "ann",
});

beforeEach(() => vi.clearAllMocks());

describe("team note templates: menu (MIP-1697)", () => {
    it("lists team templates after the built-ins and a manage row last", () => {
        const onManage = vi.fn();
        const items = buildTemplateMenuItems({
            copy,
            idPrefix: "p",
            teamTemplates: [row(7, "Weekly sync"), row(9, "Retro")],
            onPick: vi.fn(),
            onManage,
        });
        expect(items.map((i) => i.id)).toEqual([
            "p-tpl-meeting",
            "p-tpl-decision",
            "p-tpl-brief",
            "p-tpl-team-7",
            "p-tpl-team-9",
            "p-tpl-manage",
        ]);
        expect(items[3].label).toBe("Weekly sync");
        expect(items[5].kind).toBe("manageTemplates");
        items[5].onClick?.();
        expect(onManage).toHaveBeenCalled();
    });

    it("a team row picks by template id", () => {
        const onPick = vi.fn();
        const items = buildTemplateMenuItems({
            copy,
            idPrefix: "p",
            teamTemplates: [row(7, "Weekly sync")],
            onPick,
        });
        items[3].onClick?.();
        expect(onPick).toHaveBeenCalledWith({ kind: "team", templateId: 7 });
    });

    it("no manage row unless a handler is given", () => {
        const items = buildTemplateMenuItems({ copy, idPrefix: "p", onPick: vi.fn() });
        expect(items.some((i) => i.kind === "manageTemplates")).toBe(false);
    });

    it("resolves a team pick through the loader and fills {date}", async () => {
        const load = vi.fn().mockResolvedValue({
            ...row(7, "Weekly"),
            title: "Sync {date}",
            body: [{ type: "paragraph" }],
        });
        const out = await resolveTemplate({ kind: "team", templateId: 7 }, copy, load);
        expect(load).toHaveBeenCalledWith(7);
        expect(out?.title).toMatch(/^Sync \d{4}-\d{2}-\d{2}$/);
        expect(out?.blocks).toEqual([{ type: "paragraph" }]);
    });

    it("a team pick that cannot be loaded resolves to null", async () => {
        const out = await resolveTemplate(
            { kind: "team", templateId: 7 },
            copy,
            vi.fn().mockResolvedValue(null)
        );
        expect(out).toBeNull();
    });

    it("a folder default is used only while the template still exists", () => {
        const list = [row(7, "A")];
        expect(defaultTemplatePick({ defaultTemplateId: 7 }, list)).toEqual({
            kind: "team",
            templateId: 7,
        });
        expect(defaultTemplatePick({ defaultTemplateId: 8 }, list)).toBeNull();
        expect(defaultTemplatePick({ defaultTemplateId: null }, list)).toBeNull();
        expect(defaultTemplatePick({}, list)).toBeNull();
    });
});

describe("team note templates: API (MIP-1697)", () => {
    it("lists, reads one, saves (create and update) and deletes", async () => {
        api.get.mockResolvedValueOnce({ data: [row(1, "A")] });
        expect(await loadTeamNoteTemplates(myself, "tok")).toHaveLength(1);
        expect(api.get).toHaveBeenCalledWith("/note/template/", { params: { team_id: "team-1" } });

        api.get.mockResolvedValueOnce({ data: { ...row(1, "A"), body: [] } });
        expect((await loadTeamNoteTemplate(myself, 1, "tok"))?.body).toEqual([]);
        expect(api.get).toHaveBeenLastCalledWith("/note/template/", {
            params: { team_id: "team-1", template_id: 1 },
        });

        api.post.mockResolvedValueOnce({ data: { ...row(2, "B"), body: [] } });
        await saveTeamNoteTemplate(
            myself,
            { name: "B", title: "t", body: [], defaultFolderId: 5 },
            "tok"
        );
        expect(api.post).toHaveBeenCalledWith("/note/template/", {
            team_id: "team-1",
            name: "B",
            title: "t",
            body: [],
            default_folder_id: 5,
        });

        api.put.mockResolvedValueOnce({ data: { ...row(2, "B2"), body: [] } });
        await saveTeamNoteTemplate(
            myself,
            { templateId: 2, name: "B2", defaultFolderId: null },
            "tok"
        );
        expect(api.put).toHaveBeenCalledWith("/note/template/", {
            team_id: "team-1",
            template_id: 2,
            name: "B2",
            default_folder_id: null,
        });

        api.delete.mockResolvedValueOnce({});
        expect(await deleteTeamNoteTemplate(myself, 2, "tok")).toBe(true);
        expect(api.delete).toHaveBeenCalledWith("/note/template/", {
            data: { team_id: "team-1", template_id: 2 },
        });
    });

    it("returns empty / null / false on failure instead of throwing", async () => {
        api.get.mockRejectedValue(new Error("x"));
        api.delete.mockRejectedValue(new Error("x"));
        expect(await loadTeamNoteTemplates(myself, "tok")).toEqual([]);
        expect(await loadTeamNoteTemplate(myself, 1, "tok")).toBeNull();
        expect(await deleteTeamNoteTemplate(myself, 1, "tok")).toBe(false);
    });
});
