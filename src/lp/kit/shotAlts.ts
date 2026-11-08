import type { Lang } from "../lpLang";
import type { ShotName } from "./shots";

/** Alt text for each screenshot, for the pages that reuse them (the audience pages). */
export const SHOT_ALT: Record<Lang, Record<ShotName, string>> = {
    ja: {
        ask: "Genosの回答画面。出典のタスクやノートがチップで並んでいる",
        chat: "Genosのチャット画面。チャンネルの会話とスレッド",
        tasks: "Genosのタスク一覧。ステータス・担当・優先度・スプリントが並ぶテーブル",
        task: "Genosのタスク詳細。本文・コメント・関連スレッド",
        note: "Genosのノート画面。見出し・チェックリスト・表を含む仕様メモ",
        approval: "Genosが提案した変更の承認カード。承認と却下のボタンがある",
        inbox: "Genosの受信箱。今日やることのレポートがプロジェクトごとに並んでいる",
        board: "Genosのスプリントボード",
        todo: "Genosの今日のTo-Do",
        "tasks-dark": "ダークモードのタスク一覧",
        "phone-chat": "スマートフォンで見たチャット",
        "phone-tasks": "スマートフォンで見たタスク",
    },
    en: {
        ask: "A Genos answer with its source tasks and notes shown as chips",
        chat: "The Genos chat screen with a channel conversation and a thread",
        tasks: "The Genos task table with status, assignee, priority and sprint columns",
        task: "A Genos task open with its body, comments and linked thread",
        note: "A Genos note: a spec with headings, a checklist and a table",
        approval: "An approval card for a change Genos proposed, with Approve and Decline buttons",
        inbox: "The Genos Inbox with a report of today's work, grouped by project",
        board: "The Genos sprint board",
        todo: "Today's to-dos in Genos",
        "tasks-dark": "The task table in dark mode",
        "phone-chat": "Chat on a phone",
        "phone-tasks": "Tasks on a phone",
    },
};
