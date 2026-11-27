/**
 * MIP-2441: where a schedule's skill is chosen, each skill says in one line what it does: the first
 * sentence of its description.
 *
 * Pinned: the cut (English, Japanese, Arabic, Hindi; a decimal point does not end a sentence); each
 * option carries its summary and not the rest; a skill without a description adds no line; the
 * chosen skill's summary shows under the field and goes when a skill without one is picked.
 */
import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SkillParamSelect } from "../components/layout/schedules/ScheduleParamPickers";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { skillSummary } from "../features/genos/skills/skillSummary";

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

const skill = (id: string, title: string, description: string) => ({
    id,
    slug: id,
    title,
    description,
    group: "mine",
    ownerName: "",
    publishedVersionNo: 1,
    tagChips: [],
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

const Picker = () => {
    const [value, setValue] = useState("");
    return (
        <CssVarsProvider>
            <HashMentionDataProvider value={mention}>
                <SkillParamSelect value={value} onChange={setValue} />
            </HashMentionDataProvider>
        </CssVarsProvider>
    );
};

describe("the first sentence", () => {
    it.each([
        ["Show what publishes this week. Then set dates.", "Show what publishes this week."],
        [
            "Uses version 2.5 of the plan, e.g. tasks. More.",
            "Uses version 2.5 of the plan, e.g. tasks.",
        ],
        ["今週の公開予定を表示します。次に日付を設定します。", "今週の公開予定を表示します。"],
        ["ما الذي ينشر هذا الأسبوع؟ ثم حدد المواعيد.", "ما الذي ينشر هذا الأسبوع؟"],
        ["इस सप्ताह की सूची। फिर तारीखें।", "इस सप्ताह की सूची।"],
        ["  No full stop at all  ", "No full stop at all"],
        ["   ", ""],
        ["", ""],
    ])("%j", (description, expected) => {
        expect(skillSummary(description)).toBe(expected);
    });
});

describe("the skill picker", () => {
    it("says what each skill does, and keeps it under the field once chosen", async () => {
        fetchRunnableSkills.mockResolvedValue({
            ok: true,
            data: [
                skill(
                    "k1",
                    "Content week",
                    "Show what publishes this week. After a yes, set dates."
                ),
                skill("k2", "Bare", ""),
            ],
        });
        const user = userEvent.setup();
        render(<Picker />);
        const box = screen.getByRole("combobox");
        await waitFor(() => expect(box).not.toHaveTextContent(/…/));
        await user.click(box);

        const [described, bare] = await screen.findAllByRole("option");
        expect(within(described).getByTestId("skill-summary").textContent).toBe(
            "Show what publishes this week."
        );
        expect(described).not.toHaveTextContent("After a yes");
        expect(within(bare).queryByTestId("skill-summary")).toBeNull();
        expect(screen.queryByTestId("skill-chosen-summary")).toBeNull();

        await user.click(described);
        const under = screen.getByTestId("skill-chosen-summary");
        expect(under.textContent).toBe("Show what publishes this week.");
        expect(box).toHaveTextContent("Content week");
        // MIP-2444: the closed value is its own bidi island, which is what takes the ellipsis.
        expect(box.querySelector("bdi")).toHaveTextContent("Content week");
        expect(box).not.toHaveTextContent("Show what");

        await user.click(box);
        await user.click(await screen.findByRole("option", { name: "Bare" }));
        expect(screen.queryByTestId("skill-chosen-summary")).toBeNull();
    });
});
