/**
 * The product screenshots the marketing pages use, with their 1x size in CSS
 * pixels. Each exists for both languages under `public/lp/shots/<lang>/`, at 1x
 * (`<name>.webp`) and 2x (`<name>@2x.webp`).
 *
 * Written by hand, checked by `scripts/lp-screenshots.mjs` (it refuses to write
 * a file whose size disagrees) and by `LandingPage.test.tsx` (every name here
 * has both files in both languages). Retake the set whenever the app's UI
 * changes: `node scripts/lp-screenshots.mjs` against a local stack.
 */
const DESKTOP = { width: 1440, height: 900 } as const;
const PHONE = { width: 390, height: 844 } as const;

export const SHOTS = {
    /** Ask Genos: an answer with its sources. */
    ask: DESKTOP,
    /** A channel with a thread open. */
    chat: DESKTOP,
    /** The task table of a project: sprint, milestone, parents expanded. */
    tasks: DESKTOP,
    /** One task open: body, comments, linked thread and notes. */
    task: DESKTOP,
    /** A team note: spec with headings, checklist and table. */
    note: DESKTOP,
    /** An approval card for a write Genos proposes. */
    approval: DESKTOP,
    /** The Inbox with a Genos report. */
    inbox: DESKTOP,
    /** The sprint board. */
    board: DESKTOP,
    /** Today's to-dos. */
    todo: DESKTOP,
    /** The task table in dark mode. */
    "tasks-dark": DESKTOP,
    /** Phone: a chat. */
    "phone-chat": PHONE,
    /** Phone: tasks. */
    "phone-tasks": PHONE,
} as const;

export type ShotName = keyof typeof SHOTS;

export const SHOT_NAMES = Object.keys(SHOTS) as ShotName[];
