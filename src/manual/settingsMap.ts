/**
 * The settings map (MIP-2320): one entry per Settings tab, and per row inside it, saying where
 * the setting lives, who can change it, on which plan, what it defaults to and which server
 * switch gates it. The user manual, the help tool and the guide notes read this; they never
 * keep their own copy of "where do I change X".
 *
 * It is the source of truth for guide ids:
 *  - `SettingsTabKey` is the one list of tabs; `SETTINGS_MAP` is `Record<SettingsTabKey, …>`, so
 *    `tsc -b` fails when a tab has no entry.
 *  - `SettingRow` takes a `SettingGuideId`, so a row whose id is not in this map is a type error.
 *  - `src/__tests__/settingsGuideMapMIP2320.test.tsx` renders every tab and fails on a rendered
 *    `data-guide-id` with no entry here, and on an entry that nothing renders.
 *
 * Labels are NOT stored here: `labelPath` points at the i18n string the tab already shows, so a
 * rename in the app cannot leave the manual behind. Source: audit note on MIP-2305, Appendix A.
 */

export type SettingsTabKey =
    | "general"
    | "planUsage"
    | "aiCreditUsage"
    | "spotlight"
    | "chat"
    | "tasks"
    | "notifications"
    | "mentionGroups"
    | "customEmoji"
    | "shortcuts"
    | "security"
    | "account"
    | "integrations"
    | "developer";

type Who =
    | "self"
    | "teamOwner"
    | "manager"
    | "owner"
    | "anyMember"
    | "ownSchedules"
    | "readOnly"
    | "browser";

type Plan = "all" | "core+" | "pro+" | "perCap" | "whenCreditsOn";

export type GuideItem = {
    /** Who can change it. "manager" means owner or editor. */
    who: Who;
    plan: Plan;
    /** What a person sees before touching it, in words. */
    default: string;
    /** A server switch that gates it (a name in capitals), or null. */
    serverSwitch: string | null;
};

/** A row inside a tab. `name` is the manual's name for it (the app's own text is per-component). */
export type GuideRow = GuideItem & { name: string };

export type GuideTab = GuideItem & {
    /** Dotted path into the i18n strings of the label the tab shows. */
    labelPath: "security.tab" | `settings.tabs.${Exclude<SettingsTabKey, "security">}`;
    /** Rows inside the tab (rendered with `SettingRow`). The full id is `<tab>.<item>`. */
    items: Record<string, GuideRow>;
};

const SELF = { who: "self", plan: "all", serverSwitch: null } as const;

export const SETTINGS_MAP = {
    general: {
        ...SELF,
        labelPath: "settings.tabs.general",
        default: "Appearance, Language, Sidebar, Privacy & analytics",
        items: {
            theme: { name: "Theme (Light, Dark, System)", ...SELF, default: "System" },
            colorTheme: { name: "Color theme", ...SELF, default: "Purple" },
            density: { name: "Density", ...SELF, default: "Default" },
            language: { name: "Language", ...SELF, default: "Browser language" },
            sidebar: {
                name: "Sidebar sections",
                ...SELF,
                default: "Inbox, Chats, Tasks, Notes and To-Do all shown",
            },
            shareUsage: { name: "Share usage data", ...SELF, default: "Off until accepted" },
        },
    },
    planUsage: {
        ...SELF,
        labelPath: "settings.tabs.planUsage",
        default:
            "Plan, usage, upgrade, billing, team plan, credit packs, plan comparison (incl. HTML page limits)",
        items: {},
    },
    aiCreditUsage: {
        ...SELF,
        plan: "whenCreditsOn",
        labelPath: "settings.tabs.aiCreditUsage",
        default: "Credits meter, by job, recent charges (read-only)",
        items: {},
    },
    spotlight: {
        ...SELF,
        labelPath: "settings.tabs.spotlight",
        default:
            "AI model, Genos answers, How much Genos writes, Schedules, What Genos remembers, Skills",
        items: {
            provider: {
                name: "AI model: Provider",
                ...SELF,
                plan: "perCap",
                default: "Gemini Flash",
            },
            effort: { name: "Effort", ...SELF, plan: "perCap", default: "Low" },
            model: { name: "AI model: Model", ...SELF, plan: "perCap", default: "Gemini Flash" },
            aiAnswers: {
                name: "Genos answers (Ask button)",
                ...SELF,
                default: "On (this device)",
            },
            webSearch: { name: "Web search", ...SELF, plan: "perCap", default: "Off" },
            contentLength: { name: "How much Genos writes", ...SELF, default: "Standard" },
            sharedAnswers: { name: "Let my answers help teammates", ...SELF, default: "Off" },
            noteActivity: { name: "Note my activity", ...SELF, default: "On" },
        },
    },
    chat: {
        ...SELF,
        labelPath: "settings.tabs.chat",
        default: "Message layout, Quick reactions, Message actions, Double-click",
        items: {
            messageLayout: { name: "Message layout", ...SELF, default: "Compact" },
            quickReactions: {
                name: "Quick reactions",
                ...SELF,
                default: "Thumbs up, eyes, check mark",
            },
            doubleClickTodo: { name: "Double-click adds to To-Do", ...SELF, default: "On" },
        },
    },
    tasks: {
        ...SELF,
        labelPath: "settings.tabs.tasks",
        default: "Quick task creation, Auto-close on PR merge, Google Calendar sync",
        items: {
            quickAddRequiredFields: {
                name: "Quick task creation: required fields",
                ...SELF,
                default: "Off",
            },
            autoCloseOnPrMerge: {
                name: "Close my tasks when their PR merges",
                ...SELF,
                default: "On",
            },
            autoSyncCalendar: {
                name: "Sync task due dates to Google Calendar",
                ...SELF,
                default: "Off",
            },
        },
    },
    notifications: {
        ...SELF,
        labelPath: "settings.tabs.notifications",
        default: "Master, Pause, browser permission, groups, email, mutes",
        items: {
            master: { name: "Web notifications (master switch)", ...SELF, default: "On" },
            quietHours: { name: "Pause and quiet hours", ...SELF, default: "Not paused" },
            group: { name: "Notification groups", ...SELF, default: "On" },
            category: { name: "Notification categories", ...SELF, default: "On" },
            email: {
                name: "Email notifications",
                ...SELF,
                default: "On",
                serverSwitch: "EMAIL_NOTIFICATIONS_ENABLED",
            },
            emailCategory: {
                name: "Email categories",
                ...SELF,
                default:
                    "On for mentions, assignments, thread replies, task comments and inbox; Off for chats, reactions and finished background answers",
            },
            mutedChat: { name: "Muted chats", ...SELF, default: "Nothing muted" },
            mutedItem: { name: "Muted items", ...SELF, default: "Nothing muted" },
        },
    },
    mentionGroups: {
        who: "anyMember",
        plan: "all",
        serverSwitch: null,
        labelPath: "settings.tabs.mentionGroups",
        default: "Team @groups (name, description, members)",
        items: {},
    },
    customEmoji: {
        who: "anyMember",
        plan: "all",
        serverSwitch: null,
        labelPath: "settings.tabs.customEmoji",
        default: "Team emoji (any member adds; the uploader deletes)",
        items: {},
    },
    shortcuts: {
        who: "readOnly",
        plan: "all",
        serverSwitch: null,
        labelPath: "settings.tabs.shortcuts",
        default: "Read-only list",
        items: {},
    },
    security: {
        ...SELF,
        labelPath: "security.tab",
        default: "Two-step verification (off)",
        items: {},
    },
    account: {
        ...SELF,
        labelPath: "settings.tabs.account",
        default: "Export, security activity, your teams, delete",
        items: {},
    },
    integrations: {
        ...SELF,
        labelPath: "settings.tabs.integrations",
        default:
            "Google, GitHub, repository access (hidden when integrations are off in the build)",
        serverSwitch: "GITHUB_APP_ENABLED",
        items: {},
    },
    developer: {
        ...SELF,
        labelPath: "settings.tabs.developer",
        default:
            "Connect your AI, Connected apps, API keys, team keys, webhooks. Connected apps and webhooks need Core and up; contents are role-gated",
        items: {},
    },
} as const satisfies Record<SettingsTabKey, GuideTab>;

type Map = typeof SETTINGS_MAP;

/** A tab id (`general`) or a row id (`general.theme`). */
export type SettingGuideId =
    | keyof Map
    | {
          [T in keyof Map]: `${T}.${Extract<keyof Map[T]["items"], string>}`;
      }[keyof Map];

/** Every id the map declares, tabs first. */
export const ALL_GUIDE_IDS: readonly string[] = (
    Object.keys(SETTINGS_MAP) as SettingsTabKey[]
).flatMap((tab) => [tab, ...Object.keys(SETTINGS_MAP[tab].items).map((item) => `${tab}.${item}`)]);
