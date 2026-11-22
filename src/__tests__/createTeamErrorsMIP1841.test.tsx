/**
 * MIP-1841: every refused create-team says what was wrong and where. Before, every HTTP 400 read
 * "Please try with different team name." (the service and the first-run form), a network failure
 * or a 5xx page showed nothing or a raw JavaScript error, and no message sat next to its field.
 *
 * The response bodies below are the shapes genos-api returns from `TeamMasterView.post`
 * (`origin/views/common/team_views.py`): DRF serializer errors keyed by field plus the generic
 * `hint`, the `invalid_departments` refusal from `parse_departments`, and the bare 401/429/5xx.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JoinTeam } from "../features/admin/components/joinTeamFrom";
import { ModalCreateTeam } from "../features/admin/components/modals/ModalCreateTeam";
import { createTeam } from "../features/admin/services/createTeam";
import {
    classifyTeamCreateFailure,
    teamCreateCopy,
    type TeamCreateFailure,
} from "../features/admin/services/teamCreateFailure";
import { getMessages } from "../i18n";
import { en } from "../i18n/locales/en";

const copy = teamCreateCopy(getMessages());
const HINT = "Try with different team_name";

// --- the classifier, on recorded API responses -------------------------------------------------

describe("classifyTeamCreateFailure (MIP-1841)", () => {
    const cases: [string, { status: number | null; data?: unknown }, TeamCreateFailure][] = [
        [
            "a taken team name is a team-name error, with the taken-name line",
            {
                status: 400,
                data: {
                    team_name: ["team master with this team name already exists."],
                    hint: HINT,
                },
            },
            { field: "teamName", message: copy.duplicateTeamName },
        ],
        [
            "an empty team name is a team-name error, not the taken-name line",
            { status: 400, data: { team_name: ["This field may not be blank."], hint: HINT } },
            { field: "teamName", message: copy.teamNameInvalid },
        ],
        [
            "a refused team address is a form-level error (the person does not type it)",
            {
                status: 400,
                data: { team_email: ["Enter a valid email address."], hint: HINT },
            },
            { field: "form", message: copy.teamEmailFailed },
        ],
        [
            "a duplicate team address is the same form-level error",
            {
                status: 400,
                data: {
                    team_email: ["team master with this team email already exists."],
                    hint: HINT,
                },
            },
            { field: "form", message: copy.teamEmailFailed },
        ],
        [
            "too many departments names the limit, next to the departments",
            {
                status: 400,
                data: {
                    error: "At most 20 departments at a time.",
                    code: "invalid_departments",
                },
            },
            {
                field: "departments",
                message: en.admin.joinTeam.departmentsTooMany.replace("{max}", "20"),
            },
        ],
        [
            "a department name over thirty characters names the limit",
            {
                status: 400,
                data: {
                    error: "A department name can be at most 30 characters: xxxxxxxxxxxxxxxxxxxx…",
                    code: "invalid_departments",
                },
            },
            {
                field: "departments",
                message: en.admin.joinTeam.departmentsTooLong.replace("{max}", "30"),
            },
        ],
        [
            "a department with no letter or digit is the list refusal",
            {
                status: 400,
                data: {
                    error: "A department name needs a letter or a digit: ###",
                    code: "invalid_departments",
                },
            },
            { field: "departments", message: copy.invalidDepartments },
        ],
        [
            "an unauthorized create says so, at the form",
            { status: 401, data: { detail: "Authentication credentials were not provided." } },
            { field: "form", message: copy.unauthorized },
        ],
        [
            "a throttled create says to wait",
            {
                status: 429,
                data: { detail: "Request was throttled. Expected available in 60 seconds." },
            },
            { field: "form", message: copy.rateLimited },
        ],
        [
            "a server error says to try again later",
            { status: 500, data: "<html>Server Error (500)</html>" },
            { field: "form", message: copy.serverError },
        ],
        [
            "a bad gateway (an HTML page from the proxy) is the same",
            { status: 502, data: "<html>Bad Gateway</html>" },
            { field: "form", message: copy.serverError },
        ],
        [
            "no response at all is a network error",
            { status: null },
            { field: "form", message: copy.network },
        ],
        [
            "an owner the server refuses is unknown: the generic line",
            { status: 400, data: { error: "owner_id must be your own user id." } },
            { field: "form", message: copy.generic },
        ],
    ];

    it.each(cases)("%s", (_label, response, expected) => {
        expect(
            classifyTeamCreateFailure({ status: response.status, data: response.data }, copy)
        ).toEqual(expected);
    });

    it("never shows the taken-name line for anything but a taken name", () => {
        for (const [, response] of cases) {
            const failure = classifyTeamCreateFailure(
                { status: response.status, data: response.data },
                copy
            );
            if (failure.message === copy.duplicateTeamName) {
                expect(response.data).toMatchObject({ team_name: expect.any(Array) });
            }
        }
    });
});

// --- the first-run form: the message sits by its field --------------------------------------

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok", setAccessToken: vi.fn() }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("socket.io-client", () => ({
    io: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }),
}));
vi.mock("../hooks/common/useWebSocket", () => ({ wsJoinTeamHook: vi.fn() }));
vi.mock("../features/admin/services/loadMyTeams", () => ({
    loadMyTeams: vi.fn().mockResolvedValue([]),
    membershipTeams: (teams: unknown[]) => teams,
}));
vi.mock("../features/admin/services/joinTeam", () => ({
    joinTeam: vi.fn().mockResolvedValue(true),
}));
vi.mock("../features/admin/services/createTeam", () => ({
    createTeam: vi.fn(),
}));
vi.mock("../services/privateProfileStore", () => ({
    clearPrivateProfile: vi.fn(),
    ensurePrivateProfile: vi.fn().mockResolvedValue(null),
}));

const joinCopy = en.admin.joinTeam;

const mountJoin = (failure: TeamCreateFailure | null) => {
    localStorage.setItem("userId", "u1");
    vi.mocked(createTeam).mockImplementation(async (...args) => {
        if (failure) args[3]?.(failure);
        return undefined;
    });
    render(
        <CssVarsProvider>
            <JoinTeam />
        </CssVarsProvider>
    );
    fireEvent.change(screen.getByPlaceholderText(joinCopy.teamNamePlaceholder), {
        target: { value: "Acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: joinCopy.createTeam }));
};

describe("the first-run create form shows each refusal by its field (MIP-1841)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("a taken name: the line is in the team-name field's own wrapper, not an alert", async () => {
        mountJoin({ field: "teamName", message: copy.duplicateTeamName });

        const nameInput = screen.getByPlaceholderText(joinCopy.teamNamePlaceholder);
        const message = await screen.findByText(copy.duplicateTeamName);
        const nameField = nameInput.closest(".MuiFormControl-root") as HTMLElement;
        expect(nameField.contains(message)).toBe(true);
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("a bad department list: the line sits in the departments box's wrapper", async () => {
        mountJoin({ field: "departments", message: copy.invalidDepartments });

        const message = await screen.findByText(copy.invalidDepartments);
        const box = screen.getByPlaceholderText(joinCopy.departmentsPlaceholder);
        const field = box.closest(".MuiFormControl-root") as HTMLElement;
        expect(field.contains(message)).toBe(true);
    });

    it("a form-level failure (5xx) shows its line in the alert", async () => {
        mountJoin({ field: "form", message: copy.serverError });

        expect(await screen.findByText(copy.serverError)).toBeTruthy();
        expect(screen.queryByText(copy.duplicateTeamName)).toBeNull();
    });
});

// --- the in-app modal: the same placement, and no raw JavaScript error --------------------

const created = { ok: true, status: 201, json: async () => ({ teamId: "t2" }) } as Response;

const mountModal = () => {
    render(
        <CssVarsProvider>
            <ModalCreateTeam
                myself={{ userId: "u1", teamId: "t1", userName: "Ken" } as never}
                setIsNewTeamCreated={vi.fn()}
                setMyself={vi.fn()}
                setOpenCreateTeam={vi.fn()}
                openCreateTeam
            />
        </CssVarsProvider>
    );
    fireEvent.change(screen.getByPlaceholderText(en.admin.createTeamModal.teamNamePlaceholder), {
        target: { value: "Apollo" },
    });
};

const submitModal = async () => {
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: en.admin.createTeamModal.create }));
    });
};

describe("the Create New Team modal shows each refusal (MIP-1841)", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(created));
    });

    it("a taken name is shown by the team-name field", async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({
                team_name: ["team master with this team name already exists."],
                hint: HINT,
            }),
        } as unknown as Response);
        mountModal();
        await submitModal();

        const message = await screen.findByText(copy.duplicateTeamName);
        const field = screen
            .getByPlaceholderText(en.admin.createTeamModal.teamNamePlaceholder)
            .closest(".MuiFormControl-root") as HTMLElement;
        expect(field.contains(message)).toBe(true);
    });

    it("a 502 HTML page says try again, not a JavaScript parse error", async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 502,
            json: async () => {
                throw new SyntaxError("Unexpected token < in JSON at position 0");
            },
        } as unknown as Response);
        mountModal();
        await submitModal();

        expect(await screen.findByText(copy.serverError)).toBeTruthy();
        expect(screen.queryByText(/SyntaxError/)).toBeNull();
    });

    it("a network failure says so, not the raw TypeError", async () => {
        vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
        mountModal();
        await submitModal();

        expect(await screen.findByText(copy.network)).toBeTruthy();
        expect(screen.queryByText(/Failed to fetch/)).toBeNull();
    });

    it("a refused list is shown by the departments box", async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: "bad", code: "invalid_departments" }),
        } as unknown as Response);
        mountModal();
        await submitModal();

        await waitFor(() => expect(screen.getByText(copy.invalidDepartments)).toBeTruthy());
    });
});
