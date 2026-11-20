/**
 * The sample data a team was made with (MIP-1706): `/api/v2/team/sample-data/`.
 *
 * `GET` previews what one action would remove and what would stay; `POST` removes exactly
 * that. Both are the team owner's alone. Nothing here is the authorization check: the server
 * answers 403 to anyone else, and the panel is only rendered for the owner.
 */
import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

export type SampleDataType =
    | "channel"
    | "project"
    | "note"
    | "note_folder"
    | "todo_item"
    | "todo_category"
    | "mention_group"
    | "project_label";

/** Why an object stays. Stable codes from the server; the panel translates them. */
export type SampleDataKeepReason =
    | "project_changed"
    | "note_edited"
    | "todo_edited"
    | "chat_in_use"
    | "folder_in_use"
    | "group_in_use"
    | "label_in_use"
    | "category_in_use";

export type SampleDataEntry = {
    type: SampleDataType;
    id: string;
    name: string;
    /** Only on what stays (or, in a result, on what failed: the error's class name). */
    reason?: string;
    detail?: Record<string, number | boolean>;
};

export type SampleDataPreview = {
    /** False when the team has no markers at all (made before this existed, or without samples). */
    recorded: boolean;
    nothingToRemove: boolean;
    remove: SampleDataEntry[];
    keep: SampleDataEntry[];
    counts: Partial<Record<SampleDataType, number>>;
    /** What the removed projects hold: `{ tasks, milestones }`. */
    contents: { tasks?: number; milestones?: number };
    alreadyGone: number;
};

export type SampleDataResult = {
    recorded: boolean;
    nothingToRemove: boolean;
    /** False when something could not be removed: a second run tries it again. */
    complete: boolean;
    removed: SampleDataEntry[];
    kept: SampleDataEntry[];
    failed: SampleDataEntry[];
    counts: Partial<Record<SampleDataType, number>>;
    contents: { tasks?: number; milestones?: number };
    alreadyGone: number;
};

const failure = (error: unknown, fallback: string): Error => {
    if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { error?: string } | undefined)?.error;
        return new Error(message || fallback);
    }
    return new Error(fallback);
};

/** The preview. Throws an Error with a sentence the dialog can show. */
export const loadSampleDataPreview = async (
    accessToken: string | null,
    teamId: string
): Promise<SampleDataPreview> => {
    const fallback = getMessages().admin.sampleData.loadFailed;
    const api = authApi(accessToken);
    if (!api) throw new Error(fallback);
    try {
        const res = await api.get<SampleDataPreview>("/team/sample-data/", {
            params: { team_id: teamId },
            suppressErrorToast: true,
        });
        return res.data;
    } catch (error: unknown) {
        throw failure(error, fallback);
    }
};

/** Remove it. Throws an Error with the server's reason, which keeps the dialog open. */
export const removeSampleData = async (
    accessToken: string | null,
    teamId: string
): Promise<SampleDataResult> => {
    const fallback = getMessages().admin.sampleData.removeFailed;
    const api = authApi(accessToken);
    if (!api) throw new Error(fallback);
    try {
        const res = await api.post<SampleDataResult>(
            "/team/sample-data/",
            { team_id: teamId },
            { suppressErrorToast: true }
        );
        return res.data;
    } catch (error: unknown) {
        throw failure(error, fallback);
    }
};
