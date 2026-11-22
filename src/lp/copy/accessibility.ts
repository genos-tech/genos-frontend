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
        // TODO(copy): MIP-1831 — the target sentence at the end of this lead is new.
        lead: "This page says what Genos does for accessibility today, what we have not done yet, and which browsers and devices we support. It is written from what the code tests, not from what we intend. Our accessibility target is WCAG 2.2 AA.",
        lastReviewed: "Last checked against the code: 2026-11-21.",
        sections: {
            covered: {
                heading: "What is in place",
                body: [
                    // TODO(copy): MIP-1831 — the public-page sentence and the scan item are new.
                    "Colour contrast in the app. Our design tokens are tested automatically against WCAG 2.2 AA for primary and secondary text (4.5:1), for tertiary text and focus rings (3:1), in every colour theme, in light and dark mode. On the public pages, text is tested at 4.5:1 on every background it sits on.",
                    "Automated scan. axe-core scans the public pages and the sign-in form each time the frontend code changes. The scan reports problems; it does not stop a change from going out.",
                    "Keyboard focus. Buttons show a visible focus ring when you move through them with the keyboard. The ring does not appear when you click with a mouse.",
                    "Keyboard use of menus. Several menus and dialogs in the app are covered by tests that use the keyboard (for example, moving through a team menu and the keyboard shortcut list). This is not yet true of every menu.",
                    "Page structure and skip link. Each public page has a header, a navigation region, a main region and a footer. A link at the top of each public page and in the app skips straight to the main content.",
                    "Narrow screens in the app. On the main screens (home, tasks, notes, inbox, chat and plans) no control is cut off down to a 320 px wide window. Narrower than that, the app scrolls sideways.",
                    "Pinch zoom. We do not disable zoom on phones.",
                    "Phone layout. Layouts are checked at a 390 px width and at a 1440 px desktop width.",
                    "Narrow screens on the public pages. They do not scroll sideways down to a 195 px window (a 390 px phone at 200% text size), checked in a browser. The language switch moves into the menu on narrow screens.",
                    "Reduced motion. Some animations in the app stop when your device asks for reduced motion.",
                ],
            },
            gaps: {
                heading: "What is not done yet",
                body: [
                    "We have not tested the app with a screen reader (VoiceOver, NVDA or TalkBack). Labels are checked by tests, not by a screen reader user.",
                    // TODO(copy): MIP-1831 — the axe, colour, keyboard and conformance lines are reworded.
                    "The axe scan covers the public pages and the sign-in form, not the rest of the app. It reports problems without blocking a change, so a problem can ship.",
                    "The automated colour test covers the colours of the app and the public pages. Tertiary text in the app is held to 3:1, not the 4.5:1 that WCAG asks for text. We have not changed that in the app.",
                    "Keyboard tests check specific screens and controls, not every path through every screen. Some screens have no keyboard test yet.",
                    "Reduced motion is not applied everywhere. On the public pages only some animations respect it.",
                    "We have not measured the app at 200% text size or with a large system font.",
                    "We have not finished a conformance check against WCAG 2.2 AA. The screen reader pass is not done, and the narrow-screen checks cover some screens and the public header only. We will not claim conformance until these are done.",
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
                    // TODO(copy): MIP-1831 — the report-on-request sentence is new.
                    "We can send you our accessibility conformance report on request, by email.",
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
        // TODO(copy): MIP-1831 — the target sentence at the end of this lead is new.
        lead: "このページでは、Genos が現在行っているアクセシビリティの取り組み、まだできていないこと、対応しているブラウザーと端末をご案内します。記述は、目標ではなく、コードでテストしている内容にもとづいています。アクセシビリティの目標は WCAG 2.2 AA です。",
        lastReviewed: "コードとの照合日：2026-11-21。",
        sections: {
            covered: {
                heading: "現在の取り組み",
                body: [
                    // TODO(copy): MIP-1831 — the public-page sentence and the scan item are new.
                    "アプリの色のコントラスト。デザインのトークンは、WCAG 2.2 AA に対して自動テストで確認しています。主要な文字と補助的な文字は 4.5:1、第三の文字とフォーカスリングは 3:1 です。すべてのカラーテーマでライトとダークの両方を確認しています。公開ページの文字は、置かれているすべての背景で 4.5:1 を確認しています。",
                    "自動スキャン。axe の検査は、フロントエンドのコードを変えるたびに、公開ページとサインイン画面を対象に実行しています。検査は問題を報告するだけで、変更を止めることはありません。",
                    "キーボードのフォーカス。キーボードで移動すると、ボタンに見えるフォーカスリングが出ます。マウスでクリックしたときには出ません。",
                    "メニューのキーボード操作。アプリの一部のメニューとダイアログは、キーボードを使うテストで確認しています（例：チームのメニューとキーボードショートカットの一覧での移動）。まだすべてのメニューが対象ではありません。",
                    "ページの構造とスキップリンク。公開ページの各ページにはヘッダー、ナビゲーション、メインの領域、フッターがあります。公開ページとアプリの上部にあるリンクで、本文へ直接移動できます。",
                    "アプリの狭い画面での表示。主な画面（ホーム、タスク、ノート、インボックス、チャット、プラン）は、幅 320 px まで、操作する部分が切れずに表示されます。それより狭い場合は、アプリが横にスクロールします。",
                    "ピンチズーム。スマートフォンでも、ズームを無効にしていません。",
                    "スマートフォンでの表示。幅 390 px と、デスクトップ幅 1440 px で表示を確認しています。",
                    "画面幅の狭い表示。公開ページは、幅 195 px（200% の文字サイズの 390 px のスマートフォン）まで、横にスクロールせずに表示されます。ブラウザーで確認しています。狭い画面では、言語の切り替えはメニューに移ります。",
                    "視覚効果の軽減。端末で視覚効果の軽減が指定されている場合、アプリの一部のアニメーションは止まります。",
                ],
            },
            gaps: {
                heading: "まだできていないこと",
                body: [
                    "スクリーンリーダー（VoiceOver、NVDA、TalkBack）での確認は、まだ行っていません。ラベルはテストで確認していますが、スクリーンリーダー利用者による確認ではありません。",
                    // TODO(copy): MIP-1831 — the axe, colour, keyboard and conformance lines are reworded.
                    "axe の検査が対象にしているのは、公開ページとサインイン画面です。アプリの他の画面は対象ではありません。問題は報告するだけで変更を止めないため、問題が残ったまま公開されることがあります。",
                    "自動の色のテストは、アプリと公開ページの色を対象にしています。ただし、アプリの第三の文字は 3:1 に保っています。WCAG が文字に求める 4.5:1 には届かず、アプリでは変更していません。",
                    "キーボードのテストは、特定の画面と操作を確認するもので、すべての画面のすべての操作経路を確認するものではありません。キーボードのテストがまだない画面もあります。",
                    "視覚効果の軽減は、すべての場所には適用されていません。公開ページでは、一部のアニメーションだけが対応しています。",
                    "文字サイズ 200%、または大きなシステムフォントでの確認は、まだ行っていません。",
                    "WCAG 2.2 AA に対する適合性の確認は、まだ終えていません。スクリーンリーダーでの確認は行っておらず、狭い画面の確認は一部の画面と公開ページのヘッダーだけです。確認が終わるまで、適合しているとは主張しません。",
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
                    // TODO(copy): MIP-1831 — the report-on-request sentence is new.
                    "適合性レポートは、メールでご依頼いただければお送りします。",
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
