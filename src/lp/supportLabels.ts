import type { Lang } from "./lpLang";

/**
 * The constants behind SupportPage, kept out of the component file so it exports
 * only a component (react-refresh), as privacyProcessors.ts does for /privacy.
 */

export const SUPPORT_EMAIL = "genos.support@genosai.dev";

/** Labels of the Connected apps screen, exactly as the app shows them. */
export const SUPPORT_UI_LABELS: Record<Lang, Record<string, string>> = {
    en: {
        settings: "Settings",
        developer: "Developer",
        connectedApps: "Connected apps",
        change: "Change",
        revoke: "Revoke",
        scopeRead: "Read",
        scopeWrite: "Read & write",
        canDelete: "Can delete",
    },
    ja: {
        settings: "設定",
        developer: "Developer",
        connectedApps: "接続済みアプリ",
        change: "変更",
        revoke: "取り消す",
        scopeRead: "Read",
        scopeWrite: "Read & write",
        canDelete: "削除可",
    },
};
