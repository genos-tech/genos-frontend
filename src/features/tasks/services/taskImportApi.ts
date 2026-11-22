/**
 * CSV task import (MIP-1835): preview, commit, and undo. The server does all the reading; the
 * preview is stateless, so the same file is sent again at commit.
 */
import axios from "axios";

import { authApi } from "../../../services/api";

export type ImportProfile = "jira" | "jira_json" | "notion" | "generic";

export type ImportField =
    | "title"
    | "description"
    | "status"
    | "priority"
    | "assignee"
    | "due_date"
    | "start_date"
    | "tags"
    | "parent"
    | "external_id";

/** {field: [column index, ...]}: a field not in the map is not used. */
export type ImportMapping = Partial<Record<ImportField, number[]>>;

export interface ImportIssue {
    code: string;
    value?: string;
    field?: string;
}

export interface ImportPreviewRow {
    row: number;
    title: string;
    status: string;
    priority: string | null;
    due_date: string | null;
    assignee_email: string;
    tags: string[];
    parent_row: number | null;
    errors: ImportIssue[];
    warnings: ImportIssue[];
    already_imported: boolean;
    /** Jira JSON only (MIP-1837): how many comments the issue brings. */
    comment_count?: number;
}

export interface ImportValueCount {
    value: string;
    count: number;
    mapped: string | null;
}

export interface ImportPreview {
    profile: ImportProfile;
    headers: string[];
    mapping: ImportMapping;
    counts: {
        rows: number;
        errors: number;
        warnings: number;
        already_imported: number;
        to_create: number;
    };
    new_tags: string[];
    status_values: ImportValueCount[];
    priority_values: ImportValueCount[];
    limits: { max_rows: number };
    rows: ImportPreviewRow[];
}

export interface ImportReportEntry {
    row: number;
    outcome: "created" | "skipped" | "failed" | "warning";
    code?: string;
    display_id?: string;
}

export interface ImportRun {
    run_id: string;
    created: number;
    skipped: number;
    failed: number;
    report: ImportReportEntry[];
}

export interface ImportOptions {
    projectId: number;
    file: File;
    mapping?: ImportMapping;
    statusMap?: Record<string, string>;
    priorityMap?: Record<string, string>;
    createTags?: boolean;
}

/** What the server refused with: a code the dialog words, and the limit it names. */
export class TaskImportError extends Error {
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
    if (!api) throw new TaskImportError("unauthorized");
    return api;
};

const toError = (e: unknown): TaskImportError => {
    if (axios.isAxiosError(e)) {
        const data = e.response?.data as
            | { code?: string; limit?: number; limit_mb?: number; limit_reached?: boolean }
            | undefined;
        if (e.response?.status === 429 || data?.limit_reached) return new TaskImportError("quota");
        if (data?.code) return new TaskImportError(data.code, data.limit ?? data.limit_mb);
        if (e.response?.status === 413)
            return new TaskImportError("file_too_large", data?.limit_mb);
    }
    return new TaskImportError("generic");
};

const form = (o: ImportOptions): FormData => {
    const f = new FormData();
    f.append("file", o.file);
    f.append("project_id", String(o.projectId));
    if (o.mapping) f.append("mapping", JSON.stringify(o.mapping));
    if (o.statusMap) f.append("status_map", JSON.stringify(o.statusMap));
    if (o.priorityMap) f.append("priority_map", JSON.stringify(o.priorityMap));
    if (o.createTags) f.append("create_tags", "true");
    return f;
};

// The global error toast is off: the dialog words the refusal itself, next to the file.
const config = { suppressErrorToast: true, headers: { "Content-Type": "multipart/form-data" } };

export const previewTaskImport = async (
    accessToken: string | null,
    options: ImportOptions
): Promise<ImportPreview> => {
    try {
        const res = await client(accessToken).post<ImportPreview>(
            "/task/import/preview/",
            form(options),
            config
        );
        return res.data;
    } catch (e) {
        throw toError(e);
    }
};

export const commitTaskImport = async (
    accessToken: string | null,
    options: ImportOptions
): Promise<ImportRun> => {
    try {
        const res = await client(accessToken).post<ImportRun>(
            "/task/import/",
            form(options),
            config
        );
        return res.data;
    } catch (e) {
        throw toError(e);
    }
};

export const previewUndoTaskImport = async (
    accessToken: string | null,
    runId: string
): Promise<{ will_remove: number; kept: number }> => {
    try {
        const res = await client(accessToken).get(`/task/import/runs/${runId}/undo/`, {
            suppressErrorToast: true,
        });
        return res.data;
    } catch (e) {
        throw toError(e);
    }
};

export const undoTaskImport = async (
    accessToken: string | null,
    runId: string
): Promise<{ removed: number; kept: number }> => {
    try {
        const res = await client(accessToken).post(
            `/task/import/runs/${runId}/undo/`,
            {},
            { suppressErrorToast: true }
        );
        return res.data;
    } catch (e) {
        throw toError(e);
    }
};
