/**
 * MIP-2313: LP copy corrections from the fact-check (MIP-2306). Each line pins a claim that was
 * wrong or overstated against the code, in both languages, so it cannot silently come back.
 */
import { describe, expect, it } from "vitest";

import { HOME_COPY } from "../lp/copy/home";
import { projects } from "../lp/segments/projects";
import { teams } from "../lp/segments/teams";

const text = (v: unknown) => JSON.stringify(v);
const HOME = { en: text(HOME_COPY.en), ja: text(HOME_COPY.ja) };
const PROJECTS = text(projects);
const TEAMS = text(teams);

describe("home feature lines", () => {
    it("says a thread opens a linked task form, not a one-step conversion", () => {
        expect(HOME.en).not.toContain("in one step");
        expect(HOME.ja).not.toContain("ワンステップ");
        expect(HOME.en).toContain("Create a task from a thread");
        expect(HOME.ja).toContain("スレッドからタスクを作成");
    });

    it("pins are for chats; single messages are flagged", () => {
        expect(HOME.en).toContain("Pin chats, flag messages and search");
        expect(HOME.ja).toContain("メッセージのフラグ");
    });

    it("does not claim every change is in task history; PRs link by branch name", () => {
        expect(HOME.en).not.toContain("Every change lands");
        expect(HOME.en).toContain("branch name includes the task id");
        expect(HOME.ja).toContain("ブランチ名にタスクIDを含む");
    });

    it("the Japanese mark line covers created and updated, like the English", () => {
        // MIP-2311: the mark line names external apps and where it shows.
        expect(HOME.ja).toContain(
            "作成・更新には、タスクの履歴・コメント・ノートの履歴で印が付きます"
        );
        expect(HOME.ja).not.toContain("AIが作成したものに印");
    });
});

describe("projects and teams pages", () => {
    it("stale tasks are not a per-task review in the UI", () => {
        expect(PROJECTS).not.toContain("stale tasks, and throughput");
        expect(PROJECTS).not.toContain("stale task、throughput");
        expect(PROJECTS).toContain("stalled milestones and velocity; ask Genos for stale tasks");
        expect(PROJECTS).toContain("停滞中のマイルストーン");
    });

    it("the Slack answer says there is no Slack connection", () => {
        for (const page of [PROJECTS, TEAMS]) {
            expect(page).toContain("Genos does not connect to Slack");
            expect(page).toContain("GenosはSlackと接続していません");
        }
    });

    it("the migration answers mention the one-time Slack export and CSV imports", () => {
        for (const page of [PROJECTS, TEAMS]) {
            expect(page).toContain("import a Slack export and tasks from CSV (Jira, Notion) once");
            expect(page).toContain("CSV（Jira、Notion）");
        }
    });

    it("the language answer says 7 interface languages", () => {
        expect(TEAMS).toContain("7 interface languages");
        expect(TEAMS).toContain("7言語");
    });
});
