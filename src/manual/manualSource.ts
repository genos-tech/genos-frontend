/**
 * The manual source (MIP-2321): one Markdown file per topic in `src/manual/<lang>/`, plus the
 * settings map (`settingsMap.ts`). The in-app guide notes, the help tool and the landing-page
 * manual all read the JSON built from here (`manual.<lang>.json`, written by
 * `npm run manual:export`), so there is one text to keep true.
 *
 * Pure functions, no Vite or Node imports: the vitest suite and the export script share them.
 *
 * File format:
 *
 *     ---
 *     id: chat
 *     title: Chat: messages, threads, and mentions
 *     settings: [chat, chat.messageLayout]
 *     ---
 *     ## Heading
 *     Markdown body (paragraphs, "- " bullets, "1. " lists, **bold**, `code`, links).
 *
 * `settings` lists the ids from `settingsMap.ts` the topic explains. The "Settings A-Z" topic
 * is not a file: it is generated from the map, so a tab or row cannot be left out of it.
 */
import { en } from "../i18n/locales/en";
import { ja as jaMessages } from "../i18n/locales/ja";
import {
    SETTINGS_MAP,
    type GuideItem,
    type GuideTab,
    type SettingGuideId,
    type SettingsTabKey,
} from "./settingsMap";
import { JA_PLAN, JA_SETTINGS_TEXT, JA_WHO } from "./settingsMap.ja";

export type ManualTopic = {
    id: string;
    title: string;
    /** Ids from the settings map this topic explains. */
    settings: string[];
    markdown: string;
};

export type ManualSetting = {
    id: string;
    tab: string;
    /** Tab label as the app shows it (rows: the row's name from the map). */
    label: string;
    kind: "tab" | "row";
    who: GuideItem["who"];
    plan: GuideItem["plan"];
    default: string;
    serverSwitch: string | null;
};

export type Manual = {
    language: string;
    topics: ManualTopic[];
    settings: ManualSetting[];
};

export const SETTINGS_REFERENCE_ID = "settings-reference";

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n?/;

/** Parse one topic file. Throws a message naming the file when the front matter is wrong. */
export const parseTopic = (file: string, raw: string): ManualTopic => {
    const match = FRONT_MATTER.exec(raw.replace(/\r\n/g, "\n"));
    if (!match) throw new Error(`${file}: missing front matter (--- id, title, settings ---)`);
    // Prettier wraps a long `settings: [...]` list over several lines and may quote a title, so
    // the list is cut out first and values are unquoted.
    let head = match[1];
    let listRaw = "[]";
    const listMatch = /^settings:\s*(\[[\s\S]*?\])[ \t]*$/m.exec(head);
    if (listMatch) {
        listRaw = listMatch[1].replace(/\s+/g, " ");
        head = head.replace(listMatch[0], "");
    }
    const fields = new Map<string, string>();
    for (const line of head.split("\n").filter((l) => l.trim())) {
        const sep = line.indexOf(":");
        if (sep < 1) throw new Error(`${file}: bad front matter line "${line}"`);
        const value = line.slice(sep + 1).trim();
        fields.set(line.slice(0, sep).trim(), value.replace(/^"(.*)"$/, "$1"));
    }
    const id = fields.get("id");
    const title = fields.get("title");
    if (!id || !/^[a-z0-9-]+$/.test(id)) throw new Error(`${file}: id must be kebab-case`);
    if (!title) throw new Error(`${file}: title is required`);
    const list = /^\[(.*)\]$/.exec(listRaw);
    if (!list) throw new Error(`${file}: settings must look like [a, b]`);
    const settings = list[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return {
        id,
        title,
        settings,
        markdown: raw
            .replace(/\r\n/g, "\n")
            .slice(match[0].length)
            .replace(/^\n+/, "")
            .replace(/\s+$/, "\n"),
    };
};

const WHO: Record<GuideItem["who"], string> = {
    self: "You",
    teamOwner: "Team owner",
    manager: "Owner or editor",
    owner: "Owner",
    anyMember: "Any member",
    ownSchedules: "You (your own schedules)",
    readOnly: "Read-only",
    browser: "Your browser",
};

const PLAN: Record<GuideItem["plan"], string> = {
    all: "All plans",
    "core+": "Core and up",
    "pro+": "Pro and up",
    perCap: "All plans; limits differ by plan",
    whenCreditsOn: "When AI credits are on",
};

const DICTIONARIES: Record<string, unknown> = { en, ja: jaMessages };

const isJa = (language: string) => language === "ja";

const resolveLabel = (path: string, language: string): string => {
    const dictionary = DICTIONARIES[language];
    if (!dictionary) throw new Error(`manual: no i18n dictionary for "${language}"`);
    const value = path
        .split(".")
        .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dictionary);
    if (typeof value !== "string") {
        throw new Error(`settings map: no ${language} i18n string at ${path}`);
    }
    return value;
};

/** The name and default shown for a settings id: English from the map, Japanese from its twin. */
const textFor = (
    id: SettingGuideId,
    language: string,
    fallback: { name?: string; default: string }
) => {
    if (!isJa(language)) return fallback;
    const text = JA_SETTINGS_TEXT[id];
    if (!text) throw new Error(`settingsMap.ja: no Japanese text for "${id}"`);
    return text;
};

/** Flatten the settings map into the rows the manual and the help tool read. */
export const buildSettings = (language = "en"): ManualSetting[] =>
    (Object.keys(SETTINGS_MAP) as SettingsTabKey[]).flatMap((tab) => {
        const entry: GuideTab = SETTINGS_MAP[tab];
        const tabLabel = resolveLabel(entry.labelPath, language);
        const tabText = textFor(tab, language, entry);
        return [
            {
                id: tab,
                tab,
                label: tabLabel,
                kind: "tab" as const,
                who: entry.who,
                plan: entry.plan,
                default: tabText.default,
                serverSwitch: entry.serverSwitch,
            },
            ...Object.entries(entry.items).map(([item, row]) => {
                const id = `${tab}.${item}` as SettingGuideId;
                const text = textFor(id, language, row);
                return {
                    id,
                    tab,
                    label: text.name ?? row.name,
                    kind: "row" as const,
                    who: row.who,
                    plan: row.plan,
                    default: text.default,
                    serverSwitch: row.serverSwitch,
                };
            }),
        ];
    });

const cell = (text: string) => text.replace(/[\\|]/g, "\\$&");

/** The generated "Settings A-Z" topic: one section per tab, one table row per setting. */
export const buildSettingsReference = (
    settings: ManualSetting[],
    language = "en"
): ManualTopic => {
    const japanese = isJa(language);
    const who = japanese ? JA_WHO : WHO;
    const plans = japanese ? JA_PLAN : PLAN;
    const lines: string[] = japanese
        ? [
              "Genos の設定の全タブと、各タブの中のすべての設定を、現在のアプリのとおりに載せています。設定は、サイドバー下部の歯車から開きます(スマートフォンでは、アカウント → 設定)。",
              "",
              "「お使いの Genos で有効な場合」と書かれた設定はサーバー側のスイッチの背後にあります。表示されないときは、お使いの Genos ではオンになっていません。",
              "",
          ]
        : [
              "Every Settings tab and every setting inside it, as the app has them today. Open Settings from the gear at the bottom of the sidebar (on a phone: Account, then Settings).",
              "",
              'A setting marked "when your Genos has it turned on" is behind a server switch; if you do not see it, your Genos does not have it on.',
              "",
          ];
    for (const tab of settings.filter((s) => s.kind === "tab")) {
        lines.push(`## ${tab.label}`, "", tab.default, "");
        if (japanese) {
            const gate = tab.serverSwitch ? "お使いの Genos で有効な場合のみです。" : "";
            lines.push(`変更できる人: ${who[tab.who]}。プラン: ${plans[tab.plan]}。${gate}`);
        } else {
            const gate = tab.serverSwitch ? " Only when your Genos has it turned on." : "";
            lines.push(`Who can change it: ${who[tab.who]}. Plan: ${plans[tab.plan]}.${gate}`);
        }
        lines.push("");
        const rows = settings.filter((s) => s.kind === "row" && s.tab === tab.id);
        if (rows.length) {
            lines.push(
                japanese
                    ? "| 設定 | 変更できる人 | プラン | 初期値 |"
                    : "| Setting | Who | Plan | Default |",
                "| --- | --- | --- | --- |"
            );
            for (const row of rows) {
                const gate = japanese
                    ? "。お使いの Genos で有効な場合"
                    : "; when your Genos has it on";
                const plan = plans[row.plan] + (row.serverSwitch ? gate : "");
                lines.push(
                    `| ${cell(row.label)} | ${who[row.who]} | ${cell(plan)} | ${cell(row.default)} |`
                );
            }
            lines.push("");
        }
    }
    return {
        id: SETTINGS_REFERENCE_ID,
        title: japanese ? "設定一覧(A〜Z)" : "Settings A-Z",
        settings: settings.map((s) => s.id),
        markdown: lines
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/\s+$/, "\n"),
    };
};

/** Build the manual from the raw topic files (file name -> text), in file-name order. */
export const buildManual = (language: string, files: Record<string, string>): Manual => {
    const settings = buildSettings(language);
    const topics = Object.keys(files)
        .sort()
        .map((file) => parseTopic(file, files[file]));
    return { language, topics: [...topics, buildSettingsReference(settings, language)], settings };
};

/** Problems with a built manual; the test and the export script both fail on a non-empty list. */
export const checkManual = (manual: Manual): string[] => {
    const problems: string[] = [];
    const known = new Set(manual.settings.map((s) => s.id));
    const seen = new Set<string>();
    for (const topic of manual.topics) {
        if (seen.has(topic.id)) problems.push(`duplicate topic id ${topic.id}`);
        seen.add(topic.id);
        if (!topic.markdown.trim()) problems.push(`topic ${topic.id} has no text`);
        for (const id of topic.settings) {
            if (!known.has(id)) problems.push(`topic ${topic.id}: unknown settings id "${id}"`);
        }
        if (/\bTODO\b|FIXME|as of August/.test(topic.markdown)) {
            problems.push(`topic ${topic.id}: leftover TODO/FIXME or a dated "as of" line`);
        }
    }
    return problems;
};

/** What a topic is made of, ignoring the words: used to hold a translation to the English text. */
const shape = (markdown: string) => ({
    headings: (markdown.match(/^## /gm) ?? []).length,
    items: (markdown.match(/^\s*(?:- |\d+\. )/gm) ?? []).length,
    tables: (markdown.match(/^\|/gm) ?? []).length,
    code: (markdown.match(/`[^`]+`/g) ?? []).sort(),
    links: (markdown.match(/\]\([^)]*\)/g) ?? []).sort(),
});

/**
 * Problems with a translated manual measured against the English one (MIP-2322): the same topic
 * ids in the same order, the same settings lists, and per topic the same number of sections,
 * list items and table rows, with the same `code` and link targets. A translation cannot add a
 * claim that is a new bullet, or drop a section, without this failing.
 */
export const checkParity = (manual: Manual, reference: Manual): string[] => {
    const problems: string[] = [];
    const ids = manual.topics.map((t) => t.id).join(",");
    if (ids !== reference.topics.map((t) => t.id).join(",")) {
        problems.push(`${manual.language}: topic ids differ from ${reference.language}`);
        return problems;
    }
    manual.topics.forEach((topic, i) => {
        const ref = reference.topics[i];
        if (topic.settings.join(",") !== ref.settings.join(",")) {
            problems.push(`topic ${topic.id}: settings list differs from ${reference.language}`);
        }
        const a = shape(topic.markdown);
        const b = shape(ref.markdown);
        for (const key of ["headings", "items", "tables"] as const) {
            if (a[key] !== b[key]) {
                problems.push(
                    `topic ${topic.id}: ${key} ${a[key]} vs ${b[key]} (${reference.language})`
                );
            }
        }
        for (const key of ["code", "links"] as const) {
            if (a[key].join("\n") !== b[key].join("\n")) {
                problems.push(`topic ${topic.id}: ${key} differ from ${reference.language}`);
            }
        }
    });
    return problems;
};
