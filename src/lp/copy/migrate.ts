import type { Lang } from "../lpLang";

/**
 * /migrate copy, Japanese and English (MIP-1260): moving into Genos from Slack, Notion, Jira and
 * Google Docs, with only what the product does today.
 *
 * Truth rules for this file:
 *  - Every menu and button name is the app's own label (en/notes.ts `importMd`,
 *    `noteHeader` menu, `exportZip`; the Tasks toolbar). The folder rule ("every subfolder becomes
 *    a note folder, every markdown file a note") is the app's own `importMd.folderHint`.
 *  - Only `.md` files are imported from a folder. A CSV in a folder is skipped (checked in the app).
 *  - Tasks import from a CSV file (MIP-1835): a generic CSV, a Jira CSV export or a Notion
 *    database CSV export, from the project's menu ("Import tasks from CSV…", en/tasks.ts
 *    `importCsv`). Limits stated here are the importer's own (1,000 rows, e-mail match only).
 *    There is no import from Slack or Google Docs, and none of projects, comments or sprints.
 *    Those are listed as gaps, not promised. Each gap has a feature-request task (MIP-682).
 *  - Inline markup, parsed by MigratePage: **bold**, `code`, [label](#anchor) or [label](/path).
 *
 * `TODO(copy): MIP-1260` marks the wording Ken has to read before this page is merged.
 */

export interface MigrateCopy {
    title: string;
    /** TODO(copy): MIP-1260 */
    lead: string;
    startHeading: string;
    startIntro: string;
    startSteps: string[];
    notesHeading: string;
    notesIntro: string;
    notesOne: string[];
    notesFolder: string[];
    notesBack: string;
    tasksHeading: string;
    tasksBody: string;
    gapsHeading: string;
    gapsIntro: string;
    gaps: Array<{ tool: string; body: string }>;
    gapsOutro: string;
    nextHeading: string;
    nextLinks: Array<{ to: string; label: string }>;
}

export const MIGRATE_COPY: Record<Lang, MigrateCopy> = {
    en: {
        title: "Moving to Genos",
        lead: "What you can bring into Genos today, how to bring it, and what has no import yet. Genos does not sync with Slack, Notion, Jira or Google Docs. TODO(copy): MIP-1260",
        startHeading: "Start with one project",
        startIntro:
            "Move one piece of work first, not the whole company. Keep the old tool open, read-only, for its history.",
        startSteps: [
            "Create a project for that work: on the **Tasks** page, choose **New Project** under **Projects**.",
            "Write the open tasks in it by hand: open the project and choose **Task**.",
            "Bring over the notes you still need, as described below.",
        ],
        notesHeading: "Notes from Markdown",
        notesIntro:
            "Notes are the one kind of content you can import in bulk. Markdown (`.md`) files come in as notes; a whole folder comes in as a folder tree.",
        notesOne: [
            "Open a note's **More options** menu and choose **Import Markdown…**.",
            "Under **One file**, choose a `.md` file. Check the **Note title**, pick the **Folder**, then choose **Import**.",
        ],
        notesFolder: [
            "In the same dialog choose **Whole folder**, then **Choose a folder…**.",
            "Genos shows what it will create before it creates anything. Each subfolder becomes a note folder, and each `.md` file a note inside it. Images next to the pages are brought over with them.",
            "Choose **Import folder**. Files that are not Markdown are skipped: a CSV file in a folder, for example, is not imported.",
        ],
        notesBack:
            "To take notes out again: **Export as Markdown** is in a note's **More options** menu, and **Export folder as .zip** is in a note folder's menu.",
        tasksHeading: "Tasks",
        tasksBody:
            "Tasks can be imported from a CSV file, including a Jira CSV export or a Notion database exported as CSV. Open a project and choose **Import tasks from CSV…** in the menu at the top of its task list. Genos recognises the Jira and Notion column names, shows a preview before anything is created, and lists each row it could not import. Everything from one import can be removed again in one step. A file can hold up to 1,000 rows. People are matched by e-mail address only: a Notion export holds names, so those tasks arrive unassigned. An AI agent you connect through Claude can also create tasks in Genos; see [Connecting Genos to other tools](/docs/connecting). TODO(copy): MIP-1835",
        gapsHeading: "What does not come in",
        gapsIntro:
            "This is the honest list. Each item is a request we have recorded, not a promise.",
        gaps: [
            {
                tool: "Slack",
                body: "No import of channels, messages, threads or files. Move the decisions you need into a note, by hand or as a Markdown file.",
            },
            {
                tool: "Notion",
                body: "Notion pages can come in as notes from a Markdown export (see above). A Notion database can come in as tasks: export it as CSV and use the task import (see Tasks). Only the title, status, assignee, due date, tags, priority and parent are read.",
            },
            {
                tool: "Jira",
                body: "Issues can come in as tasks from a Jira CSV export (see Tasks). Projects, comments, attachments and sprints are not imported.",
            },
            {
                tool: "Google Docs",
                body: "No direct import of Google Docs, and no .docx import. In Google Docs choose File, Download, Markdown (.md), then import that file as a note (see above): headings, lists, tables, links and footnotes come in. Pictures stay inside the note as embedded images, and colours, comments and page layout are not kept.",
            },
        ],
        gapsOutro:
            "Nothing in this list is synced. Genos does not keep Slack, Notion, Jira or Google Docs up to date.",
        nextHeading: "Next",
        nextLinks: [
            { to: "/docs", label: "Docs: getting started" },
            { to: "/support", label: "Support" },
        ],
    },
    ja: {
        title: "Genos への移行",
        lead: "今すぐ Genos に持ち込めるもの、その方法、まだ取り込みができないものをまとめました。Genos は Slack、Notion、Jira、Google ドキュメントとは同期しません。 TODO(copy): MIP-1260",
        startHeading: "まずは1つのプロジェクトから",
        startIntro:
            "会社全体ではなく、1つの仕事から始めてください。古いツールは、履歴を見るために読み取り専用で開いたままにしておくと安心です。",
        startSteps: [
            "その仕事のプロジェクトを作ります。**Tasks** ページで **Projects** の下の **New Project** を選びます。",
            "未完了のタスクを、手で書き込みます。プロジェクトを開いて **Task** を選びます。",
            "必要なノートを、下の方法で持ち込みます。",
        ],
        notesHeading: "Markdown からのノート",
        notesIntro:
            "まとめて取り込めるのは、ノートだけです。Markdown（`.md`）ファイルはノートとして、フォルダーはフォルダーの階層として取り込まれます。",
        notesOne: [
            "ノートの **その他のオプション** メニューから **Markdownをインポート…** を選びます。",
            "**ファイル1件** で `.md` ファイルを選びます。**ノートのタイトル** と **フォルダ** を確認し、**インポート** を選びます。",
        ],
        notesFolder: [
            "同じダイアログで **フォルダ全体** を選び、**フォルダを選択…** を選びます。",
            "Genos は、作成する内容を先に表示します。サブフォルダはノートのフォルダに、その中の `.md` ファイルはノートになります。ページの横にある画像も一緒に取り込まれます。",
            "**フォルダをインポート** を選びます。Markdown 以外のファイルは取り込まれません。例えば、フォルダーの中の CSV は取り込まれません。",
        ],
        notesBack:
            "ノートを書き出すには、ノートの **その他のオプション** メニューの **Markdownとしてエクスポート**、またはノートフォルダのメニューの **フォルダを .zip でエクスポート** を使います。",
        tasksHeading: "タスク",
        tasksBody:
            "タスクは CSV ファイルから取り込めます。Jira の CSV 書き出しや、CSV として書き出した Notion のデータベースも使えます。プロジェクトを開き、タスク一覧の上にあるメニューから **CSVからタスクをインポート…** を選びます。Jira と Notion の列名は自動で認識され、作成する前にプレビューが表示され、取り込めなかった行は一覧で示されます。1回のインポートで作成したものは、まとめて削除できます。1ファイルは1,000行までです。担当者はメールアドレスだけで対応づけます。Notion の書き出しには名前しかないため、そのタスクは担当者なしで取り込まれます。Claude で接続した AI エージェントも、Genos にタスクを作成できます。詳しくは [Genos と他のツールをつなぐ](/docs/connecting) をご覧ください。 TODO(copy): MIP-1835",
        gapsHeading: "取り込めないもの",
        gapsIntro: "正直に一覧にしています。各項目は、記録された要望であり、約束ではありません。",
        gaps: [
            {
                tool: "Slack",
                body: "チャンネル、メッセージ、スレッド、ファイルは取り込めません。必要な決定事項は、手で、または Markdown ファイルとしてノートに移してください。",
            },
            {
                tool: "Notion",
                body: "Notion のページは、上記の Markdown 書き出しからノートとして取り込めます。Notion のデータベースは、CSV として書き出し、タスクのインポートで取り込めます(「タスク」を参照)。読み込むのは、タイトル、ステータス、担当者、期限、タグ、優先度、親だけです。",
            },
            {
                tool: "Jira",
                body: "課題は、Jira の CSV 書き出しからタスクとして取り込めます(「タスク」を参照)。プロジェクト、コメント、添付ファイル、スプリントは取り込めません。",
            },
            {
                tool: "Google ドキュメント",
                body: "Google ドキュメントの直接の取り込みと、.docx の取り込みはありません。Google ドキュメントで「ファイル」「ダウンロード」「Markdown (.md)」を選び、そのファイルをノートとして取り込んでください(上記参照)。見出し、リスト、表、リンク、脚注は取り込まれます。画像はノート内に埋め込まれた画像として残り、色、コメント、ページレイアウトは引き継がれません。",
            },
        ],
        gapsOutro:
            "この一覧のどれも同期はされません。Genos は、Slack、Notion、Jira、Google ドキュメントを最新に保ちません。",
        nextHeading: "次に",
        nextLinks: [
            { to: "/docs", label: "ドキュメント：はじめに" },
            { to: "/support", label: "サポート" },
        ],
    },
};
