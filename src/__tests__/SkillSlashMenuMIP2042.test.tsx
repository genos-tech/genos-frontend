/**
 * Running a skill with `/name` (MIP-2042): the `/` menu of the Spotlight and Genos page input.
 *
 * What matters: `/` is a command only as the FIRST character of the question and only where the
 * host passed `skills` (a prose slash, a path and "and/or" stay text; without skills nothing
 * changes); the menu lists what the server offered in resolution order and narrows by name or
 * title; a pick (or a hand-typed exact name) becomes a skill ref that rides the ask as `skill`,
 * never as a mention; a name two teammates share goes to the server (which asks which); a `/word` that is no skill stays an ordinary question; and a
 * server that has Skills off yields no menu at all.
 */

import { useState } from "react";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MentionSuggestionDropdown } from "../features/agentQA/mentions/MentionSuggestionDropdown";
import {
    toWireMentions,
    toWireSkill,
    type AgentMentionCandidate,
    type AgentMentionRef,
} from "../features/agentQA/mentions/types";
import {
    detectMentionTrigger,
    matchMentionTokens,
    useAgentMentionDraft,
} from "../features/agentQA/mentions/useAgentMentionDraft";
import { parseRunnableSkills } from "../features/genos/skills/skillsApi";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { ar } from "../i18n/locales/ar";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import {
    askAgentStream,
    fetchAgentSessionDetail,
    type AgentSessionTurn,
} from "../services/agentApi";

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        askAgentStream: vi.fn(),
        decideAgent: vi.fn(),
        fetchAgentSessionDetail: vi.fn(async () => null),
        fetchAgentSessions: vi.fn(async () => []),
        submitAgentFeedback: vi.fn(async () => true),
    };
});
vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));
vi.mock("../hooks/common/spotlightPreferencesState", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const skill = (
    id: string,
    slug: string,
    title: string,
    group: AgentMentionCandidate["skillGroup"] = "mine",
    skillOwner?: string
): AgentMentionCandidate => ({
    ref: { kind: "skill", skillId: id, label: slug },
    trigger: "/",
    key: `skill:${id}`,
    skillGroup: group,
    skillTitle: title,
    skillOwner,
});

const SKILLS = [
    skill("s-1", "weekly-report", "Weekly report", "mine"),
    skill("s-2", "standup", "Daily standup notes", "team", "Alice"),
    skill("s-3", "report-bugs", "Bug triage", "installed"),
    skill("s-4", "plan-my-day", "Plan the day", "official"),
];

function useHarness(skills: AgentMentionCandidate[] | undefined, initial = "") {
    const [value, setValue] = useState(initial);
    const draft = useAgentMentionDraft({
        value,
        onChange: setValue,
        members: [],
        entities: [],
        skills,
    });
    return { value, setValue, draft };
}

const type = (result: { current: ReturnType<typeof useHarness> }, text: string) => {
    act(() => result.current.setValue(text));
    act(() => result.current.draft.setCaret(text.length));
};

describe("detectMentionTrigger with skills", () => {
    it("opens only for a slash that is the first character, and only when asked to", () => {
        expect(detectMentionTrigger("/rep", 4, true)).toMatchObject({
            char: "/",
            query: "rep",
            start: 0,
        });
        expect(detectMentionTrigger("/", 1, true)).toMatchObject({ char: "/", query: "" });
        expect(detectMentionTrigger("/rep", 4)).toBeNull();
        for (const prose of ["see /rep", "and/or", "a /b", " /rep", "src/app", "1/2"]) {
            expect(detectMentionTrigger(prose, prose.length, true), prose).toBeNull();
        }
    });

    it("closes once the caret leaves the name (the input after the name is the question)", () => {
        expect(detectMentionTrigger("/rep for Q3", 11, true)).toBeNull();
        expect(detectMentionTrigger("/rep for Q3", 4, true)).toMatchObject({ query: "rep" });
    });

    it("leaves @ and # alone beside a leading slash", () => {
        expect(detectMentionTrigger("/rep @Al", 8, true)).toMatchObject({
            char: "@",
            query: "Al",
        });
    });
});

describe("the menu", () => {
    it("lists every skill on a bare slash, in the server's order", () => {
        const { result } = renderHook(() => useHarness(SKILLS));
        type(result, "/");
        expect(result.current.draft.pickerOpen).toBe(true);
        expect(result.current.draft.suggestions.map((c) => c.ref.label)).toEqual([
            "weekly-report",
            "standup",
            "report-bugs",
            "plan-my-day",
        ]);
    });

    it("narrows by name or title, exact name first, then a prefix, then the rest", () => {
        const { result } = renderHook(() => useHarness(SKILLS));
        type(result, "/report");
        expect(result.current.draft.suggestions.map((c) => c.ref.label)).toEqual([
            "report-bugs",
            "weekly-report",
        ]);
        type(result, "/notes");
        expect(result.current.draft.suggestions.map((c) => c.ref.label)).toEqual(["standup"]);
        type(result, "/nothing");
        expect(result.current.draft.pickerOpen).toBe(false);
    });

    it("has no menu where the host passed no skills, and slash stays a plain character", () => {
        const { result } = renderHook(() => useHarness(undefined));
        type(result, "/");
        expect(result.current.draft.pickerOpen).toBe(false);
        act(() => result.current.setValue("/weekly-report hi"));
        expect(result.current.draft.consumeMentions("/weekly-report hi")).toEqual([]);
    });

    it("Escape closes it for this slash only", () => {
        const { result } = renderHook(() => useHarness(SKILLS));
        type(result, "/we");
        act(() => result.current.draft.closePicker());
        expect(result.current.draft.pickerOpen).toBe(false);
    });
});

describe("picking and sending", () => {
    it("a pick writes `/name ` and the ask carries that skill by id, as a skill and not a mention", () => {
        const { result } = renderHook(() => useHarness(SKILLS));
        type(result, "/we");
        act(() => {
            result.current.draft.selectHighlighted();
        });
        expect(result.current.value).toBe("/weekly-report ");
        act(() => result.current.draft.setCaret(result.current.value.length));
        expect(result.current.draft.pickerOpen).toBe(false);
        act(() => result.current.setValue("/weekly-report for Q3"));
        const refs = result.current.draft.consumeMentions("/weekly-report for Q3");
        expect(refs).toEqual([{ kind: "skill", skillId: "s-1", label: "weekly-report" }]);
        expect(toWireSkill(refs)).toEqual({ id: "s-1" });
        expect(toWireMentions(refs)).toEqual([]);
    });

    it("a hand-typed exact name resolves to that skill's id", () => {
        const { result } = renderHook(() => useHarness(SKILLS));
        expect(result.current.draft.consumeMentions("/standup now")).toEqual([
            { kind: "skill", skillId: "s-2", label: "standup" },
        ]);
    });

    it("a `/word` that is not one of the person's skills is an ordinary question", () => {
        const { result } = renderHook(() => useHarness(SKILLS));
        for (const text of ["/tmp is full, why?", "/help me plan", "/brand-new for me"]) {
            expect(toWireSkill(result.current.draft.consumeMentions(text)), text).toBeUndefined();
        }
        // `[]` (Skills on, nothing to run yet) is the same.
        const empty = renderHook(() => useHarness([]));
        expect(
            toWireSkill(empty.result.current.draft.consumeMentions("/brand-new"))
        ).toBeUndefined();
    });

    it("a name two teammates share goes to the server as a name, which asks which one", () => {
        const shared = [
            skill("t-1", "standup", "Standup A", "team", "Alice"),
            skill("t-2", "standup", "Standup B", "team", "Bob"),
        ];
        const { result } = renderHook(() => useHarness(shared));
        expect(toWireSkill(result.current.draft.consumeMentions("/standup now"))).toEqual({
            name: "standup",
        });
        // The person's own skill of that name wins: there is nothing to ask.
        const mine = [skill("m-1", "standup", "Mine", "mine"), ...shared];
        const own = renderHook(() => useHarness(mine));
        expect(toWireSkill(own.result.current.draft.consumeMentions("/standup now"))).toEqual({
            id: "m-1",
        });
    });

    it("sends nothing for text that is not a command", () => {
        const { result } = renderHook(() => useHarness(SKILLS));
        for (const text of [
            "what is /usr/bin",
            "and /standup",
            "/",
            "/a b",
            "/Upper x",
            "//x",
            "path/to",
        ]) {
            expect(toWireSkill(result.current.draft.consumeMentions(text)), text).toBeUndefined();
        }
    });

    it("a skill is a command only at the very start: the same token in prose is not matched", () => {
        const ref: AgentMentionRef = { kind: "skill", skillId: "s-1", label: "weekly-report" };
        expect(matchMentionTokens("/weekly-report go", [ref])).toHaveLength(1);
        expect(matchMentionTokens("run /weekly-report", [ref])).toHaveLength(0);
    });

    it("a name that is too long or too short is not sent", () => {
        const { result } = renderHook(() => useHarness(SKILLS));
        expect(toWireSkill(result.current.draft.consumeMentions("/a x"))).toBeUndefined();
        expect(
            toWireSkill(result.current.draft.consumeMentions(`/${"a".repeat(41)} x`))
        ).toBeUndefined();
    });

    it("only the first skill counts", () => {
        const refs: AgentMentionRef[] = [
            { kind: "skill", skillId: "a", label: "aa" },
            { kind: "skill", skillId: "b", label: "bb" },
        ];
        expect(toWireSkill(refs)).toEqual({ id: "a" });
        expect(toWireSkill(undefined)).toBeUndefined();
    });
});

describe("the ask", () => {
    beforeEach(() => {
        vi.mocked(askAgentStream).mockClear();
        localStorage.clear();
    });

    const ask = async (refs: AgentMentionRef[], query = "/weekly-report for Q3") => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDelta("Done.");
            args.onDone("sess-1", "run-1");
        });
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.onAsk(query, refs);
        });
        await waitFor(() => expect(askAgentStream).toHaveBeenCalledTimes(1));
        return { result, args: vi.mocked(askAgentStream).mock.calls[0][0] };
    };

    it("sends the skill by id, the question as typed, and no mentions key for a skill alone", async () => {
        const { args } = await ask([{ kind: "skill", skillId: "s-1", label: "weekly-report" }]);
        expect(args.skill).toEqual({ id: "s-1" });
        expect(args.query).toBe("/weekly-report for Q3");
        expect(args.mentions).toBeUndefined();
    });

    it("sends a typed name as a name, beside the mentions that go with it", async () => {
        const { args } = await ask([
            { kind: "skill", skillId: "", label: "brand-new" },
            { kind: "user", userId: "u-1", label: "Alice" },
        ]);
        expect(args.skill).toEqual({ name: "brand-new" });
        expect(args.mentions).toEqual([{ type: "user", user_id: "u-1", label: "Alice" }]);
    });

    it("a plain question sends no skill key", async () => {
        const { args } = await ask([], "what is due?");
        expect("skill" in args).toBe(false);
    });

    it("a retry of a skill run runs the skill again", async () => {
        const refs: AgentMentionRef[] = [
            { kind: "skill", skillId: "s-1", label: "weekly-report" },
        ];
        const { result } = await ask(refs);
        await waitFor(() => expect(result.current.turns).toHaveLength(1));
        expect(result.current.turns[0].mentions).toEqual(refs);
        vi.mocked(askAgentStream).mockClear();
        act(() => {
            result.current.onAsk(
                result.current.turns[0].askedQuery,
                result.current.turns[0].mentions
            );
        });
        await waitFor(() => expect(askAgentStream).toHaveBeenCalledTimes(1));
        expect(vi.mocked(askAgentStream).mock.calls[0][0].skill).toEqual({ id: "s-1" });
    });

    // MIP-2189: the same retry, but the turn comes back from the server's history.
    describe("a turn reloaded from history", () => {
        const resumeWith = async (skillRef: AgentSessionTurn["skill"] | undefined) => {
            vi.mocked(fetchAgentSessionDetail).mockResolvedValueOnce({
                session_id: "sess-9",
                created_at: "2026-11-23T00:00:00Z",
                last_active_at: "2026-11-23T00:00:00Z",
                turns: [
                    {
                        run_id: "run-9",
                        query: "/weekly-report for Q3",
                        answer: "Done.",
                        status: "done",
                        error: null,
                        started_at: "2026-11-23T00:00:00Z",
                        sources: [],
                        ...(skillRef !== undefined ? { skill: skillRef } : {}),
                    },
                ],
            });
            vi.mocked(askAgentStream).mockImplementation(async (args) => {
                args.onDelta("Again.");
                args.onDone("sess-9", "run-10");
            });
            const { result } = renderHook(() =>
                useSpotlight({ accessToken: "test-token", teamId: "team-1" })
            );
            act(() => result.current.resumeSession("sess-9"));
            await waitFor(() => expect(result.current.turns).toHaveLength(1));
            return result;
        };

        const retry = async (result: Awaited<ReturnType<typeof resumeWith>>) => {
            act(() => {
                result.current.onAsk(
                    result.current.turns[0].askedQuery,
                    result.current.turns[0].mentions
                );
            });
            await waitFor(() => expect(askAgentStream).toHaveBeenCalledTimes(1));
            return vi.mocked(askAgentStream).mock.calls[0][0];
        };

        it("retries with the skill and the version that ran", async () => {
            const result = await resumeWith({ id: "s-1", version_no: 3, slug: "weekly-report" });
            const args = await retry(result);
            expect(args.skill).toEqual({ id: "s-1", version_no: 3 });
            expect(args.query).toBe("/weekly-report for Q3");
            expect(args.mentions).toBeUndefined();
        });

        it("an owner's draft turn (version 0) asks for the skill without a version", async () => {
            const result = await resumeWith({ id: "s-1", version_no: 0, slug: "weekly-report" });
            expect((await retry(result)).skill).toEqual({ id: "s-1" });
        });

        it("a plain turn, a null skill and an older backend send no skill key", async () => {
            for (const skillRef of [undefined, null]) {
                vi.mocked(askAgentStream).mockClear();
                const result = await resumeWith(skillRef);
                expect("skill" in (await retry(result))).toBe(false);
            }
        });
    });
});

describe("the runnable list from the server", () => {
    it("reads rows defensively and drops what has no id or name", () => {
        const rows = parseRunnableSkills({
            skills: [
                { id: "a", slug: "one", title: "One", group: "team", ownerName: "Alice", x: 1 },
                { id: "", slug: "two" },
                { slug: "three" },
                { id: "b", slug: "four", group: "nonsense" },
                "junk",
            ],
        });
        expect(rows).toEqual([
            {
                id: "a",
                slug: "one",
                title: "One",
                description: "",
                group: "team",
                ownerName: "Alice",
                publishedVersionNo: 0,
                tagChips: [],
            },
            {
                id: "b",
                slug: "four",
                title: "",
                description: "",
                group: "mine",
                ownerName: "",
                publishedVersionNo: 0,
                tagChips: [],
            },
        ]);
        expect(parseRunnableSkills(null)).toBeNull();
        expect(parseRunnableSkills({ skills: "no" })).toBeNull();
    });
});

describe("the rows", () => {
    it("show `/name`, the title and who it is from", () => {
        const anchor = document.createElement("div");
        document.body.appendChild(anchor);
        render(
            <MentionSuggestionDropdown
                anchorRef={{ current: anchor }}
                ariaLabel="Skill suggestions"
                highlightIndex={0}
                placement="above"
                suggestions={SKILLS}
                onSelect={() => undefined}
            />
        );
        expect(screen.getByRole("listbox", { name: "Skill suggestions" })).toBeTruthy();
        const row = screen.getByTestId("agent-mention-option-skill:s-2");
        expect(row.textContent).toContain("/standup");
        expect(row.textContent).toContain("Daily standup notes");
        expect(row.textContent).toContain("Team skill from Alice");
        expect(screen.getByTestId("agent-mention-option-skill:s-1").textContent).toContain(
            "Yours"
        );
        expect(screen.getByTestId("agent-mention-option-skill:s-3").textContent).toContain(
            "Installed"
        );
        expect(screen.getByTestId("agent-mention-option-skill:s-4").textContent).toContain(
            "Genos"
        );
    });
});

describe("every locale words the menu", () => {
    const OTHERS = { ja, es, fr, zh, ar, hi } as const;
    const KEYS = ["ariaLabel", "mine", "fromTeammate", "installed", "official"] as const;

    it.each(Object.keys(OTHERS) as Array<keyof typeof OTHERS>)(
        "%s has all five strings and keeps {name}",
        (name) => {
            const own: Record<string, string> | undefined = OTHERS[name].spotlight?.skills;
            for (const key of KEYS) {
                const text = own?.[key];
                expect(typeof text === "string" && text.trim() !== "", `${name}.${key}`).toBe(
                    true
                );
            }
            expect(own?.fromTeammate).toContain("{name}");
        }
    );
});
