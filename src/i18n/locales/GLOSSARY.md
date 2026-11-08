# Locale glossary

One agreed term per concept per locale (MIP-1181). When you translate a new key, use the term in
this table, not a synonym: a screen that says "milestone" three ways reads as three features.

The terms were chosen as follows: the one the app already uses most (a count over the locale
file), unless that one is wrong in the language. Where a column differs from the plain count the
reason is in the notes below the table.

| Concept              | en        | ja             | zh       | es           | fr            | hi         | ar                                     |
| -------------------- | --------- | -------------- | -------- | ------------ | ------------- | ---------- | -------------------------------------- |
| Task                 | Task      | タスク         | 任务     | Tarea        | Tâche         | टास्क      | مهمة                                   |
| Project              | Project   | プロジェクト   | 项目     | Proyecto     | Projet        | प्रोजेक्ट  | مشروع                                  |
| Sprint               | Sprint    | スプリント     | 冲刺     | Sprint       | Sprint        | स्प्रिंट   | سبرنت                                  |
| Milestone            | Milestone | マイルストーン | 里程碑   | Hito         | Jalon         | माइलस्टोन  | معلم (pl. معالم)                       |
| Backlog (no sprint)  | Backlog   | バックログ     | 待办清单 | Backlog      | Backlog       | बैकलॉग     | الأعمال المتراكمة                      |
| Status               | Status    | ステータス     | 状态     | Estado       | Statut        | स्थिति     | الحالة                                 |
| Priority             | Priority  | 優先度         | 优先级   | Prioridad    | Priorité      | प्राथमिकता | الأولوية                               |
| Effort (task)        | Effort    | Effort         | 工作量   | Esfuerzo     | Effort        | प्रयास     | الجهد                                  |
| Inbox                | Inbox     | 受信箱         | 收件箱   | Bandeja      | Réception     | इनबॉक्स    | الوارد                                 |
| Schedule (recurring) | Schedule  | スケジュール   | 定时任务 | Programación | Planification | शेड्यूल    | الجدول الزمني                          |
| To-Do (feature)      | To-Do     | To-Do          | 待办事项 | Por hacer    | À faire       | टू-डू      | مهام اليوم (rail), قائمة المهام (pane) |
| Note                 | Note      | ノート         | 笔记     | Nota         | Note          | नोट        | ملاحظة                                 |
| Thread               | Thread    | スレッド       | 话题     | Hilo         | Fil           | थ्रेड      | موضوع                                  |
| Tag                  | Tag       | タグ           | 标签     | Etiqueta     | Balise        | टैग        | علامة                                  |
| Project label        | Label     | ラベル         | 标签     | Etiqueta     | Libellé       | लेबल       | تسمية                                  |
| Comment              | Comment   | コメント       | 评论     | Comentario   | Commentaire   | टिप्पणी    | تعليق                                  |
| Revoke (key, app)    | Revoke    | 取り消す       | 撤销     | Revocar      | Révoquer      | रद्द करें  | إبطال                                  |
| API key              | API key   | API キー       | API 密钥 | Clave de API | Clé API       | API कुंजी  | مفتاح API                              |

Brand and code tokens stay in English in every locale: Genos, GitHub, Google, MCP, OAuth, API,
webhook ids, tool ids (`create_task`), shortcuts.

## Notes

- **Arabic milestone is `معلم`.** `معلم`/`المعالم` was already the most used form (the sidebar's section is `المعالم`); the old
  catalog also had `منعطف`, `مرحلة`, `الحدث الرئيسي` and `المراحل الرئيسية` for the same thing. Do not add a
  fifth. Arabic sprint is `سبرنت` (not `سباق`, `عدو` or `سبرينت`).
- **The rail uses a short To-Do label; the pane keeps the full term.** `GlobalRail.test.tsx` caps a
  rail label at 53px (the 68px rail minus padding), so a label here must pass `labelWidth()` in that test,
  and no two rail buttons may share a word. Arabic: rail `مهام اليوم` (it was `المهام`, the same word as
  Tasks; the first replacement tried, `قائمة المهام`, is the pane title and is too wide for the rail).
  Spanish: `Por hacer` (the pane's own title; `Pendientes` was too wide). The label is the same in
  the rail, the service switcher and Settings > Sidebar (`serviceSwitcherTodoLocales.test.ts`).
- **Chinese sprint is `冲刺`** (the Scrum term; `短跑` is a footrace and the file's earlier
  `迭代` was a software "iteration"). `状态` is status (`地位` is social standing). Effort is
  `工作量`, never `努力`/`努力程度`. Backlog is `待办清单` and To-Do is `待办`/`待办事项`:
  they sit close in Chinese, so keep the `清单` on the backlog.
- **Hindi sprint is `स्प्रिंट`**, milestone `माइलस्टोन` (not `मील का पत्थर`), status `स्थिति`
  (not `स्टेटस`), effort `प्रयास` (not `मेहनत`). `टिप्पणी` is a comment (older strings still say `कमेंट`: either reads fine, prefer `टिप्पणी`);
  a **note** is `नोट` (never `टिप्पणी`).
- **Japanese note is `ノート`** (the sidebar's word); `メモ` is kept only for "meeting notes"
  and for the task's own notes field. Inbox is `受信箱` (not `受信トレイ`). Effort stays
  `Effortレベル`, as the table column and the form already show it.
- **Spanish To-Do is `Por hacer`** (an item is a `pendiente`). Sprint is never `carrera`.
  A recurring schedule is a `programación`; `horario` is only for hours of the day (quiet
  hours).
- **French milestone is `jalon`** (never `étape`, which is a step). A recurring schedule is a
  `planification`; `horaire` is only for hours of the day. Tags are `balise` (labels on a
  project are `libellé`).
- **Quiet hours and the schedule are different things.** "Pause notifications on a schedule"
  uses the word for a time window (`horario`, `horaire`, `定时`), not the recurring-job noun.
- Placeholders (`{name}`, `{count, plural, ...}`) are never translated. The coverage test
  (`src/__tests__/localeCatalogCoverage.test.ts`) fails on a missing key, a changed argument,
  or an Arabic string that is just English; `localeGlossary.test.ts` pins the terms above that
  have already regressed once.
