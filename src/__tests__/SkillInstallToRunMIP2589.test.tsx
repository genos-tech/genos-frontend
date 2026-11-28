/**
 * MIP-2589: a skill can be picked or run only when it is yours or installed.
 *
 * Pinned here: the "Find more skills in the Genos Hub" line of the `/` menu (how the keyboard
 * reaches it, and that it never steals Enter from a question) and of the schedule's skill picker;
 * installing from Team skills; what a refused ask says and offers; and where the line and a
 * `?settings=` link lead.
 */
import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SkillParamSelect } from "../components/layout/schedules/ScheduleParamPickers";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import type { AgentMentionCandidate } from "../features/agentQA/mentions/types";
import { useAgentMentionDraft } from "../features/agentQA/mentions/useAgentMentionDraft";
import {
    asSkillsList,
    OPEN_SKILLS_EVENT,
    openSkillsList,
    takePendingSkillsList,
} from "../features/genos/skills/openSkillsList";
import { isInstallableTeamSkill } from "../features/genos/skills/skillsApi";
import { askAgentStream } from "../services/agentApi";
import { isAllowedReturn } from "../utils/pendingReturn";
import { stripSettingsParam } from "../utils/settingsDeepLink";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
}));
const fetchRunnableSkills = vi.fn();
vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/genos/skills/skillsApi")>()),
    fetchRunnableSkills: (...a: unknown[]) => fetchRunnableSkills(...a),
}));

afterEach(() => {
    vi.unstubAllGlobals();
    takePendingSkillsList();
});

const skill = (name: string): AgentMentionCandidate => ({
    ref: { kind: "skill", skillId: `id-${name}`, label: name },
    trigger: "/",
    key: `skill:${name}`,
    skillGroup: "mine",
});

const useDraft = (skills: AgentMentionCandidate[], findSkills: boolean, text: string) => {
    const [value, setValue] = useState(text);
    const draft = useAgentMentionDraft({
        value,
        onChange: setValue,
        members: [],
        entities: [],
        skills,
        findSkills,
    });
    return draft;
};

const mountDraft = (skills: AgentMentionCandidate[], findSkills: boolean, text: string) => {
    const hook = renderHook(() => useDraft(skills, findSkills, text));
    act(() => hook.result.current.setCaret(text.length));
    return hook;
};

describe("the / menu's Hub line", () => {
    it("sits after the skills and is reached with the arrow", () => {
        const { result } = mountDraft([skill("triage")], true, "/");
        expect(result.current.pickerOpen).toBe(true);
        expect(result.current.highlightIndex).toBe(0);
        expect(result.current.findSkillsHighlighted).toBe(false);
        act(() => result.current.moveHighlight(1));
        expect(result.current.findSkillsHighlighted).toBe(true);
        act(() => result.current.moveHighlight(1)); // the last row
        expect(result.current.findSkillsHighlighted).toBe(true);
        act(() => result.current.moveHighlight(-1));
        expect(result.current.highlightIndex).toBe(0);
    });

    it("is alone for a name that matches nothing and takes no Enter until arrowed to", () => {
        const { result } = mountDraft([skill("triage")], true, "/zzz");
        expect(result.current.pickerOpen).toBe(true);
        expect(result.current.suggestions).toHaveLength(0);
        expect(result.current.findSkillsHighlighted).toBe(false);
        act(() => result.current.moveHighlight(1));
        expect(result.current.findSkillsHighlighted).toBe(true);
        act(() => result.current.moveHighlight(-1));
        expect(result.current.findSkillsHighlighted).toBe(false);
    });

    it("is not there without a Hub, nor outside the / menu", () => {
        expect(mountDraft([], false, "/").result.current.pickerOpen).toBe(false);
        expect(mountDraft([], true, "what is /usr").result.current.findSkillsRow).toBe(false);
    });
});

const mention: HashMentionData = {
    tasks: [],
    notes: [],
    chats: [],
    allChats: [],
    projects: [],
    todoGroups: [],
    myself: { teamId: "t1" } as never,
    refresh: () => {},
};

const Picker = () => (
    <CssVarsProvider>
        <HashMentionDataProvider value={mention}>
            <SkillParamSelect value="" onChange={() => {}} />
        </HashMentionDataProvider>
    </CssVarsProvider>
);

describe("the schedule's skill picker", () => {
    beforeEach(() => fetchRunnableSkills.mockReset());

    it("offers the Hub under the field, and the click asks for it", async () => {
        fetchRunnableSkills.mockResolvedValue({ ok: true, data: [], hubEnabled: true });
        const opened = vi.fn();
        window.addEventListener(OPEN_SKILLS_EVENT, opened);
        render(<Picker />);
        await userEvent.click(await screen.findByTestId("skill-find-more"));
        expect(opened).toHaveBeenCalledTimes(1);
        expect(takePendingSkillsList()).toBe("hub");
        window.removeEventListener(OPEN_SKILLS_EVENT, opened);
    });

    it("has no line while there is no Hub", async () => {
        fetchRunnableSkills.mockResolvedValue({ ok: true, data: [] });
        render(<Picker />);
        await waitFor(() => expect(fetchRunnableSkills).toHaveBeenCalled());
        expect(screen.queryByTestId("skill-find-more")).toBeNull();
    });
});

describe("a refused ask", () => {
    const refuse = (where: string) =>
        vi.stubGlobal(
            "fetch",
            vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            error: "server words",
                            code: "install_required",
                            where,
                            slug: "status-report",
                        }),
                        { status: 403, headers: { "Content-Type": "application/json" } }
                    )
            )
        );

    it.each([
        ["hub", /status-report is not installed.*Genos Hub/],
        ["team", /status-report is not installed.*Team skills/],
    ])("says where to install it (%s) and hands the list to the turn", async (where, text) => {
        refuse(where);
        const onError = vi.fn();
        await askAgentStream({
            query: "/status-report",
            teamId: "t1",
            accessToken: "tok",
            onError,
        } as never);
        expect(onError).toHaveBeenCalledWith(expect.stringMatching(text), { skillList: where });
    });

    it("keeps the server's words for a list it does not know", async () => {
        refuse("somewhere");
        const onError = vi.fn();
        await askAgentStream({
            query: "x",
            teamId: "t1",
            accessToken: "tok",
            onError,
        } as never);
        expect(onError).toHaveBeenCalledWith("server words");
    });
});

describe("getting to the list", () => {
    it("reads only the two lists", () => {
        expect(asSkillsList("hub")).toBe("hub");
        expect(asSkillsList("team")).toBe("team");
        expect(asSkillsList("mine")).toBeNull();
        openSkillsList("team");
        expect(takePendingSkillsList()).toBe("team");
        expect(takePendingSkillsList()).toBeNull();
    });

    it("keeps the list of a signed-out link and drops both parameters afterwards", () => {
        expect(isAllowedReturn("/workspace?settings=spotlight&skills=hub")).toBe(true);
        expect(isAllowedReturn("/workspace?settings=spotlight&skills=x")).toBe(false);
        expect(isAllowedReturn("/workspace?settings=spotlight&next=//evil")).toBe(false);
        expect(stripSettingsParam("?settings=spotlight&skills=hub&a=1")).toBe("?a=1");
    });

    it("installs only a shared, published, visible teammate's skill", () => {
        const row = {
            mine: false,
            visibility: "team",
            publishedVersionNo: 1,
            status: "active",
            hiddenByTeam: false,
        };
        expect(isInstallableTeamSkill(row)).toBe(true);
        expect(isInstallableTeamSkill({ ...row, visibility: "specific" })).toBe(true);
        for (const not of [
            { mine: true },
            { visibility: "private" },
            { visibility: "public" },
            { publishedVersionNo: 0 },
            { hiddenByTeam: true },
            { status: "taken_down" },
        ]) {
            expect(isInstallableTeamSkill({ ...row, ...not }), JSON.stringify(not)).toBe(false);
        }
    });
});
