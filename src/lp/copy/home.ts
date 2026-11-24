import type { Lang } from "../lpLang";

/**
 * /home copy, Japanese and English (MIP-1232).
 *
 * Written, not translated: the Japanese is its own text for the market it was
 * written for, so the two say the same things in different words.
 *
 * Truth rules for this file:
 *  - Anything not live in production says so (`coming: true`, rendered as a
 *    "Coming" badge). Checked 2026-11-08: the MCP OAuth server is live
 *    (`api.genosai.dev/.well-known/oauth-authorization-server`); ChatGPT's
 *    directory listing (MIP-1108) and Routines (MIP-1067) are not.
 *  - Numbers that can drift are not typed here: the MCP tool count is read
 *    from the developers page's tool list (`{tools}` below).
 *  - Nothing about model training: the privacy page deliberately makes no
 *    such claim (see its TODO(owner)), so neither does this page.
 *  - The examples are the demo workspace's own story (kept by MIP-1237): the
 *    "framer-motion or plain CSS?" spike of the website-redesign project. The
 *    page shows what "Try the demo" opens, so these words and the screenshots
 *    are the same events.
 *
 * The agent-record top of the page (MIP-1611: `hero`, `idea`, `how`, `record`,
 * `works`, `questions`) is written from the messaging brief v1 (Genos board,
 * task note 176). What it may and may not say:
 *  - "AI agent (e.g. Claude)", never "Claude" alone as the category. Works with
 *    Claude today; ChatGPT is "coming"; other agents are not supported yet.
 *  - Genos keeps what the agent writes, not the whole conversation. It is never
 *    "always written down", "remembers everything" or "automatic".
 *  - No "Secretary" / 秘書, no "MCP-native", no "AI memory", no first-month-free
 *    offer, no data-safety claim, no team-sharing claim, no "see everything in
 *    one place", and no number, logo or quote that is not real.
 *    `LandingPageAgentRecord.test.tsx` pins these for the new blocks.
 *  - The Japanese of those blocks is Ken's final text (2026-11-20), word for word,
 *    with the lead's four softened lines (the mark claims) and one sentence
 *    dropped from the hero subhead. The English is Ken's final English; every
 *    English string carries `TODO(copy: Ken's final English; Ken to review)`.
 *    Four English lines are softened from his draft, and the record subhead says
 *    "AI memory" because his text does (the brief's rule is waived for that one
 *    sentence): the PR body lists them with his original wording.
 *  - The callout labels over the hero picture (`hero.callouts`) are draft wording
 *    of the page author's (`TODO(copy)`), not Ken's.
 */

export type LineKind = "chat" | "note" | "task";

type Point = { text: string; coming?: boolean; plan?: string };

export type IdeaKey = "more" | "lose" | "keep";

export type HomeCopy = {
    meta: { title: string; description: string };
    hero: {
        title: string;
        /** Paragraphs are separated by a blank line. */
        sub: string;
        primary: string;
        secondary: string;
        note: string;
        /** One line under the screenshot: what the agent's mark means. */
        legend: string;
        /** The labels drawn over the screenshot: one at the agent's mark, one at a row without it. */
        callouts: { claude: string; you: string };
        /** Alt text of the hero screenshot (`record`). */
        alt: string;
    };
    /** The old hero (the decision's line and the Genos answer), moved below the new top. */
    line: {
        label: string;
        items: Array<{ kind: LineKind; tag: string; what: string; where: string }>;
    };
    heroAlt: string;
    idea: {
        kicker: string;
        tiles: Array<{ key: IdeaKey; title: string; body: string }>;
    };
    how: {
        kicker: string;
        title: string;
        steps: Array<{ title: string; body: string }>;
        plan: string;
        link: string;
    };
    record: {
        title: string;
        sub: string;
        /** A bold lead sentence, then a plain one. */
        points: Array<{ lead: string; text: string }>;
        tasksCaption: string;
        noteCaption: string;
    };
    works: {
        label: string;
        agents: Array<{ name: string; where?: string; state: string; coming?: boolean }>;
        also: { label: string; items: string[] };
        kept: string;
    };
    /** The one FAQ of the page (the earlier "More questions" list was merged into it). */
    questions: { title: string; items: Array<{ q: string; a: string }> };
    workspace: {
        kicker: string;
        title: string;
        sub: string;
        tabs: Array<{
            key: "chat" | "tasks" | "note";
            label: string;
            title: string;
            points: string[];
            alt: string;
        }>;
    };
    receipts: {
        kicker: string;
        title: string;
        sub: string;
        points: string[];
        askAlt: string;
        approvalAlt: string;
    };
    mcp: {
        kicker: string;
        title: string;
        sub: string;
        points: string[];
        clients: Array<{ name: string; state: string; coming?: boolean }>;
        transcript: {
            you: string;
            tool: string;
            ai: string;
            approve: string;
            approveBtn: string;
            label: string;
        };
        link: string;
    };
    secretary: {
        kicker: string;
        title: string;
        sub: string;
        points: Point[];
        privacy: string;
        alt: string;
    };
    audiences: { title: string; items: Array<{ to: string; title: string; body: string }> };
    trust: { title: string; items: string[] };
    plans: { title: string; body: string; link: string };
    cta: { title: string; body: string; primary: string; secondary: string };
    coming: string;
};

export const HOME_COPY: Record<Lang, HomeCopy> = {
    ja: {
        meta: {
            title: "Genos — いつもどおりAIと仕事をするだけ。記録はGenosに残ります。",
            description:
                "AIエージェントが作成したタスクやノートを、Genosに記録。あとから開いて、読んで、編集できる。Claudeで利用可能。ChatGPTも近日公開。",
        },
        hero: {
            title: "いつもどおり、AIと仕事をするだけ。記録は、AIがGenosに残します。",
            sub: "AIエージェント（Claudeなど）に、これまでどおり仕事を頼むだけ。特別な指示がなくても、エージェントは作業しながら、タスク・ノート・決めたこと・進み具合をGenosに書き留めます。\n\nAIが何をしたか見たくなったら、Genosを開くだけ。",
            primary: "Claudeを接続する",
            secondary: "デモを試す",
            note: "現在はClaudeに対応。ChatGPTも近日公開。一度つなぐだけで使えます。",
            legend: "タスク・コメント・ノートでは、AIが作成・更新したものに印が付きます。あなたが書いたものと見分けられます。",
            alt: "Genosのタスクのアクティビティ画面。Claudeが作成したコメントにはClaudeのマークが表示され、ユーザーが変更した優先度やコメントにはマークが付いていない。",
            // TODO(copy): draft wording of mine, not Ken's; the callouts drawn over the hero picture.
            callouts: {
                claude: "Claudeが書いた",
                you: "あなたが書いた",
            },
        },
        idea: {
            kicker: "なぜGenos？",
            tiles: [
                {
                    key: "more",
                    title: "AIに、もっと仕事を任せられる。",
                    body: "AIができることは、質問への回答だけではありません。調査も、計画も、実際の作業も。任せられる仕事が増えています。",
                },
                {
                    key: "lose",
                    title: "でも、仕事の記録は散らばっていく。",
                    body: "セッションが変われば、前の話を説明し直す。別のAIに切り替えれば、経緯が伝わらない。任せる仕事が増えるほど、その記録を追うのも大変になります。",
                },
                {
                    key: "keep",
                    title: "Genosなら、仕事の記録が残る。",
                    body: "AIが作成したタスク、コメント、ノートを、あとから開いて確認できます。AIに任せた仕事を、あなたの手元に。",
                },
            ],
        },
        how: {
            kicker: "使い方",
            title: "一度つなぐだけ。あとは、いつもどおり。",
            steps: [
                {
                    title: "いつもどおり、AIに頼む",
                    body: "ClaudeなどのAIエージェントに、計画や調査、作業をこれまでどおり頼みます。Genosを開く必要はありません。",
                },
                {
                    title: "AIが、Genosに書き留める",
                    body: "エージェントは作業しながら、タスク、コメント、ノートをGenosに残します。決めたことは、理由と日付を添えたノートに。",
                },
                {
                    title: "見たいときに、Genosを開く",
                    body: "AIが何をしたか、Genosで読めます。編集も削除も自由。AIが作成・更新したものには印が付くので、あなたの記録と見分けられます。",
                },
            ],
            plan: "エージェントの接続にはCoreプラン以上が必要です。",
            link: "接続方法を見る",
        },
        record: {
            title: "AIの記憶だけに、仕事を預けますか？",
            sub: "AIの中だけにある記憶ではなく、あなた自身が開いて確認できる記録を。Genosなら、エージェントが残した仕事をタスクやノートとして管理できます。",
            points: [
                {
                    lead: "いつでも読める。",
                    text: "タスクやノートとして、Genos上に残ります。",
                },
                {
                    lead: "自分で管理できる。",
                    text: "エージェントが書いたものも、編集・削除できます。",
                },
                {
                    lead: "誰が書いたか分かる。",
                    text: "タスク・コメント・ノートでは、AIが作成・更新したものに印が付き、あなたの記録と見分けられます。",
                },
            ],
            tasksCaption: "タスク一覧",
            noteCaption: "ノート",
        },
        line: {
            label: "ひとつの決定がたどった経緯",
            items: [
                {
                    kind: "chat",
                    tag: "議論",
                    what: "マーケは CSS だけで行く方向。難しいのはドロワーだけ",
                    where: "スパイク調査タスクのコメント",
                },
                {
                    kind: "note",
                    tag: "決定",
                    what: "マーケティングページでは framer-motion を使わない",
                    where: "同じタスクの「決定事項」",
                },
                {
                    kind: "task",
                    tag: "反映",
                    what: "ナビは CSS のドロワーで実装。800バイト（framer-motion は40KB）",
                    where: "全体チャットで共有されたナビのPR",
                },
            ],
        },
        heroAlt:
            "Genosの回答画面。「ホームページの作り直しを止めているものは何ですか？」に、リンクつきのタスクと出典チップを添えて答えている",
        works: {
            label: "連携",
            agents: [
                {
                    name: "Claude",
                    where: "claude.ai、Claude Desktop、Claude Code",
                    state: "今すぐ使えます",
                },
                {
                    name: "ChatGPT",
                    state: "近日公開",
                    coming: true,
                },
            ],
            // The two integrations the old strip listed, kept.
            also: {
                label: "その他の連携",
                items: ["Googleカレンダー", "GitHub"],
            },
            kept: "Genosに残るのは、エージェントが作成・更新したタスク、コメント、ノートです。会話の全文を保存するものではありません。",
        },
        // One FAQ (MIP-1611): the four questions Ken wrote, then the two earlier ones that stay true.
        questions: {
            title: "よくある質問",
            items: [
                {
                    q: "Genosは何を記録しますか？",
                    a: "エージェントがGenosに作成・更新したタスク、コメント、ノートです。会話の全文を保存するわけではありません。",
                },
                {
                    q: "どのAIエージェントで使えますか？",
                    a: "現在はClaudeに対応しています。claude.ai、Claude Desktop、Claude Codeで利用できます。ChatGPTにも近日対応予定です。その他のエージェントは、現在対応していません。",
                },
                {
                    q: "エージェントが書いたものを、自分で編集・削除できますか？",
                    a: "はい。エージェントが作成したものも、あなたのワークスペースにある通常のタスク・コメント・ノートです。自分で作成したものと同じように、開いて確認し、編集・削除できます。",
                },
                {
                    q: "どのプランが必要ですか？",
                    a: "エージェントの接続にはCoreプラン以上が必要です。Freeプランでは、チャット・タスク・ノートをご利用いただけます。",
                },
                {
                    q: "Genosが記録する私の活動は、誰が見られますか？",
                    a: "あなただけです。チームのダッシュボードや他の人への回答には使われません。設定からいつでも止められ、止めると記録は削除されます。",
                },
                {
                    q: "登録せずに試せますか？",
                    a: "はい。デモを開くと、チャット・タスク・ノートが入ったサンプルチームのワークスペースが日本語で開きます。インストールもカードも不要です。",
                },
            ],
        },
        workspace: {
            kicker: "ひとつのワークスペース",
            title: "チャット、タスク、ノートが、たがいにつながっています。",
            sub: "チャットで決まったことをドキュメントに写し、さらにチケットに写す。その手間はもういりません。Genosではスレッド・ノート・タスクが互いにリンクしているので、翌月になっても経緯をたどれます。",
            tabs: [
                {
                    key: "chat",
                    label: "チャット",
                    title: "そのまま仕事になるチャット",
                    points: [
                        "チャンネル・スレッド・DM。メンション、リアクション、カスタム絵文字やGIFも",
                        "スレッドからタスクを作成。タスクには元のスレッドへのリンクが残ります",
                        "チャットのピン留め、メッセージのフラグ、検索で過去の決定を見つけられます",
                    ],
                    alt: "Genosのチャット画面。チャンネルの会話とスレッドが開いている",
                },
                {
                    key: "tasks",
                    label: "タスク",
                    title: "理由を忘れないタスク",
                    points: [
                        "テーブル・ボード・ダッシュボード。スプリントとマイルストーン",
                        "依存関係、プロジェクトごとのカスタム項目、保存できるフィルター",
                        "変更はタスクの履歴に残り、ブランチ名にタスクIDを含むGitHubのPRは自動でひも付きます",
                    ],
                    alt: "Genosのタスク一覧。ステータス・担当・優先度・スプリントが並ぶテーブル",
                },
                {
                    key: "note",
                    label: "ノート",
                    title: "みんなで同時に書けるノート",
                    points: [
                        "リアルタイム共同編集、フォルダ、共有、版の復元",
                        "タスクノートとチャットノートが、説明している仕事のすぐ隣に",
                        "Markdownの取り込みと書き出し",
                    ],
                    alt: "Genosのノート画面。見出し・チェックリスト・表を含む仕様メモ",
                },
            ],
        },
        receipts: {
            kicker: "Genosに聞く",
            title: "確かめられる答え。承認してから動く変更。",
            sub: "Genosは、チームのチャット・タスク・ノートを同僚のように読み込みます。Genosの回答には、引用元のスレッド・ノート・タスクへのリンクが付きます。Genos自身のAIは、あなたが「はい」と言うまで何も書き換えません。",
            points: [
                "Genosの回答では、引用元のスレッド・ノート・タスクをその場で開いて確認できます",
                "提案して、待つ。タスク・ノート・To-Do・予定の変更は承認後にだけ実行されます",
                "質問した言語で回答。画面は7言語に対応しています",
            ],
            askAlt: "Genosの回答。出典のチャット・ノート・タスクがチップで並んでいる",
            approvalAlt: "Genosが提案した変更の承認カード。承認と却下のボタンがある",
        },
        mcp: {
            kicker: "MCPで接続",
            title: "Claudeから、Genosを使う。",
            sub: "一度つなげば、普段使っているAIアシスタントがあなたのプロジェクトを読み、最新に保ちます。状況のまとめ、今日の計画、タスクの更新、ノートの作成。変更を許可する範囲は、あなたが決めます。",
            points: [
                "タスク、マイルストーン、スプリント、ノート、チャット、To-Do、カレンダーを扱う{tools}個のツール",
                "Genosアカウントでサインイン（OAuth）。キーのコピーは不要で、接続は設定画面でいつでも確認・解除できます",
                "接続したアプリに許可する範囲は、あなたが選べます。読み取りと変更。削除は別途許可が必要です",
            ],
            clients: [
                { name: "Claude", state: "コネクタとして利用可能" },
                { name: "ChatGPT", state: "近日公開", coming: true },
            ],
            transcript: {
                label: "AIアシスタントとの会話の例",
                you: "Webサイトリニューアルの状況を教えて。",
                tool: "get_my_briefing",
                ai: "火曜以降の動きです。framer-motion のスパイク調査は完了し、CSS のみで行く決定になりました。アクセシビリティ監査は Hero と FeatureGrid の完成待ち、モバイル Safari の読み込み遅延は調査中です。次の2件を今日のTo-Doに追加しますか？",
                approve: "今日のTo-Doに2件を追加",
                approveBtn: "承認",
            },
            link: "すべてのツールを見る",
        },
        secretary: {
            kicker: "状況のまとめ",
            title: "追いかけるのは、Genosの仕事。",
            sub: "コメント、変更、新しいリンク。あなたの仕事で起きたことをGenosが追いかけ、大事なことだけを伝えます。進捗報告を書く必要はありません。",
            points: [
                {
                    text: "「状況を教えて」のひと言で、他の人の動き・あなた待ちのこと・あなたが待っていることを一度に",
                },
                { text: "何が大事かは、古くなりがちな優先度ではなく、実際の動きから学習します" },
                {
                    text: "決まった時間に受信箱へレポート。AIの利用量を表示し、ワンクリックで止められます",
                    plan: "Core以上",
                },
                { text: "ルーティン：よく使う指示を保存して、スケジュールで実行", coming: true },
                { text: "チャットの返信下書き。送信するのはあなた", coming: true },
            ],
            privacy:
                "Genosが記録するあなたの活動は、あなただけが見られます。オフにすれば削除されます。",
            alt: "Genosの受信箱。今日やることのレポートが、プロジェクトごとにチップつきで並んでいる",
        },
        audiences: {
            title: "あなたの仕事のかたちに合わせて",
            items: [
                {
                    to: "/for-research",
                    title: "研究・研究室",
                    body: "仮説・実験・結果を、次の実験までつなぐ。",
                },
                {
                    to: "/for-teams",
                    title: "業務チーム",
                    body: "会議・メモ・フォローアップを、取りこぼさない。",
                },
                {
                    to: "/for-projects",
                    title: "プロジェクト・スタートアップ",
                    body: "決定・仕様・タスクを、ずれないままに。",
                },
                {
                    to: "/for-students",
                    title: "学生・ゼミ",
                    body: "講義・ノート・課題が、つながる。",
                },
            ],
        },
        trust: {
            title: "Genos自身のAIの動き方",
            items: [
                "Genosの回答では、引用元のスレッド・ノート・タスクを開いて確認できます。",
                "Genos自身のAIは、あなたが承認したあとにだけ変更します。",
            ],
        },
        plans: {
            title: "まずは無料で。",
            body: "Freeプランでチャット・タスク・ノートを使えます。Core以上でMCP接続とGenosレポートが使え、上位プランほどAIの上限が広がります。",
            link: "プランを比較する",
        },
        cta: {
            title: "エージェントが残した記録を、見てみよう。",
            body: "数秒でデモを開くか、無料のワークスペースを作成できます。",
            primary: "デモを試す",
            secondary: "無料で始める",
        },
        coming: "近日公開",
    },
    en: {
        meta: {
            // TODO(copy: Ken's final English; Ken to review)
            title: "Genos — Just work with your AI as usual. It keeps the record in Genos.",
            // TODO(copy: Ken's final English; Ken to review)
            description:
                "Genos saves the tasks, comments, and notes your AI agent creates, so you can open, review, and edit them anytime. Available with Claude. ChatGPT coming soon.",
        },
        hero: {
            // TODO(copy: Ken's final English; Ken to review)
            title: "Just work with your AI as usual. It keeps the record in Genos.",
            // TODO(copy: Ken's final English; Ken to review)
            sub: "Keep asking your AI agent (like Claude) for work the way you do now. As it works, it writes the tasks, notes, decisions, and progress into Genos. No special prompts needed.\n\nWhen you want to see what your AI did, open Genos.",
            // TODO(copy: Ken's final English; Ken to review)
            primary: "Connect Claude",
            // TODO(copy: Ken's final English; Ken to review)
            secondary: "Try the demo",
            // TODO(copy: Ken's final English; Ken to review)
            note: "Works with Claude today. ChatGPT coming soon. Connect once to start.",
            // TODO(copy: Ken's final English; Ken to review)
            // SOFTENED from Ken's draft by the lead (listed in the PR body).
            legend: "In tasks, comments and notes, what the AI created or updated carries a mark, so you can tell it apart from what you wrote.",
            // TODO(copy: Ken's final English; Ken to review)
            alt: "The Activity view of a task in Genos. The comment Claude created shows Claude's mark; the priority change and the comment made by the user have no mark.",
            // TODO(copy): draft wording of mine, not Ken's; the callouts drawn over the hero picture.
            callouts: {
                claude: "by Claude",
                you: "by you",
            },
        },
        idea: {
            // TODO(copy: Ken's final English; Ken to review)
            kicker: "Why Genos?",
            tiles: [
                {
                    key: "more",
                    // TODO(copy: Ken's final English; Ken to review)
                    title: "Give AI more of the work.",
                    // TODO(copy: Ken's final English; Ken to review)
                    body: "AI can do more than answer questions. It can research, plan, and get things done. There's more work you can hand over than ever before.",
                },
                {
                    key: "lose",
                    // TODO(copy: Ken's final English; Ken to review)
                    title: "But keeping track of that work gets harder.",
                    // TODO(copy: Ken's final English; Ken to review)
                    body: "Start a new session, and you have to explain the context all over again. Switch to another AI, and the background doesn't come with you. The more work you delegate, the harder it becomes to keep track of what's been done.",
                },
                {
                    key: "keep",
                    // TODO(copy: Ken's final English; Ken to review)
                    title: "Genos keeps a record of the work.",
                    // TODO(copy: Ken's final English; Ken to review)
                    body: "The tasks, comments, and notes your AI creates in Genos stay there, ready for you to open and review whenever you need them. The work you delegate doesn't have to disappear when the session ends.",
                },
            ],
        },
        how: {
            // TODO(copy: Ken's final English; Ken to review)
            kicker: "How it works",
            // TODO(copy: Ken's final English; Ken to review)
            title: "Connect once. Then work as usual.",
            steps: [
                {
                    // TODO(copy: Ken's final English; Ken to review)
                    title: "Ask your AI as usual.",
                    // TODO(copy: Ken's final English; Ken to review)
                    body: "Ask your AI agent (like Claude) to plan, research, or get things done, the way you do now. No need to open Genos.",
                },
                {
                    // TODO(copy: Ken's final English; Ken to review)
                    title: "It writes things down in Genos.",
                    // TODO(copy: Ken's final English; Ken to review)
                    body: "As it works, your agent creates tasks, comments, and notes in Genos. When something is decided, it goes into a note with the reason and the date.",
                },
                {
                    // TODO(copy: Ken's final English; Ken to review)
                    title: "Open Genos when you want to look.",
                    // TODO(copy: Ken's final English; Ken to review)
                    // SOFTENED from Ken's draft by the lead (listed in the PR body).
                    body: "See what your AI did, and edit or delete any of it. In tasks, comments and notes, what the AI wrote carries a mark, so you can tell it apart from your own.",
                },
            ],
            // TODO(copy: Ken's final English; Ken to review)
            plan: "Connecting an AI agent requires the Core plan or above.",
            // TODO(copy: Ken's final English; Ken to review)
            link: "See how to connect",
        },
        record: {
            // TODO(copy: Ken's final English; Ken to review)
            title: "Don't leave your work in AI's memory alone.",
            // TODO(copy: Ken's final English; Ken to review)
            sub: "AI memory lives inside the agent. Genos gives you a record you can open, review, and manage yourself. With Genos, the work your AI agent records becomes part of your workspace.",
            points: [
                {
                    // TODO(copy: Ken's final English; Ken to review)
                    // SOFTENED from Ken's draft by the lead (listed in the PR body).
                    lead: "Open it any time.",
                    // TODO(copy: Ken's final English; Ken to review)
                    text: "Tasks, comments, and notes stay in Genos, ready to revisit.",
                },
                {
                    // TODO(copy: Ken's final English; Ken to review)
                    lead: "Yours to manage.",
                    // TODO(copy: Ken's final English; Ken to review)
                    text: "Edit or delete anything your agent creates, just as you would with your own work.",
                },
                {
                    // TODO(copy: Ken's final English; Ken to review)
                    lead: "Know who wrote what.",
                    // TODO(copy: Ken's final English; Ken to review)
                    // SOFTENED from Ken's draft by the lead (listed in the PR body).
                    text: "In tasks, comments and notes, AI-created and updated content carries a mark, so you can tell it from your own.",
                },
            ],
            // TODO(copy: Ken's final English; Ken to review)
            tasksCaption: "Task list",
            // TODO(copy: Ken's final English; Ken to review)
            noteCaption: "Notes",
        },
        line: {
            label: "How one decision happened",
            items: [
                {
                    kind: "chat",
                    tag: "Discussed",
                    what: "Leaning toward CSS-only for marketing; the drawer is the tricky part",
                    where: "Comments on the spike task",
                },
                {
                    kind: "note",
                    tag: "Decided",
                    what: "No framer-motion on the marketing pages",
                    where: "The same task's Decision section",
                },
                {
                    kind: "task",
                    tag: "Applied",
                    what: "The nav ships with a CSS drawer: 800 bytes, not 40 KB",
                    where: "Nav PR shared in the general chat",
                },
            ],
        },
        heroAlt:
            'A Genos answer to "What\'s blocking the homepage rebuild?", with linked tasks and source chips underneath',
        works: {
            // TODO(copy: Ken's final English; Ken to review)
            label: "Integrations",
            agents: [
                {
                    name: "Claude",
                    // TODO(copy: Ken's final English; Ken to review)
                    where: "claude.ai, Claude Desktop, Claude Code",
                    // TODO(copy: Ken's final English; Ken to review)
                    state: "Available now",
                },
                {
                    name: "ChatGPT",
                    // TODO(copy: Ken's final English; Ken to review)
                    state: "Coming soon",
                    coming: true,
                },
            ],
            // The two integrations the old strip listed, kept.
            also: {
                // TODO(copy: Ken's final English; Ken to review)
                label: "Also integrates with",
                items: ["Google Calendar", "GitHub"],
            },
            // TODO(copy: Ken's final English; Ken to review)
            kept: "Genos stores the tasks, comments, and notes your AI agent creates or updates. It does not store the full text of your conversations.",
        },
        // One FAQ (MIP-1611): the four questions Ken wrote, then the two earlier ones that stay true.
        questions: {
            // TODO(copy: Ken's final English; Ken to review)
            title: "Questions",
            items: [
                {
                    // TODO(copy: Ken's final English; Ken to review)
                    q: "What does Genos record?",
                    a: "Genos records the tasks, comments, and notes your AI agent creates or updates in your workspace. It does not store the full text of your conversations.",
                },
                {
                    // TODO(copy: Ken's final English; Ken to review)
                    q: "Which AI agents does Genos support?",
                    a: "Genos currently works with Claude on claude.ai, Claude Desktop, and Claude Code. ChatGPT support is coming soon. Other AI agents are not supported yet.",
                },
                {
                    // TODO(copy: Ken's final English; Ken to review)
                    q: "Can I edit or delete content created by my AI agent?",
                    a: "Yes. Anything your agent creates becomes a regular task, comment, or note in your workspace. You can open, review, edit, or delete it just like content you created yourself.",
                },
                {
                    // TODO(copy: Ken's final English; Ken to review)
                    q: "Which plan do I need to connect an AI agent?",
                    a: "Connecting an AI agent requires the Core plan or above. The Free plan includes chat, tasks, and notes.",
                },
                {
                    q: "Who can see what Genos notes about my work?",
                    a: "Only you. It never appears in team dashboards or in answers to other people. You can turn it off in Settings at any time, and turning it off deletes it.",
                },
                {
                    q: "Can I try it without signing up?",
                    a: "Yes. The demo opens a sample team's workspace, with chats, tasks and notes already in it, in your language. Nothing to install, no card.",
                },
            ],
        },
        workspace: {
            kicker: "One workspace",
            title: "Chat, tasks and notes that link to each other.",
            sub: "No more copying a decision from chat into a doc, then into a ticket. In Genos the thread, the note and the task point at each other, so the context is still there next month.",
            tabs: [
                {
                    key: "chat",
                    label: "Chat",
                    title: "Chat that turns into work",
                    points: [
                        "Channels, threads and DMs with mentions, reactions, custom emoji and GIFs",
                        "Create a task from a thread; the task keeps a link back",
                        "Pin chats, flag messages and search to find old decisions",
                    ],
                    alt: "The Genos chat screen with a channel conversation and a thread open",
                },
                {
                    key: "tasks",
                    label: "Tasks",
                    title: "Tasks that remember why",
                    points: [
                        "Table, board and dashboard views, sprints and milestones",
                        "Dependencies, per-project custom fields and saved filters",
                        "Task changes are kept in its history; a GitHub PR whose branch name includes the task id links to it automatically",
                    ],
                    alt: "The Genos task table with status, assignee, priority and sprint columns",
                },
                {
                    key: "note",
                    label: "Notes",
                    title: "Notes everyone edits at once",
                    points: [
                        "Real-time co-editing, folders, sharing and version restore",
                        "Task notes and chat notes sit next to the work they explain",
                        "Import and export Markdown",
                    ],
                    alt: "A Genos note: a spec with headings, a checklist and a table",
                },
            ],
        },
        receipts: {
            kicker: "Ask Genos",
            title: "Answers you can check. Changes you approve.",
            sub: "Genos reads your team's chats, tasks and notes the way a colleague would. Genos's answers link to the thread, note or task they quote, and Genos's own assistant changes nothing until you say yes.",
            points: [
                "In Genos's answers, you can open the thread, note or task each one quotes",
                "It proposes, then waits: tasks, notes, to-dos and events change only after you approve",
                "Answers in the language you ask in, in an app available in 7 languages",
            ],
            askAlt: "A Genos answer with its source chat, note and task shown as chips",
            approvalAlt:
                "An approval card for a change Genos proposed, with Approve and Decline buttons",
        },
        mcp: {
            kicker: "Works over MCP",
            title: "Use Genos from Claude.",
            sub: "Connect once, and the assistant you already use can read your projects and keep them current: catch you up, plan your day, update a task, write a note. You decide what it is allowed to change.",
            points: [
                "{tools} tools for tasks, milestones, sprints, notes, chats, to-dos and calendar",
                "Sign in with your Genos account (OAuth): no keys to copy, and every connection is listed in Settings, where you can end it",
                "You choose what a connected app may do: read, or write. Deleting needs a separate opt-in.",
            ],
            clients: [
                { name: "Claude", state: "Available as a connector" },
                { name: "ChatGPT", state: "Coming", coming: true },
            ],
            transcript: {
                label: "An example conversation with an AI assistant",
                you: "Catch me up on the website redesign.",
                tool: "get_my_briefing",
                ai: "Since Tuesday: the framer-motion spike is closed, and the call is CSS-only. The accessibility audit is waiting on the hero and feature grid, and the slow mobile Safari load is still being investigated. Want me to put the next two on today's to-do list?",
                approve: "Add 2 items to today's to-do list",
                approveBtn: "Approve",
            },
            link: "See every tool",
        },
        secretary: {
            kicker: "Catch-up",
            title: "It keeps track, so you don't have to.",
            sub: "Comments, changes, new links: Genos follows what happens on your work and tells you what matters. You never write a status report.",
            points: [
                {
                    text: "One ask catches you up: what others did on your items, what's waiting on you, what you're waiting on",
                },
                {
                    text: "What matters is learned from real activity, not from priority fields that go stale",
                },
                {
                    text: "Reports in your Inbox on your schedule, with the AI cost shown and a one-click off",
                    plan: "Core and up",
                },
                { text: "Routines: save an instruction and run it on a schedule", coming: true },
                { text: "Reply drafts in chat; you press send", coming: true },
            ],
            privacy:
                "What Genos notes about your work is visible only to you. Turn it off and it's deleted.",
            alt: "The Genos Inbox with a report of today's work, grouped by project with status chips",
        },
        audiences: {
            title: "Made for how you work",
            items: [
                {
                    to: "/for-research",
                    title: "Research and labs",
                    body: "Hypotheses, experiments and results, linked to the next experiment.",
                },
                {
                    to: "/for-teams",
                    title: "Business teams",
                    body: "Meetings, notes and follow-ups that don't fall through.",
                },
                {
                    to: "/for-projects",
                    title: "Projects and startups",
                    body: "Decisions, specs and tasks that stay in sync.",
                },
                {
                    to: "/for-students",
                    title: "Students",
                    body: "Lectures, notes and assignments in one place.",
                },
            ],
        },
        trust: {
            title: "How Genos's own assistant behaves",
            items: [
                "In Genos's answers, you can open the thread, note or task each one quotes.",
                "Genos's own assistant changes your work only after you approve.",
            ],
        },
        plans: {
            title: "Start free.",
            body: "The Free plan covers chat, tasks and notes. Core and up add MCP connections and Genos reports, and higher plans raise the AI limits.",
            link: "Compare plans",
        },
        cta: {
            title: "See what your agent leaves behind.",
            body: "Open the demo in seconds, or start a free workspace.",
            primary: "Try the demo",
            secondary: "Start free",
        },
        coming: "Coming",
    },
};
