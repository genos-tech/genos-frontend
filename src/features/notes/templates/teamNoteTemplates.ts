import type { PartialBlock } from "@blocknote/core";
import axios from "axios";

import { authApi } from "../../../services/api";
import type { UserProps } from "../../../types/admin";

// MIP-1697. Team-defined note templates: /api/v2/note/template/ (genos-api). Any team member
// reads and creates; the creator or the team owner changes or deletes. Every call answers with
// an empty value instead of throwing: the menus must keep working when this endpoint is down.

export type NoteTemplateScope = "team" | "personal";

export type TeamNoteTemplate = {
    templateId: number;
    // MIP-2337: a personal template belongs to one person (no team) and is listed only for them.
    // An older server sends no scope: those rows are team templates.
    scope?: NoteTemplateScope;
    teamId: string | null;
    name: string;
    title: string;
    defaultFolderId: number | null;
    createdBy: string | null;
    createdByName: string | null;
    // The list leaves the body out; one template read carries it.
    body?: PartialBlock[];
};

const logFailure = (error: unknown) => {
    if (axios.isAxiosError(error)) {
        console.error("API error:", error.response?.status, error.response?.data);
    } else {
        console.error("Unexpected error:", error);
    }
};

export const loadTeamNoteTemplates = async (
    myself: UserProps,
    accessToken: string | null
): Promise<TeamNoteTemplate[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) return [];
        const res = await api.get("/note/template/", { params: { team_id: myself.teamId } });
        return Array.isArray(res.data) ? res.data : [];
    } catch (error: unknown) {
        logFailure(error);
        return [];
    }
};

export const loadTeamNoteTemplate = async (
    myself: UserProps,
    templateId: number,
    accessToken: string | null
): Promise<TeamNoteTemplate | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get("/note/template/", {
            params: { team_id: myself.teamId, template_id: templateId },
        });
        return res.data ?? null;
    } catch (error: unknown) {
        logFailure(error);
        return null;
    }
};

export type SaveTeamNoteTemplateInput = {
    // Absent = create.
    templateId?: number;
    // Create only: who can use it. An edit keeps the row's own scope.
    scope?: NoteTemplateScope;
    name?: string;
    title?: string;
    body?: PartialBlock[];
    // null clears the folder default, a number sets it, absent leaves it alone.
    defaultFolderId?: number | null;
};

export const saveTeamNoteTemplate = async (
    myself: UserProps,
    input: SaveTeamNoteTemplateInput,
    accessToken: string | null
): Promise<TeamNoteTemplate | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const payload: Record<string, unknown> = { team_id: myself.teamId };
        if (input.scope === "personal") payload.scope = "personal";
        if (input.templateId !== undefined) payload.template_id = input.templateId;
        if (input.name !== undefined) payload.name = input.name;
        if (input.title !== undefined) payload.title = input.title;
        if (input.body !== undefined) payload.body = input.body;
        if (input.defaultFolderId !== undefined) payload.default_folder_id = input.defaultFolderId;
        const res =
            input.templateId === undefined
                ? await api.post("/note/template/", payload)
                : await api.put("/note/template/", payload);
        return res.data ?? null;
    } catch (error: unknown) {
        logFailure(error);
        return null;
    }
};

export const deleteTeamNoteTemplate = async (
    myself: UserProps,
    templateId: number,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) return false;
        await api.delete("/note/template/", {
            data: { team_id: myself.teamId, template_id: templateId },
        });
        return true;
    } catch (error: unknown) {
        logFailure(error);
        return false;
    }
};
