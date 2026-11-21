/**
 * MIP-1847: the create-team refusal now carries a stable `code` (and `field`) from genos-api, and
 * the app reads it first. The English text is still matched when there is no code (an API from
 * before MIP-1847, or a response that does not say), so this works before and after the API
 * deploys. The codes below are the ones `TeamMasterView.post` and `parse_departments` send.
 */
import { describe, expect, it } from "vitest";

import {
    classifyTeamCreateFailure,
    teamCreateCopy,
} from "../features/admin/services/teamCreateFailure";
import { getMessages } from "../i18n";

const copy = teamCreateCopy(getMessages());
const HINT = "Try with different team_name";

const classify = (data: unknown) => classifyTeamCreateFailure({ status: 400, data }, copy);

describe("classifyTeamCreateFailure reads the API code first (MIP-1847)", () => {
    it("a unique team_name is the taken-name line, whatever the words say", () => {
        expect(
            classify({
                team_name: ["Team name in use."],
                codes: { team_name: "unique" },
                field: "team_name",
                code: "unique",
                hint: HINT,
            })
        ).toEqual({ field: "teamName", message: copy.duplicateTeamName });
    });

    it("a blank team_name is the name-check line, even if the words mention 'already exists'", () => {
        expect(
            classify({
                team_name: ["team master with this team name already exists."],
                codes: { team_name: "blank" },
                field: "team_name",
                code: "blank",
                hint: HINT,
            })
        ).toEqual({ field: "teamName", message: copy.teamNameInvalid });
    });

    it("an invalid team_email is the form-level address line", () => {
        expect(
            classify({
                team_email: ["Enter a valid email address."],
                codes: { team_email: "invalid" },
                field: "team_email",
                code: "invalid",
            })
        ).toEqual({ field: "form", message: copy.teamEmailFailed });
    });

    it("a unique team_email is the same form-level address line", () => {
        expect(
            classify({
                team_email: ["team master with this team email already exists."],
                codes: { team_email: "unique" },
                field: "team_email",
                code: "unique",
            })
        ).toEqual({ field: "form", message: copy.teamEmailFailed });
    });

    it("an unknown team_name code is a name problem, not the taken-name line", () => {
        expect(
            classify({
                team_name: ["Something new."],
                codes: { team_name: "some_new_code" },
                field: "team_name",
                code: "some_new_code",
            })
        ).toEqual({ field: "teamName", message: copy.teamNameInvalid });
    });

    it("too_many_departments is the too-many line, whatever the words say", () => {
        expect(
            classify({ error: "x", code: "too_many_departments", field: "departments" })
        ).toEqual({
            field: "departments",
            message: copy.departmentsTooMany.replace("{max}", "20"),
        });
    });

    it("department_name_too_long is the too-long line", () => {
        expect(
            classify({ error: "x", code: "department_name_too_long", field: "departments" })
        ).toEqual({
            field: "departments",
            message: copy.departmentsTooLong.replace("{max}", "30"),
        });
    });

    it("department_name_invalid and departments_not_a_list are the generic departments line", () => {
        for (const code of ["department_name_invalid", "departments_not_a_list"]) {
            expect(classify({ error: "x", code, field: "departments" })).toEqual({
                field: "departments",
                message: copy.invalidDepartments,
            });
        }
    });

    it("the legacy invalid_departments code still falls back to the text", () => {
        expect(
            classify({ error: "At most 20 departments at a time.", code: "invalid_departments" })
        ).toEqual({
            field: "departments",
            message: copy.departmentsTooMany.replace("{max}", "20"),
        });
    });
});

describe("classifyTeamCreateFailure falls back to the text when there is no code (MIP-1847)", () => {
    it("a taken name with no code is still the taken-name line", () => {
        expect(
            classify({
                team_name: ["team master with this team name already exists."],
                hint: HINT,
            })
        ).toEqual({ field: "teamName", message: copy.duplicateTeamName });
    });

    it("an address with no code and no field is still the address line", () => {
        expect(classify({ team_email: ["Enter a valid email address."], hint: HINT })).toEqual({
            field: "form",
            message: copy.teamEmailFailed,
        });
    });
});
