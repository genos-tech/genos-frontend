import type { Messages } from "../../../i18n/types";
import { MAX_DEPARTMENT_NAME_LENGTH, MAX_DEPARTMENTS } from "../utils/departments";

// Which part of the create-team form a refused `POST /team/create/` belongs to (MIP-1841).
//
// The API answers a refused create in three shapes (genos-api `TeamMasterView.post`):
// - a field error, the DRF serializer's messages keyed by field, plus one generic `hint`:
//   `{"team_name": ["team master with this team name already exists."], "hint": "Try with different team_name"}`
//   The `hint` is the same line for every field, so it says nothing about which one; the key does.
// - a department refusal: `{"error": "At most 20 departments at a time.", "code": "invalid_departments"}`
// - nothing structured: a 401, a 429, a 5xx (possibly an HTML page), no response at all.
//
// The API sends no code for a serializer error, only English text, so the one split this module
// makes inside a field (a taken name vs. any other name problem) reads the DRF phrase "already exists".

export type TeamCreateField = "teamName" | "departments" | "form";

export type TeamCreateFailure = { field: TeamCreateField; message: string };

export type TeamCreateCopy = {
    network: string;
    unauthorized: string;
    rateLimited: string;
    serverError: string;
    generic: string;
    duplicateTeamName: string;
    teamNameInvalid: string;
    invalidDepartments: string;
    departmentsTooMany: string;
    departmentsTooLong: string;
    teamEmailFailed: string;
};

/** What came back: the HTTP status, or `null` when there was no response at all. */
export type TeamCreateResponse = { status: number | null; data: unknown };

export const teamCreateCopy = (messages: Messages): TeamCreateCopy => ({
    ...messages.admin.auth.errors,
    departmentsTooMany: messages.admin.joinTeam.departmentsTooMany,
    departmentsTooLong: messages.admin.joinTeam.departmentsTooLong,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const fieldText = (value: unknown): string =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string").join(" ")
        : typeof value === "string"
          ? value
          : "";

export const classifyTeamCreateFailure = (
    { status, data }: TeamCreateResponse,
    copy: TeamCreateCopy
): TeamCreateFailure => {
    if (status === null) return { field: "form", message: copy.network };
    if (status === 401) return { field: "form", message: copy.unauthorized };
    if (status === 429) return { field: "form", message: copy.rateLimited };
    if (status >= 500) return { field: "form", message: copy.serverError };

    if (status === 400 && isRecord(data)) {
        if (data.code === "invalid_departments") {
            const text = typeof data.error === "string" ? data.error : "";
            if (text.startsWith("At most ")) {
                return {
                    field: "departments",
                    message: copy.departmentsTooMany.replace("{max}", String(MAX_DEPARTMENTS)),
                };
            }
            if (text.includes("characters")) {
                return {
                    field: "departments",
                    message: copy.departmentsTooLong.replace(
                        "{max}",
                        String(MAX_DEPARTMENT_NAME_LENGTH)
                    ),
                };
            }
            return { field: "departments", message: copy.invalidDepartments };
        }
        if ("team_name" in data) {
            return /already exists/i.test(fieldText(data.team_name))
                ? { field: "teamName", message: copy.duplicateTeamName }
                : { field: "teamName", message: copy.teamNameInvalid };
        }
        // The address is built by the app (`teamEmailFor`), not typed by the person, so there is
        // no field of theirs to point at: the form-level line says what to do.
        if ("team_email" in data) return { field: "form", message: copy.teamEmailFailed };
    }

    return { field: "form", message: copy.generic };
};
