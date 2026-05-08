import React from "react";
import { Search, Sparkles } from "lucide-react";

type Lang = "ja" | "en";

export default function GenosAIHubImageSection({ lang = "ja" }: { lang?: Lang }) {
    const t =
        lang === "ja"
            ? {
                  eyebrow: "How Genos works",
                  title: "AIが、会話・タスク・ノートを横断して答えを返す。",
                  body: "Genosでは、Chat、Task、Noteが別々の箱として分断されるのではなく、AIが参照できるチームの情報としてつながります。ユーザーはAIに質問するだけで、関連する会話、進行中のタスク、残されたドキュメントをまとめて確認できます。",
                  chips: ["横断検索", "Q&A", "要約", "次アクション"],
                  caption:
                      "AIを後付けのチャットボットとして置くのではなく、チームに蓄積された会話・タスク・ノートを扱える中心レイヤーとして設計しています。",
                  imageAlt: "GenosのAI AgentがUser、Chat、Task、Noteとつながる概念図",
              }
            : {
                  eyebrow: "How Genos works",
                  title: "AI works across chats, tasks, and notes to bring answers back.",
                  body: "In Genos, Chat, Task, and Note are not separate silos. They become connected team data that AI can search, summarize, and reason over. Users can ask a question and get answers across related conversations, ongoing tasks, and documentation.",
                  chips: ["Cross-search", "Q&A", "Summary", "Next actions"],
                  caption:
                      "The key idea is not to add AI as a separate chatbot, but to place it as the central layer that works with the team’s accumulated chats, tasks, and notes.",
                  imageAlt:
                      "A conceptual diagram showing Genos AI Agent connected with User, Chat, Task, and Note",
              };

    return (
        <section id="ai-context-map" className="px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
                    <div>
                        <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                            {t.eyebrow}
                        </p>

                        <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-[46px]">
                            {t.title}
                        </h2>

                        <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                            {t.body}
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                            {t.chips.map((chip) => (
                                <span
                                    key={chip}
                                    className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-black text-violet-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-violet-100"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    {chip}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="relative mx-auto w-full max-w-3xl">
                        <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-violet-500/20 via-fuchsia-400/15 to-indigo-400/20 blur-3xl" />

                        <div className="relative overflow-hidden rounded-[2.5rem] border border-violet-100 bg-white/90 p-4 shadow-2xl shadow-violet-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85 sm:p-6">
                            <img
                                src="/lp-ai-hub.png"
                                alt={t.imageAlt}
                                loading="lazy"
                                className="h-auto w-full rounded-[2rem] object-contain"
                            />

                            <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 dark:border-white/10 dark:bg-white/5">
                                <div className="flex items-start gap-3">
                                    <Search className="mt-1 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                                    <p className="text-sm font-semibold leading-7 text-slate-700 dark:text-slate-200">
                                        {t.caption}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
