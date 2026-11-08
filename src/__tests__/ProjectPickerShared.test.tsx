/**
 * One project dropdown, two hosts (MIP-1218).
 *
 * The Genos search project filter (multi-select) and the schedule form's project
 * parameter (single choice) render their rows, list and matching from
 * `ProjectPickerParts`, so a project looks the same in both. Ken asked for exactly
 * that ("the same dropdown item UI as the project filter"); a bare Select with the
 * names would read as a different control.
 *
 * jsdom has no layout: how the two look side by side was checked in a browser.
 */
import { useState } from "react";
import { FormControl, FormLabel } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectParamSelect } from "../components/layout/schedules/ScheduleParamPickers";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { SpotlightProjectFilter } from "../features/spotlight/SpotlightProjectFilter";
import type { ProjectProps } from "../types/tasks";

vi.setConfig({ testTimeout: 30000 });
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const PROJECTS: ProjectProps[] = [
    {
        projectId: 11,
        projectName: "Apollo",
        projectTags: [],
        isJoined: true,
        projectLabels: [{ labelId: 7, name: "Platform", color: "#123456", textColor: "#ffffff" }],
    },
    { projectId: 12, projectName: "Secret", projectTags: [], isJoined: true, isPrivate: true },
    { projectId: 13, projectName: "Not mine", projectTags: [], isJoined: false },
];

const mention = (): HashMentionData => ({
    tasks: [],
    teamTasks: [],
    notes: [],
    chats: [],
    allChats: [],
    projects: PROJECTS,
    todoGroups: [],
    myself: null,
    refresh: () => {},
});

// Ids and option indexes differ per widget instance; the row itself must not.
const normalised = (el: Element) =>
    el.outerHTML.replace(/ id="[^"]*"/g, "").replace(/ data-option-index="\d+"/g, "");

const Form = ({
    initial = "",
    onChange,
}: {
    initial?: string;
    onChange?: (v: string) => void;
}) => {
    const [value, setValue] = useState(initial);
    return (
        <CssVarsProvider>
            <HashMentionDataProvider value={mention()}>
                <FormControl>
                    <FormLabel>Project</FormLabel>
                    <ProjectParamSelect
                        value={value}
                        onChange={(v) => {
                            setValue(v);
                            onChange?.(v);
                        }}
                    />
                </FormControl>
            </HashMentionDataProvider>
        </CssVarsProvider>
    );
};

describe("form project picker uses the Genos search filter's dropdown rows", () => {
    it("renders the same row markup for a project (labels, lock, name)", async () => {
        const user = userEvent.setup();
        const { unmount } = render(<Form />);
        await user.click(screen.getByRole("combobox", { name: "Project" }));
        const inForm = await screen.findAllByRole("option");
        const formRows = new Map(inForm.map((o) => [o.textContent, normalised(o)]));
        unmount();

        render(
            <CssVarsProvider>
                <SpotlightProjectFilter
                    ariaLabel="Filter results by project"
                    isDark={false}
                    placeholder="All projects"
                    projects={PROJECTS.filter((p) => p.isJoined)}
                    selectedIds={[]}
                    onChange={vi.fn()}
                />
            </CssVarsProvider>
        );
        await user.click(screen.getByRole("combobox", { name: "Filter results by project" }));
        const inFilter = await screen.findAllByRole("option");
        for (const option of inFilter) {
            expect(formRows.get(option.textContent)).toBe(normalised(option));
        }
        // and it is the rich row, not a bare name
        const apollo = inFilter.find((o) => o.textContent?.includes("Apollo"))!;
        expect(within(apollo).getByText("Platform")).toBeTruthy();
        const secret = inFilter.find((o) => o.textContent?.includes("Secret"))!;
        expect(secret.querySelector('[data-testid="LockOutlineIcon"]')).toBeTruthy();
    });

    it("lists All projects first, then only the projects the member has joined", async () => {
        const user = userEvent.setup();
        render(<Form />);
        await user.click(screen.getByRole("combobox", { name: "Project" }));
        const names = (await screen.findAllByRole("option")).map((o) => o.textContent);
        expect(names).toEqual(["All projects", "PlatformApollo", "Secret"]);
    });

    it("hands back the numeric id as text, and an empty string for All projects", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Form onChange={onChange} />);
        const picker = screen.getByRole("combobox", { name: "Project" });
        expect(picker).toHaveValue("All projects");
        await user.click(picker);
        await user.click(await screen.findByRole("option", { name: /Secret/ }));
        expect(onChange).toHaveBeenLastCalledWith("12");
        expect(picker).toHaveValue("Secret");
        await user.click(picker);
        await user.click(await screen.findByRole("option", { name: "All projects" }));
        expect(onChange).toHaveBeenLastCalledWith("");
        expect(picker).toHaveValue("All projects");
    });

    it("shows an id the member cannot see as (unavailable) and never as a number", () => {
        render(<Form initial="999" />);
        expect(screen.getByRole("combobox", { name: "Project" })).toHaveValue("(unavailable)");
    });

    it("filters by typing, like the search filter", async () => {
        const user = userEvent.setup();
        render(<Form />);
        const picker = screen.getByRole("combobox", { name: "Project" });
        await user.click(picker);
        await user.clear(picker);
        await user.type(picker, "apol");
        const names = (await screen.findAllByRole("option")).map((o) => o.textContent);
        expect(names).toEqual(["PlatformApollo"]);
    });
});

describe("Genos search project filter keeps its multi-select behaviour", () => {
    it("picks several projects and reports the ids", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const Host = () => {
            const [ids, setIds] = useState<number[]>([]);
            return (
                <CssVarsProvider>
                    <SpotlightProjectFilter
                        ariaLabel="Filter results by project"
                        isDark={false}
                        placeholder="All projects"
                        projects={PROJECTS}
                        selectedIds={ids}
                        onChange={(next) => {
                            setIds(next);
                            onChange(next);
                        }}
                    />
                </CssVarsProvider>
            );
        };
        render(<Host />);
        const box = screen.getByRole("combobox", { name: "Filter results by project" });
        await user.click(box);
        await user.click(await screen.findByRole("option", { name: /Apollo/ }));
        expect(onChange).toHaveBeenLastCalledWith([11]);
        await user.click(box);
        await user.click(await screen.findByRole("option", { name: /Secret/ }));
        expect(onChange).toHaveBeenLastCalledWith([11, 12]);
        // no "All projects" row in the filter: empty selection is how it means all
        expect(screen.queryByRole("option", { name: "All projects" })).toBeNull();
    });
});
