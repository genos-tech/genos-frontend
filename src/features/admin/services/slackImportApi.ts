/**
 * Slack export import (MIP-1836): preview, import, undo. The server reads the ZIP; the preview is
 * stateless, so the same file is sent again at the import and is kept in memory only.
 */
import axios from "axios";

import { authApi } from "../../../services/api";

export type SlackUserStatus = "matched" | "unmatched" | "no_email" | "bot" | "deleted";

export interface SlackPreviewUser {
    slack_id: string;
    name: string;
    email: string;
    status: SlackUserStatus;
    genos_user: { id: string; username: string } | null;
    message_count: number;
}

export interface SlackPreviewChannel {
    slack_id: string;
    name: string;
    is_private: boolean;
    is_archived: boolean;
    is_general: boolean;
    message_count: number;
    already_imported: number;
    target: { action: "create" | "existing" | "skip"; title: string };
    member_count: number;
    warnings: string[];
}

export interface SlackPreview {
    file_sha256: string;
    limits: { max_zip_mb: number; max_channels: number; max_messages: number };
    counts: {
        channels: number;
        to_create: number;
        existing: number;
        messages: number;
        already_imported: number;
        replies: number;
        threads: number;
        reactions: number;
        files: number;
    };
    warnings: { code: string; count?: number }[];
    users: SlackPreviewUser[];
    channels: SlackPreviewChannel[];
}

export interface SlackRun {
    run_id: string;
    channels_created: number;
    messages_created: number;
    skipped: number;
    failed: number;
    report: { channel: string; outcome: "imported" | "skipped" | "failed"; channel_id?: string }[];
}

/** What the server refused with: a code the dialog words, and the limit it names. */
export class SlackImportError extends Error {
    code: string;
    limit?: number;
    constructor(code: string, limit?: number) {
        super(code);
        this.code = code;
        this.limit = limit;
    }
}

const client = (accessToken: string | null) => {
    const api = authApi(accessToken);
    if (!api) throw new SlackImportError("unauthorized");
    return api;
};

const toError = (e: unknown): SlackImportError => {
    if (axios.isAxiosError(e)) {
        const data = e.response?.data as
            | { code?: string; limit?: number; limit_mb?: number }
            | undefined;
        if (data?.code) return new SlackImportError(data.code, data.limit ?? data.limit_mb);
        if (e.response?.status === 413) return new SlackImportError("file_too_large");
    }
    return new SlackImportError("generic");
};

const form = (teamId: string, file: File, channelIds?: string[]): FormData => {
    const f = new FormData();
    f.append("file", file);
    f.append("team_id", teamId);
    if (channelIds) f.append("channel_ids", JSON.stringify(channelIds));
    return f;
};

// The global error toast is off: the dialog words the refusal itself, next to the file.
const config = { suppressErrorToast: true, headers: { "Content-Type": "multipart/form-data" } };

export const previewSlackImport = async (
    accessToken: string | null,
    teamId: string,
    file: File,
    channelIds?: string[]
): Promise<SlackPreview> => {
    try {
        const res = await client(accessToken).post<SlackPreview>(
            "/team/import/slack/preview/",
            form(teamId, file, channelIds),
            config
        );
        return res.data;
    } catch (e) {
        throw toError(e);
    }
};

export const commitSlackImport = async (
    accessToken: string | null,
    teamId: string,
    file: File,
    channelIds: string[]
): Promise<SlackRun> => {
    try {
        const res = await client(accessToken).post<SlackRun>(
            "/team/import/slack/",
            form(teamId, file, channelIds),
            config
        );
        return res.data;
    } catch (e) {
        throw toError(e);
    }
};

export interface SlackUndoPlan {
    will_remove_messages: number;
    will_delete_channels: number;
    kept: number;
}

export const previewUndoSlackImport = async (
    accessToken: string | null,
    teamId: string,
    runId: string
): Promise<SlackUndoPlan> => {
    try {
        const res = await client(accessToken).get<SlackUndoPlan>(
            `/team/import/slack/runs/${runId}/undo/`,
            { params: { team_id: teamId }, suppressErrorToast: true }
        );
        return res.data;
    } catch (e) {
        throw toError(e);
    }
};

export const undoSlackImport = async (
    accessToken: string | null,
    teamId: string,
    runId: string
): Promise<{ removed_messages: number; deleted_channels: number; kept: number }> => {
    try {
        const res = await client(accessToken).post(
            `/team/import/slack/runs/${runId}/undo/`,
            { team_id: teamId },
            { suppressErrorToast: true }
        );
        return res.data;
    } catch (e) {
        throw toError(e);
    }
};
