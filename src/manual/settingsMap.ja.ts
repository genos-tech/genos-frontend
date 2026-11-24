/**
 * Japanese text for the settings map (MIP-2322). The map itself (`settingsMap.ts`) carries the
 * English row names and defaults; the Japanese manual's generated "Settings A-Z" topic reads
 * these instead. Tab labels are not here: they come from the app's own Japanese strings
 * (`labelPath`), so a rename in the app cannot leave the manual behind. Row names reuse the app's
 * Japanese label wherever the app has one.
 *
 * `ALL_GUIDE_IDS` is the key list: `manualSourceMIP2321.test.ts` fails when an id has no entry
 * here or an entry has no id.
 */
import type { GuideItem, SettingGuideId } from "./settingsMap";

export type JaSettingText = {
    /** Rows only: the row's name. */
    name?: string;
    /** What a person sees before touching it. */
    default: string;
};

export const JA_SETTINGS_TEXT: Record<SettingGuideId, JaSettingText> = {
    general: { default: "外観、言語、サイドバー、プライバシーと分析" },
    "general.theme": { name: "テーマ(ライト、ダーク、システム)", default: "システム" },
    "general.colorTheme": { name: "カラーテーマ", default: "パープル" },
    "general.density": { name: "行の密度", default: "標準" },
    "general.language": { name: "言語", default: "ブラウザーの言語" },
    "general.sidebar": {
        name: "サイドバー",
        default: "受信箱、チャット、タスク、ノート、To-Do がすべて表示",
    },
    "general.shareUsage": { name: "利用データを共有する", default: "同意するまでオフ" },
    planUsage: {
        default: "プラン、使用状況、アップグレード、請求、チームプラン、クレジットパック",
    },
    aiCreditUsage: { default: "クレジットのメーター、ジョブ別、最近の請求(閲覧のみ)" },
    spotlight: {
        default:
            "AIモデル、Genosの回答、Genosの書く量、スケジュール、Genos が覚えていること、スキル",
    },
    "spotlight.provider": { name: "AIモデル: プロバイダー", default: "Gemini Flash" },
    "spotlight.effort": { name: "Effort", default: "Low" },
    "spotlight.model": { name: "AIモデル: モデル", default: "Gemini Flash" },
    "spotlight.aiAnswers": { name: "Genosの回答(質問ボタン)", default: "オン(この端末)" },
    "spotlight.webSearch": { name: "ウェブ検索", default: "オフ" },
    "spotlight.contentLength": { name: "Genosの書く量", default: "標準" },
    "spotlight.sharedAnswers": { name: "自分の回答でチームメイトを助ける", default: "オン" },
    "spotlight.noteActivity": { name: "自分の作業を記録する", default: "オン" },
    chat: {
        default:
            "メッセージレイアウト、クイックリアクション、メッセージのアクション、ダブルクリック",
    },
    "chat.messageLayout": { name: "メッセージレイアウト", default: "コンパクト" },
    "chat.quickReactions": { name: "クイックリアクション", default: "いいね、目、チェックマーク" },
    "chat.doubleClickTodo": { name: "ダブルクリックでメッセージをTo-Doに追加", default: "オン" },
    tasks: { default: "クイックタスク作成、PR マージ時の自動クローズ、Google カレンダーの同期" },
    "tasks.quickAddRequiredFields": { name: "クイックタスク作成: 必須項目", default: "オフ" },
    "tasks.autoCloseOnPrMerge": { name: "PRがマージされたら担当タスクをClose", default: "オフ" },
    "tasks.autoSyncCalendar": { name: "タスクの締切を自動同期する", default: "オフ" },
    notifications: {
        default: "マスタースイッチ、一時停止、ブラウザーの許可、グループ、メール、ミュート",
    },
    "notifications.master": { name: "ウェブ通知(マスタースイッチ)", default: "オン" },
    "notifications.quietHours": { name: "通知の一時停止とおやすみ時間", default: "一時停止なし" },
    "notifications.group": { name: "通知のグループ", default: "オン" },
    "notifications.category": { name: "通知のカテゴリー", default: "オン" },
    "notifications.email": { name: "メール通知", default: "オン" },
    "notifications.emailCategory": {
        name: "メールのカテゴリー",
        default:
            "メンション、担当の割り当て、スレッドへの返信、タスクのコメント、受信箱はオン。チャット、リアクション、バックグラウンドで完了した回答はオフ",
    },
    "notifications.mutedChat": {
        name: "ミュート中のチャット",
        default: "ミュートしているものはなし",
    },
    "notifications.mutedItem": {
        name: "ミュートされたアイテム",
        default: "ミュートしているものはなし",
    },
    mentionGroups: { default: "チームの @グループ(名前、説明、メンバー)" },
    customEmoji: {
        default: "チームの絵文字(誰でも追加でき、削除できるのはアップロードした本人)",
    },
    shortcuts: { default: "閲覧のみの一覧" },
    security: { default: "2段階認証(オフ)" },
    account: { default: "エクスポート、セキュリティのアクティビティ、所属チーム、削除" },
    integrations: {
        default: "Google、GitHub、リポジトリへのアクセス(ビルドで連携がオフのときは非表示)",
    },
    developer: {
        default:
            "AI を接続、接続済みアプリ、API キー、チームキー、Webhook。接続済みアプリと Webhook は Core 以上で、内容は役割によって制限されます",
    },
};

export const JA_WHO: Record<GuideItem["who"], string> = {
    self: "あなた",
    teamOwner: "チームのオーナー",
    manager: "オーナーまたはエディター",
    owner: "オーナー",
    anyMember: "すべてのメンバー",
    ownSchedules: "あなた(自分のスケジュールのみ)",
    readOnly: "閲覧のみ",
    browser: "お使いのブラウザー",
};

export const JA_PLAN: Record<GuideItem["plan"], string> = {
    all: "すべてのプラン",
    "core+": "Core 以上",
    "pro+": "Pro 以上",
    perCap: "すべてのプラン。上限はプランによって異なります",
    whenCreditsOn: "AI クレジットが有効な場合",
};
