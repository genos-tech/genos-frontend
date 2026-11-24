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

export type GuideTab = GuideItem & {
    /** Dotted path into the i18n strings of the label the tab shows. */
    labelPath: "security.tab" | `settings.tabs.${Exclude<SettingsTabKey, "security">}`;
    /** Rows inside the tab (rendered with `SettingRow`). The full id is `<tab>.<item>`. */
    items: Record<string, GuideItem>;
};

const SELF = { who: "self", plan: "all", serverSwitch: null } as const;

export const SETTINGS_MAP = {
    general: {
        ...SELF,
        labelPath: "settings.tabs.general",
        default: "Appearance, Language, Sidebar, Privacy & analytics",
        items: {
            theme: { ...SELF, default: "System" },
            colorTheme: { ...SELF, default: "Purple" },
            density: { ...SELF, default: "Default" },
            language: { ...SELF, default: "Browser language" },
            sidebar: { ...SELF, default: "Inbox, Chats, Tasks, Notes and To-Do all shown" },
            shareUsage: { ...SELF, default: "Off until accepted" },
        },
    },
    planUsage: {
        ...SELF,
        labelPath: "settings.tabs.planUsage",
        default: "Plan, usage, upgrade, billing, team plan, credit packs",
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
            provider: { ...SELF, plan: "perCap", default: "Gemini Flash" },
            effort: { ...SELF, plan: "perCap", default: "Low" },
            model: { ...SELF, plan: "perCap", default: "Gemini Flash" },
            aiAnswers: { ...SELF, default: "On (this device)" },
            webSearch: { ...SELF, plan: "perCap", default: "Off" },
            contentLength: { ...SELF, default: "Standard" },
            sharedAnswers: { ...SELF, default: "On" },
            noteActivity: { ...SELF, default: "On" },
        },
    },
    chat: {
        ...SELF,
        labelPath: "settings.tabs.chat",
        default: "Message layout, Quick reactions, Message actions, Double-click",
        items: {
            messageLayout: { ...SELF, default: "Compact" },
            quickReactions: { ...SELF, default: "Thumbs up, eyes, check mark" },
            doubleClickTodo: { ...SELF, default: "On" },
        },
    },
    tasks: {
        ...SELF,
        labelPath: "settings.tabs.tasks",
        default: "Quick task creation, Auto-close on PR merge, Google Calendar sync",
        items: {
            quickAddRequiredFields: { ...SELF, default: "Off" },
            autoCloseOnPrMerge: { ...SELF, plan: "pro+", default: "Off", serverSwitch: null },
            autoSyncCalendar: { ...SELF, plan: "core+", default: "Off" },
        },
    },
    notifications: {
        ...SELF,
        labelPath: "settings.tabs.notifications",
        default: "Master, Pause, browser permission, groups, email, mutes",
        items: {
            master: { ...SELF, default: "On" },
            quietHours: { ...SELF, default: "Not paused" },
            group: { ...SELF, default: "On" },
            category: { ...SELF, default: "On" },
            email: { ...SELF, default: "On", serverSwitch: "EMAIL_NOTIFICATIONS_ENABLED" },
            emailCategory: { ...SELF, default: "On" },
            mutedChat: { ...SELF, default: "Unmute" },
            mutedItem: { ...SELF, default: "Unmute" },
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
        plan: "pro+",
        labelPath: "settings.tabs.integrations",
        default:
            "Google, GitHub, repository access (hidden when integrations are off in the build)",
        serverSwitch: "GITHUB_APP_ENABLED",
        items: {},
    },
    developer: {
        ...SELF,
        plan: "core+",
        labelPath: "settings.tabs.developer",
        default:
            "Connect your AI, Connected apps, API keys, team keys, webhooks; contents are role-gated",
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
