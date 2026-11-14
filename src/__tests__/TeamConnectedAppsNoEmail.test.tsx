/**
 * Team editors no longer receive `userEmail` in the team's connected-apps list (api #825: the key
 * is absent, not null). The section must never render "undefined" or a blank person.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TeamConnectedAppsSection } from "../components/layout/TeamConnectedAppsSection";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { authApi } from "../services/api";
import type { TeamMcpConnection } from "../services/teamIntegrations";

vi.mock("../services/api", () => ({ authApi: vi.fn(), nonAuthApi: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const get = vi.fn();
beforeEach(() => {
    get.mockReset();
    (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get });
});
afterEach(cleanup);

// What an editor receives: no `userEmail` key at all.
const EDITOR_ROW: TeamMcpConnection = {
    id: "c1",
    userId: "u1",
    userName: "Vic Viewer",
    client: { name: "Claude", kind: "registered", host: "", url: "" },
    scope: "write",
    allowDestructive: false,
    isDefaultTeam: true,
    otherTeams: 0,
    lastUsedAt: null,
    createdAt: "2026-11-06T00:00:00Z",
    revocable: true,
};

const show = (rows: unknown[]) => {
    get.mockResolvedValue({ data: { connections: rows } });
    return render(
        <CssVarsProvider>
            <TeamConnectedAppsSection teamId="t-1" />
        </CssVarsProvider>
    );
};

describe("TeamConnectedAppsSection without userEmail", () => {
    it("shows the name when the email is absent", async () => {
        show([EDITOR_ROW]);
        const row = await screen.findByTestId("team-app-c1");
        expect(within(row).getByText("Connected by Vic Viewer")).toBeInTheDocument();
        expect(row.textContent).not.toMatch(/undefined|null/);
    });

    it("the owner still sees the email when the name is empty", async () => {
        show([{ ...EDITOR_ROW, userName: "", userEmail: "vic@example.com" }]);
        const row = await screen.findByTestId("team-app-c1");
        expect(within(row).getByText("Connected by vic@example.com")).toBeInTheDocument();
    });

    it("falls back to a neutral label when both are missing, in the row, the button and the dialog", async () => {
        show([{ ...EDITOR_ROW, userName: "" }]);
        const row = await screen.findByTestId("team-app-c1");
        expect(within(row).getByText("Connected by a team member")).toBeInTheDocument();
        const btn = within(row).getByRole("button", { name: "End Claude for a team member" });
        expect(row.textContent).not.toMatch(/undefined|null/);
        fireEvent.click(btn);
        expect(await screen.findByText("End Claude for a team member?")).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/undefined|null/);
    });

    it("an empty-string email (never sent, but possible from an older server) also falls back", async () => {
        show([{ ...EDITOR_ROW, userName: "", userEmail: "" }]);
        const row = await screen.findByTestId("team-app-c1");
        expect(within(row).getByText("Connected by a team member")).toBeInTheDocument();
    });
});

describe("unknownMember in every locale", () => {
    const cats = { en, ja, es, fr, zh, ar, hi };
    it.each(Object.entries(cats))("%s has its own label", (name, cat) => {
        const v = (cat as { settings: { developer: { teamApps: Record<string, string> } } })
            .settings.developer.teamApps.unknownMember;
        expect(typeof v).toBe("string");
        expect(v.length).toBeGreaterThan(1);
        if (name !== "en") expect(v).not.toBe(en.settings.developer.teamApps.unknownMember);
    });
});
