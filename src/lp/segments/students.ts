import type { SegmentConfig } from "./types";

export const students: SegmentConfig = {
    key: "students",
    route: "/for-students",
    mailtoTag: "[Genos Student Feedback]",
    secondaryCtaKind: "anchor",
    ja: {
        meta: {
            title: "Genos for Students | ノート・課題・予定をつなぐAI学習ワークスペース",
            description:
                "授業ノート、課題、Todo、予定、振り返りをひとつの学習履歴に。Genos AIが根拠リンク付きで今週の学びと次に復習すべきことを整理します。",
            ogTitle: "学んだことを、次に学ぶことへつなげる。",
            ogDescription:
                "ノート・課題・予定・振り返りを、ひとつの学習履歴に。無料プランはクレジットカード不要。",
        },
        hero: {
            title: "学んだことを、次に学ぶことへつなげる。",
            sub: "ノート・課題・予定・振り返りを、ひとつの学習履歴に。",
            lead: "授業ノートはある。課題の期限もカレンダーにある。それでも、今週何を理解し、どこでつまずき、次に何を復習すべきかは分かりにくい。Genosは、ノート、タスク、Todo、予定、学習の会話をひとつのワークスペースに置き、Genos AIが自分の記録をもとに根拠リンク付きで答えます。",
            primary: "無料で試す",
            secondary: "学習フローを見る",
            footnote:
                "ログインなしでデモを体験できます。無料プランはクレジットカード不要です。現在はWebブラウザのみで利用できます。",
        },
        trust: [
            "授業ノート・課題・Todo・予定をひとつに",
            "AIの回答から、自分の元のノートへ戻れる",
            "一つの授業から無料で始められる",
        ],
        questions: {
            title: "ノートを取ることと、学びを振り返れることは違う。",
            items: [
                "今週、何を学びましたか？",
                "どの考え方で、繰り返しつまずいていますか？",
                "次に提出する課題は何ですか？",
                "試験前に、どのノートを復習すべきですか？",
            ],
            closing:
                "学習の記録は、保存するためではなく、自分の次の行動を決めるために使えるべきです。",
        },
        workflow: {
            title: "一つの授業で、学ぶ・取り組む・振り返るをつなぐ。",
            body: "Genosを学期全体へ広げる前に、一つの授業または研究テーマで使います。",
            steps: [
                "授業・読書",
                "ノート",
                "疑問",
                "課題・練習・Todo",
                "結果・フィードバック",
                "次の学習計画",
            ],
        },
        features: [
            {
                title: "授業ノート",
                subtitle: "授業ごとの記録を、学期全体の学びにつなげる",
                bullets: [
                    "講義ノート、読書メモ、疑問、振り返りを保存",
                    "長いノートを要約し、内容について質問",
                    "グループ課題では、共同ノートとして利用",
                ],
            },
            {
                title: "課題と予定",
                subtitle: "何を、いつまでに、どの順番で進めるかを整理",
                bullets: [
                    "課題、練習、Todo、期限、予定を管理",
                    "自分の未完了作業と次の期限を質問",
                    "Action対応プランでは、学習計画のタスク・予定化を確認後に実行",
                ],
            },
            {
                title: "根拠へ戻れる学習AI",
                subtitle: "自分の記録をもとに質問し、元のノートを確認",
                bullets: [
                    "ノート、タスク、Todo、予定、会話を横断して質問",
                    "回答から元の記録へ戻れるリンク",
                    "自分が理解したこと、迷ったこと、次に確認することを整理",
                ],
            },
        ],
        ai: {
            title: "今週の学びと、次に復習すべきことを質問できる。",
            body: "Genos AIは、自分のワークスペースに保存したノート、課題、Todo、予定、会話を読み、根拠リンク付きで答えます。AIの答えをそのまま提出物として使うのではなく、自分の記録を振り返り、次の学習行動を決めるために使います。",
            prompts: [
                "今週、何を学びましたか？",
                "どの概念で、繰り返しつまずいていますか？",
                "次の締切までに終えるべき課題は何ですか？",
                "このノートを要約し、復習すべきポイントを挙げてください。",
                "自分のノートと期限をもとに、今週の学習計画を提案してください。",
            ],
        },
        now: [
            "ノート、タスク、Todo、予定を同じワークスペースで管理",
            "ノート、課題、予定、会話を横断したAI回答",
            "回答から元の情報へ戻れるリンク",
            "長いノートやスレッドの要約",
            "UI言語に合わせた回答",
            "無料プランとログイン不要デモ",
        ],
        coming: [
            "AIへの質問にPDFや画像を直接添付する",
            "ルーティン：よく使う指示を保存して、スケジュールで実行する",
            "チャットの返信下書き（送信するのはいつもあなた）",
        ],
        audience: {
            title: "ノートは取っているのに、学期全体の学びがつながらない人へ。",
            items: [
                "複数の授業で、ノートと課題の管理が分かれている大学生",
                "研究テーマと日々のタスクを一緒に整理したい大学院生",
                "試験前に大量のノートを最初から読み直している学生",
                "ゼミ、勉強会、グループ課題で記録と担当を共有したいチーム",
                "一般的なAIの答えより、自分の学習履歴を振り返りたい人",
            ],
            quote: "今週、結局何を理解できたんだろう？",
        },
        faq: {
            title: "よくある質問",
            items: [
                {
                    q: "無料で使えますか？",
                    a: "はい。無料プランがあり、クレジットカードは不要です。プランによってAI利用量や、AIがタスク・予定へ書き込める範囲が異なります。",
                },
                {
                    q: "講義PDFやスライドを直接読ませられますか？",
                    a: "現在、AIへの質問にPDFや画像を直接添付する機能と、ワークスペース内の全教材を横断検索する機能は未提供です。ファイルを質問へ添付する機能はロードマップに含まれています。",
                },
                {
                    q: "課題のリマインダーを送れますか？",
                    a: "現在、予定や期限を管理することはできますが、「金曜日に思い出させて」のように後から自動で戻ってくるリマインダー機能は未提供です。",
                },
                {
                    q: "グループ課題でも使えますか？",
                    a: "はい。会話、共同ノート、タスクを同じワークスペースで管理できるため、ゼミ、勉強会、グループ課題にも利用できます。",
                },
                {
                    q: "Genosに課題を解かせるためのサービスですか？",
                    a: "主な目的は、自分のノート、課題、予定、振り返りをつなぎ、学習履歴を理解しやすくすることです。授業や大学のルールに従い、AIの回答は必ず元の資料と自分の理解で確認してください。",
                },
            ],
        },
        cta: {
            title: "一つの授業を、4週間だけGenosでつないでみる。",
            body: "授業ノート、課題、Todo、予定、週次の振り返りを一つのワークスペースに置いてください。試験前の探し直しが減るか、次に勉強することが明確になるかを確かめられます。",
            primary: "無料で試す",
            secondary: "学習フローを見る",
        },
    },
    en: {
        meta: {
            title: "Genos for Students | Connect notes, assignments, and study plans",
            description:
                "Keep course notes, assignments, todos, schedules, and reflections in one learning history. Ask Genos what you learned, what is due, and what to review next—with links to the source.",
            ogTitle: "Turn what you learned into what to study next.",
            ogDescription:
                "Keep notes, assignments, schedules, and reflection connected in one learning workspace. Free plan, no credit card required.",
        },
        hero: {
            title: "Turn what you learned into what to study next.",
            sub: "Keep notes, assignments, schedules, and reflection in one learning history.",
            lead: "You have the lecture notes and the assignment deadline is on a calendar, but it is still hard to see what you understood, where you struggled, and what to review next. Genos keeps notes, tasks, todos, schedules, and study discussions in one workspace. Genos AI answers from your own records and links back to the source.",
            primary: "Try Genos free",
            secondary: "See the study workflow",
            footnote:
                "Explore the demo without logging in. The free plan requires no credit card. Genos is currently available in a web browser.",
        },
        trust: [
            "Keep course notes, assignments, todos, and schedules together",
            "Open your original notes from an AI answer",
            "Start free with one course",
        ],
        questions: {
            title: "Taking notes is not the same as being able to reflect on what you learned.",
            items: [
                "What did I learn this week?",
                "Which concepts do I keep struggling with?",
                "What assignment is due next?",
                "Which notes should I review before the exam?",
            ],
            closing:
                "A learning record should not exist only for storage. It should help decide the learner's next action.",
        },
        workflow: {
            title: "Connect learning, practice, and reflection in one course.",
            body: "Before using Genos for an entire semester, begin with one course or study theme.",
            steps: [
                "Lecture or reading",
                "Note",
                "Question",
                "Assignment, practice, or todo",
                "Result and feedback",
                "Next study plan",
            ],
        },
        features: [
            {
                title: "Course Notes",
                subtitle: "Connect individual class records into a larger learning history",
                bullets: [
                    "Keep lecture notes, reading notes, questions, and reflections",
                    "Summarize a long note and ask questions about it",
                    "Use collaborative notes for a group assignment or study group",
                ],
            },
            {
                title: "Assignments and Time",
                subtitle: "Organize what to do, by when, and in what order",
                bullets: [
                    "Manage assignments, practice tasks, todos, deadlines, and schedules",
                    "Ask what remains incomplete and which deadline comes next",
                    "On plans with actions enabled, review and approve creation of study tasks or calendar events",
                ],
            },
            {
                title: "Study AI with Sources",
                subtitle: "Ask from your own records and return to the original note",
                bullets: [
                    "Ask across notes, tasks, todos, schedules, and discussions",
                    "Follow links from an answer to the original record",
                    "Organize what you understood, what was confusing, and what to review next",
                ],
            },
        ],
        ai: {
            title: "Ask what you learned this week and what to review next.",
            body: "Genos AI reads the notes, assignments, todos, schedules, and discussions stored in your workspace and answers with source links. Use it to reflect on your own record and decide the next study action—not to replace the work required by a course.",
            prompts: [
                "What did I learn this week?",
                "Which concepts do I keep struggling with?",
                "What assignments must I finish before the next deadline?",
                "Summarize this note and list the points I should review.",
                "Propose a study plan for this week from my notes and deadlines.",
            ],
        },
        now: [
            "Manage notes, tasks, todos, and schedules in the same workspace",
            "Ask across notes, assignments, schedules, and discussions",
            "Open the original record behind an AI answer",
            "Summarize long notes and threads",
            "Receive answers in the active interface language",
            "Use a free plan and a no-login demo",
        ],
        coming: [
            "Attach a PDF or image directly to an AI question",
            "Routines: save an instruction and run it on a schedule",
            "Reply drafts in chat (you always press send)",
        ],
        audience: {
            title: "For students who take notes but still cannot see how the semester fits together.",
            items: [
                "University students whose course notes and assignment tracking are separate",
                "Graduate students organizing a research theme and daily work",
                "Students who reread every note from the beginning before an exam",
                "Seminars, study groups, and group assignments sharing records and responsibilities",
                "Learners who want to reflect on their own history, not only receive a general AI answer",
            ],
            quote: "What did I actually understand this week?",
        },
        faq: {
            title: "Frequently asked questions",
            items: [
                {
                    q: "Is Genos free for students?",
                    a: "A free plan is available with no credit card required. AI usage and the ability for the agent to write tasks or calendar events vary by plan.",
                },
                {
                    q: "Can I give it a lecture PDF or slide deck directly?",
                    a: "Not yet through the AI question flow. Direct PDF or image attachment and search across all course materials are roadmap items.",
                },
                {
                    q: "Can it remind me about an assignment later?",
                    a: "Yes. Ask Genos to remind you, for example “remind me Friday to submit the report”. It proposes a to-do with a reminder, and nothing is saved until you approve it.",
                },
                {
                    q: "Can a study group or group assignment use it?",
                    a: "Yes. Chat, collaborative notes, and tasks can live in the same workspace, making Genos suitable for seminars, study groups, and group assignments.",
                },
                {
                    q: "Is Genos meant to do my assignments for me?",
                    a: "Its main purpose is to connect your notes, assignments, schedules, and reflection so you can understand your own learning history. Follow course rules and verify AI answers against the original material and your own reasoning.",
                },
            ],
        },
        cta: {
            title: "Connect one course in Genos for four weeks.",
            body: "Keep the course notes, assignments, todos, schedule, and weekly reflection in one workspace. See whether you spend less time searching before an exam and can decide what to study next more clearly.",
            primary: "Try Genos free",
            secondary: "See the study workflow",
        },
    },
};
