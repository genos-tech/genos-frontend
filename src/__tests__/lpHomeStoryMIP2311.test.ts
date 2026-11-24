/**
 * MIP-2311: the Home page tells one story (a team workspace; a connected Claude and Genos AI are two
 * ways to put records in), and Ken's two decisions of 2026-11-24 hold on every LP page: the Claude
 * continuity wording is the safe one, and ChatGPT is "planned", never "coming soon".
 * Facts: the fact-check note of MIP-2306 (rows H1, H3, H4, H19-H22, H27-H33).
 */
import { describe, expect, it } from "vitest";

import { connectApp as connectAppEn } from "../i18n/locales/en/connectApp";
import { ja } from "../i18n/locales/ja";
import { CHANGELOG_COPY } from "../lp/copy/changelog";
import { HOME_COPY } from "../lp/copy/home";

const text = (v: unknown) => JSON.stringify(v);
const EN = text(HOME_COPY.en);
const JA = text(HOME_COPY.ja);

describe("one Home story", () => {
    it("the hero names the team workspace, the connected Claude and Genos AI", () => {
        expect(HOME_COPY.en.hero.sub).toContain("where your team's chat, tasks and notes live");
        expect(HOME_COPY.en.hero.sub).toContain("Connect Claude (Core and up)");
        expect(HOME_COPY.en.hero.sub).toContain("Or ask Genos AI, built into the workspace");
        expect(HOME_COPY.ja.hero.sub).toContain("チャット・タスク・ノートがあるワークスペース");
        expect(HOME_COPY.ja.hero.sub).toContain("Claudeを接続すると（Core以上）");
        expect(HOME_COPY.ja.hero.sub).toContain("Genos AIに聞くこともできます");
    });

    it("keeps the two hero paragraphs", () => {
        expect(HOME_COPY.en.hero.sub.split("\n\n")).toHaveLength(2);
        expect(HOME_COPY.ja.hero.sub.split("\n\n")).toHaveLength(2);
    });
});

describe("Claude continuity: the safe wording only", () => {
    it("says Genos tells the connected Claude to record, and a later session can read it", () => {
        expect(HOME_COPY.en.hero.sub).toContain(
            "Genos tells it to record tasks, decisions and progress as it works, and a later session can read what was saved"
        );
        expect(HOME_COPY.ja.hero.sub).toContain("記録するよう伝えます");
        expect(HOME_COPY.ja.hero.sub).toContain("保存された内容を読めます");
    });

    it("never promises to pick up where you left off, or that no prompt is needed", () => {
        expect(EN).not.toMatch(/pick up where|where you left off|No special prompts/i);
        expect(JA).not.toMatch(/続きから|特別な指示がなくても/);
    });

    it("decisions are something Genos asks for, not a guarantee", () => {
        expect(HOME_COPY.en.how.steps[1].body).toContain("Genos asks it to put each decision");
        expect(HOME_COPY.ja.how.steps[1].body).toContain("Genosが伝えます");
    });
});

describe("ChatGPT is planned, everywhere on the LP", () => {
    // The generic "Coming" label stays for Routines and reply drafts (not ChatGPT).
    const withoutLabel = (c: typeof HOME_COPY.en) => text({ ...c, coming: "" });
    const lp = [
        withoutLabel(HOME_COPY.en),
        withoutLabel(HOME_COPY.ja),
        text(CHANGELOG_COPY),
        connectAppEn.chatgptBody,
        (ja as unknown as { settings: { connectedApps: { connect: { chatgptBody: string } } } })
            .settings.connectedApps.connect.chatgptBody,
    ].join("\n");

    it("never says coming soon", () => {
        expect(lp).not.toMatch(/coming soon|近日公開|近日対応|近日対応予定|Coming:/i);
    });

    it("says planned, in both languages, on each page that mentions it", () => {
        expect(HOME_COPY.en.works.agents[1].state).toBe("Planned");
        expect(HOME_COPY.en.mcp.clients[1].state).toBe("Planned");
        expect(HOME_COPY.ja.works.agents[1].state).toBe("対応予定");
        expect(HOME_COPY.ja.mcp.clients[1].state).toBe("対応予定");
        expect(HOME_COPY.en.hero.note).toContain("ChatGPT is planned");
        expect(HOME_COPY.ja.hero.note).toContain("ChatGPTは対応予定");
        expect(CHANGELOG_COPY.en.roadmap.at(-1)?.text).toContain("ChatGPT is planned");
        expect(CHANGELOG_COPY.ja.roadmap.at(-1)?.text).toContain("ChatGPT は対応予定");
        expect(CHANGELOG_COPY.en.statusLabel.coming).toBe("Planned");
        expect(CHANGELOG_COPY.ja.statusLabel.coming).toBe("予定");
        expect(connectAppEn.chatgptBody).toMatch(/^Planned:/);
    });
});

describe("approval, reading, language and marks are scoped to what is true", () => {
    it("the mark line names external apps and the three places it shows", () => {
        expect(HOME_COPY.en.hero.legend).toBe(
            "Changes made through Claude or another connected app are marked in task history, comments and note history; changes you type in Genos carry no mark."
        );
        expect(HOME_COPY.ja.hero.legend).toContain("作成・更新");
        expect(HOME_COPY.ja.hero.legend).toContain("タスクの履歴・コメント・ノートの履歴");
        expect(HOME_COPY.ja.hero.legend).toContain("直接入力した内容には付きません");
    });

    it("approval is Genos AI's; a connected app writes at once with its granted access", () => {
        expect(HOME_COPY.en.receipts.sub).toContain("it changes nothing until you approve");
        expect(HOME_COPY.en.mcp.points[2]).toContain("writes at once with the access you gave it");
        expect(HOME_COPY.ja.mcp.points[2]).toContain("承認なしですぐに書き込みます");
        expect(HOME_COPY.en.trust.items[1]).toContain("Apps you connect yourself");
        expect(HOME_COPY.ja.trust.items[1]).toContain("あなたが許可した範囲で動きます");
        expect(EN).not.toContain("Genos's own assistant changes nothing until you say yes");
    });

    it("Genos AI reads what you can access, not all chats", () => {
        expect(HOME_COPY.en.receipts.sub).toContain(
            "searches the chats, tasks, notes and to-dos you already have access to"
        );
        expect(HOME_COPY.ja.receipts.sub).toContain(
            "あなたが閲覧できるチャット・タスク・ノート・ToDo"
        );
        expect(EN).not.toContain("the way a colleague would");
        expect(JA).not.toContain("同僚のように");
    });

    it("answer language follows the interface language unless you ask", () => {
        expect(HOME_COPY.en.receipts.points[2]).toContain("in your interface language");
        expect(HOME_COPY.ja.receipts.points[2]).toContain("表示言語で回答します");
        expect(EN).not.toContain("in the language you ask in");
        expect(JA).not.toContain("質問した言語で回答");
    });

    it("the catch-up needs a connected AI app, importance is mostly activity, credits not cost", () => {
        const points = HOME_COPY.en.secretary.points.map((p) => p.text).join(" | ");
        expect(points).toContain("Ask your connected AI app to catch you up");
        expect(points).toContain("priority fields are only a hint");
        expect(points).toContain("AI credits used");
        expect(points).not.toContain("AI cost");
        expect(HOME_COPY.en.secretary.sub).not.toContain("never write a status report");
        expect(HOME_COPY.ja.secretary.points[0].text).toContain("接続したAIアプリ");
        expect(HOME_COPY.ja.secretary.points[2].text).toContain("AIクレジット");
    });

    it("the plan lines say what each plan adds, in both languages", () => {
        expect(HOME_COPY.en.plans.body).toContain("Core and up add Genos AI actions");
        expect(HOME_COPY.en.plans.body).toContain("Pro and up add multi-task plans");
        expect(HOME_COPY.ja.plans.body).toContain("Core以上でGenos AIによる変更");
        expect(HOME_COPY.ja.plans.body).toContain("Pro以上で複数タスクの計画");
    });

    it("the demo and the example are labelled for what they are", () => {
        expect(HOME_COPY.en.questions.items.at(-1)?.a).toContain("in English or Japanese");
        expect(HOME_COPY.ja.questions.items.at(-1)?.a).toContain("日本語または英語");
        expect(HOME_COPY.en.line.label).toContain("(example)");
        expect(HOME_COPY.ja.line.label).toContain("（例）");
    });
});
