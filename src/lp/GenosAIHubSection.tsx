import React from "react";
import { Search, Sparkles } from "lucide-react";

type Lang = "ja" | "en";

export default function GenosAIHubImageSection({ lang = "ja" }: { lang?: Lang }) {
    const t =
        lang === "ja"
            ? {
                  eyebrow: "How Genos works",
                  title: "AI Agentが、チームの仕事のつながりを理解する。",
                  body: "Genosでは、Chat、Task、NoteがAI Agentから見える同じcontext layerに保存されます。ユーザーはAIに質問するだけで、関連する議論、進行中のタスク、残された仕様やメモを横断して確認できます。",
                  chips: ["Context search", "Q&A", "要約", "次アクション"],
                  caption:
                      "Genosのコアは、AIを後付けのChatbotとして置くことではありません。チームの会話・タスク・ドキュメントを、AIが理解できるプロジェクト記憶として蓄積することです。",
                  imageAlt: "GenosのAI AgentがUser、Chat、Task、Noteとつながる概念図",
              }
            : {
                  eyebrow: "How Genos works",
                  title: "AI agents understand the connections across your team’s work.",
                  body: "In Genos, Chat, Task, and Note live in the same context layer that AI agents can access. Users can ask a question and get answers across related discussions, active tasks, specs, notes, and decisions.",
                  chips: ["Context search", "Q&A", "Summary", "Next actions"],
                  caption:
                      "The core idea is not to add AI as a chatbot on top. Genos stores your team’s conversations, tasks, and docs as connected project memory that AI can understand.",
                  imageAlt:
                      "A conceptual diagram showing Genos AI Agent connected with User, Chat, Task, and Note",
              };

    return (
        <section className="px-4 py-16 sm:px-6 lg:px-8" id="ai-context-map">
            <div className="mx-auto max-w-7xl">
                <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
                    <div>
                        <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                            {t.eyebrow}
                        </p>

                        <h2
                            className={`mt-4 ${lang === "en" ? "text-[30px]" : "text-[27px]"} font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-[46px]`}
                        >
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
                                alt={t.imageAlt}
                                className="h-auto w-full rounded-[2rem] object-contain"
                                loading="lazy"
                                src="/lp-ai-hub.png"
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
