import type { Lang } from "../lpLang";

/**
 * Copy for `/accessibility` (MIP-1265), ja + en.
 *
 * Every sentence states something the repo tests or the code does, and says
 * what is NOT done yet. The evidence for each claim is listed in the PR body
 * (claim -> evidence). Lines marked `TODO(copy): MIP-1265` need Ken's reading
 * (and counsel's, if he asks for it) before this page goes live.
 */

export interface AccessibilityItem {
    heading: string;
    body: string[];
}

export interface AccessibilityCopy {
    title: string;
    lead: string;
    lastReviewed: string;
    sections: {
        covered: AccessibilityItem;
        gaps: AccessibilityItem;
        browsers: AccessibilityItem;
        report: AccessibilityItem;
    };
    contactEmailLabel: string;
    contactCopyLabel: string;
    moreHeading: string;
    privacy: string;
    support: string;
}

export const ACCESSIBILITY_COPY: Record<Lang, AccessibilityCopy> = {
    en: {
        title: "Accessibility",
        // TODO(copy): MIP-1265 — Ken reads this whole statement before it goes live.
        lead: "This page says what Genos does for accessibility today, what we have not done yet, and which browsers and devices we support. It is written from what the code tests, not from what we intend.",
        lastReviewed: "Last checked against the code: 2026-11-21.",
        sections: {
            covered: {
                heading: "What is in place",
                body: [
                    "Colour contrast in the app. Our design tokens are tested automatically against WCAG 2.2 AA for primary and secondary text (4.5:1), for tertiary text and focus rings (3:1), in every colour theme, in light and dark mode.",
                    "Keyboard focus. Buttons show a visible focus ring when you move through them with the keyboard. The ring does not appear when you click with a mouse.",
                    "Keyboard use of menus. Several menus and dialogs in the app are covered by tests that use the keyboard (for example, moving through a team menu and the keyboard shortcut list). This is not yet true of every menu.",
                    "Page structure on the public pages. Each page has a header, a navigation region, a main region and a footer, and a link at the top of the page skips straight to the content.",
                    "Pinch zoom. We do not disable zoom on phones.",
                    "Phone layout. Layouts are checked at a 390 px width and at a 1440 px desktop width.",
                    "Reduced motion. Some animations in the app stop when your device asks for reduced motion.",
                ],
            },
            gaps: {
                heading: "What is not done yet",
                body: [
                    "We have not tested the app with a screen reader (VoiceOver, NVDA or TalkBack). Labels are checked by tests, not by a screen reader user.",
                    "No automated accessibility scan (such as axe) runs on the app or on the public pages.",
                    "The automated colour test covers the app's colours. It does not yet cover the colours of the public pages.",
                    "Keyboard tests check that a key handler exists, not every path through every screen. Parts of the task graph and the drag-and-drop boards have not been checked with a keyboard.",
                    "Reduced motion is not applied everywhere. On the public pages only some animations respect it.",
                    "The skip link is on the public pages only, not in the app.",
                    "We have not measured the app at 200% text size or with a large system font.",
                    "We have not written a formal conformance report.",
                ],
            },
            browsers: {
                heading: "Browsers and devices",
                body: [
                    "Desktop: the latest stable version of Google Chrome, Microsoft Edge, Mozilla Firefox and Safari.",
                    "Phone and tablet: the latest version of the phone's own browser, such as Safari on iPhone and Chrome on Android. You can add Genos to your phone's home screen. Genos has no native phone app; the website is the app.",
                    "Our automated browser tests run in Chromium only. Other browsers are supported on their latest version, but we have not run the automated tests in them.",
                    "Genos needs JavaScript to run.",
                    "Older browser versions and older phones are not tested.",
                ],
            },
            report: {
                heading: "Report a problem",
                body: [
                    "If something in Genos is hard for you to use, tell us by email. Say which page or screen, which browser or device, what you tried to do, and what happened. A screenshot helps. Please do not send passwords or API keys.",
                    "We read these emails. We do not promise a reply time on this page.",
                ],
            },
        },
        contactEmailLabel: "Email us at",
        contactCopyLabel: "If the link does not open your mail app, copy the address:",
        moreHeading: "Other pages",
        privacy: "Privacy Policy",
        support: "Support",
    },
    ja: {
        title: "アクセシビリティ",
        // TODO(copy): MIP-1265 — Ken reads this whole statement before it goes live.
        lead: "このページでは、Genos が現在行っているアクセシビリティの取り組み、まだできていないこと、対応しているブラウザーと端末をご案内します。記述は、目標ではなく、コードでテストしている内容にもとづいています。",
        lastReviewed: "コードとの照合日：2026-11-21。",
        sections: {
            covered: {
                heading: "現在の取り組み",
                body: [
                    "アプリの色のコントラスト。デザインのトークンは、WCAG 2.2 AA に対して自動テストで確認しています。主要な文字と補助的な文字は 4.5:1、第三の文字とフォーカスリングは 3:1 です。すべてのカラーテーマでライトとダークの両方を確認しています。",
                    "キーボードのフォーカス。キーボードで移動すると、ボタンに見えるフォーカスリングが出ます。マウスでクリックしたときには出ません。",
                    "メニューのキーボード操作。アプリの一部のメニューとダイアログは、キーボードを使うテストで確認しています（例：チームのメニューとキーボードショートカットの一覧での移動）。まだすべてのメニューが対象ではありません。",
                    "公開ページの構造。各ページにはヘッダー、ナビゲーション、メインの領域、フッターがあります。ページ上部のリンクで、本文へ直接移動できます。",
                    "ピンチズーム。スマートフォンでも、ズームを無効にしていません。",
                    "スマートフォンでの表示。幅 390 px と、デスクトップ幅 1440 px で表示を確認しています。",
                    "視覚効果の軽減。端末で視覚効果の軽減が指定されている場合、アプリの一部のアニメーションは止まります。",
                ],
            },
            gaps: {
                heading: "まだできていないこと",
                body: [
                    "スクリーンリーダー（VoiceOver、NVDA、TalkBack）での確認は、まだ行っていません。ラベルはテストで確認していますが、スクリーンリーダー利用者による確認ではありません。",
                    "アプリにも公開ページにも、axe などの自動アクセシビリティ検査は行っていません。",
                    "自動の色のテストは、アプリの色を対象にしています。公開ページの色はまだ対象ではありません。",
                    "キーボードのテストは、キーの処理があるかを確認するもので、すべての画面のすべての操作経路を確認するものではありません。タスクのグラフや、ドラッグで並べ替える画面の一部は、キーボードでの確認がまだです。",
                    "視覚効果の軽減は、すべての場所には適用されていません。公開ページでは、一部のアニメーションだけが対応しています。",
                    "スキップリンクは公開ページにだけあり、アプリにはありません。",
                    "文字サイズ 200%、または大きなシステムフォントでの確認は、まだ行っていません。",
                    "正式な適合性レポートはまだ作成していません。",
                ],
            },
            browsers: {
                heading: "対応するブラウザーと端末",
                body: [
                    "パソコン：Google Chrome、Microsoft Edge、Mozilla Firefox、Safari の最新の安定版。",
                    "スマートフォンとタブレット：端末標準のブラウザーの最新版（iPhone の Safari、Android の Chrome など）。Genos はホーム画面に追加して使えます。Genos にネイティブのスマートフォンアプリはありません。ウェブサイトがアプリです。",
                    "自動のブラウザーテストは Chromium だけで実行しています。その他のブラウザーも最新版なら対象ですが、自動テストはそれらでは実行していません。",
                    "Genos の動作には JavaScript が必要です。",
                    "古いブラウザーのバージョンや古い端末は、テストの対象外です。",
                ],
            },
            report: {
                heading: "問題を報告する",
                body: [
                    "Genos で使いにくいところがあれば、メールでお知らせください。どのページや画面か、どのブラウザーや端末か、何をしようとして、何が起きたかを書いてください。スクリーンショットがあると助かります。パスワードや API キーは送らないでください。",
                    "いただいたメールは読んでいます。このページでは、返信までの時間はお約束しません。",
                ],
            },
        },
        contactEmailLabel: "メールアドレス：",
        contactCopyLabel:
            "リンクからメールアプリが開かない場合は、こちらのアドレスをコピーしてください：",
        moreHeading: "関連ページ",
        privacy: "プライバシーポリシー",
        support: "サポート",
    },
};
