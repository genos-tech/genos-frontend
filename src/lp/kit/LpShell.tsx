import "./lp.css";

import { useEffect, useState, type ReactNode } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Link } from "react-router-dom";

import { useLpLang, type Lang } from "../lpLang";
import { APP_URL, CONTACT_EMAIL, SIGNUP_URL } from "./links";
import { useLpMode } from "./lpTheme";

export type NavKey = "home" | "features" | "developers" | "plans" | "blog" | "demo" | null;

const SHELL = {
    ja: {
        skip: "本文へスキップ",
        nav: {
            features: "機能",
            demo: "デモの見方",
            developers: "MCP・開発者",
            plans: "料金",
            blog: "ブログ",
        },
        signIn: "ログイン",
        tryDemo: "デモを試す",
        menu: "メニュー",
        closeMenu: "メニューを閉じる",
        dark: "ダークモードにする",
        light: "ライトモードにする",
        lang: "表示言語",
        tagline: "AIが、仕事の経緯までわかるワークスペース。",
        cols: {
            product: "プロダクト",
            forYou: "使い方別",
            resources: "リソース",
            company: "Genosについて",
        },
        links: {
            features: "機能",
            demo: "デモの見方",
            plans: "料金",
            developers: "MCP・開発者",
            research: "研究・研究室",
            teams: "業務チーム",
            projects: "プロジェクト・スタートアップ",
            students: "学生・ゼミ",
            blog: "ブログ",
            support: "サポート",
            privacy: "プライバシー",
            legal: "利用規約・特商法",
            signup: "無料で始める",
            contact: "お問い合わせ",
        },
        rights: "Genos. All rights reserved.",
    },
    en: {
        skip: "Skip to content",
        nav: {
            features: "Features",
            demo: "Demo guide",
            developers: "MCP & developers",
            plans: "Pricing",
            blog: "Blog",
        },
        signIn: "Sign in",
        tryDemo: "Try the demo",
        menu: "Menu",
        closeMenu: "Close menu",
        dark: "Switch to dark mode",
        light: "Switch to light mode",
        lang: "Language",
        tagline: "The workspace your AI already understands.",
        cols: {
            product: "Product",
            forYou: "Made for",
            resources: "Resources",
            company: "Genos",
        },
        links: {
            features: "Features",
            demo: "Demo guide",
            plans: "Pricing",
            developers: "MCP & developers",
            research: "Research and labs",
            teams: "Business teams",
            projects: "Projects and startups",
            students: "Students",
            blog: "Blog",
            support: "Support",
            privacy: "Privacy",
            legal: "Terms and legal",
            signup: "Start free",
            contact: "Contact",
        },
        rights: "Genos. All rights reserved.",
    },
} as const;

type ShellApi = {
    lang: Lang;
    /** An app link that carries the visitor's language choice (`useLpLang`). */
    appHref: (base: string) => string;
};

/**
 * The frame every marketing page shares: header (nav, language, light/dark,
 * sign in, try the demo), the page, and the footer. Pages render inside it
 * through a function child, so they get the language and the app-link helper
 * without each re-implementing the toggle.
 */
export function LpShell({
    active,
    children,
}: {
    active: NavKey;
    children: (api: ShellApi) => ReactNode;
}) {
    const { lang, setLang, appHref } = useLpLang();
    const { mode, toggleMode, style } = useLpMode();
    const [menuOpen, setMenuOpen] = useState(false);
    const t = SHELL[lang];
    const year = new Date().getFullYear();

    useEffect(() => {
        if (!menuOpen) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMenuOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [menuOpen]);

    const navItems: Array<{ key: Exclude<NavKey, "home" | null>; to: string }> = [
        { key: "features", to: "/features-guide" },
        { key: "demo", to: "/demo-guide" },
        { key: "developers", to: "/developers" },
        { key: "plans", to: "/plans" },
        { key: "blog", to: "/blog" },
    ];

    return (
        <div className="lp-root" data-mode={mode} lang={lang} style={style}>
            <a className="lp-btn lp-btn--secondary lp-skip" href="#lp-main">
                {t.skip}
            </a>
            <header className="lp-header">
                <div className="lp-container lp-header__row">
                    <Link aria-label="Genos" className="lp-logo" to="/home">
                        <img alt="" height={28} src="/genos-logo.png" width={28} />
                        <span>Genos</span>
                    </Link>
                    <nav aria-label="Genos" className="lp-nav">
                        {navItems.map((item) => (
                            <Link
                                key={item.key}
                                aria-current={active === item.key ? "page" : undefined}
                                to={item.to}
                            >
                                {t.nav[item.key]}
                            </Link>
                        ))}
                    </nav>
                    <div className="lp-header__end">
                        <div aria-label={t.lang} className="lp-seg" role="group">
                            {(["ja", "en"] as Lang[]).map((item) => (
                                <button
                                    key={item}
                                    aria-pressed={lang === item}
                                    lang={item}
                                    type="button"
                                    onClick={() => setLang(item)}
                                >
                                    {item === "ja" ? "日本語" : "EN"}
                                </button>
                            ))}
                        </div>
                        <button
                            aria-label={mode === "dark" ? t.light : t.dark}
                            className="lp-btn lp-btn--ghost lp-icon-btn"
                            type="button"
                            onClick={toggleMode}
                        >
                            {mode === "dark" ? (
                                <Sun size={18} aria-hidden />
                            ) : (
                                <Moon size={18} aria-hidden />
                            )}
                        </button>
                        <a
                            className="lp-btn lp-btn--ghost lp-btn--sm lp-only-wide"
                            href={appHref(`${APP_URL}/signin`)}
                        >
                            {t.signIn}
                        </a>
                        <a
                            className="lp-btn lp-btn--primary lp-btn--sm lp-only-wide"
                            href={appHref(APP_URL)}
                        >
                            {t.tryDemo}
                        </a>
                        <button
                            aria-controls="lp-menu"
                            aria-expanded={menuOpen}
                            aria-label={menuOpen ? t.closeMenu : t.menu}
                            className="lp-btn lp-btn--ghost lp-icon-btn lp-only-narrow"
                            type="button"
                            onClick={() => setMenuOpen((open) => !open)}
                        >
                            {menuOpen ? (
                                <X size={20} aria-hidden />
                            ) : (
                                <Menu size={20} aria-hidden />
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {menuOpen && (
                <div className="lp-menu" id="lp-menu">
                    {/* The scrim is a real button (a click outside the panel closes the menu), not a
                        clickable div: it is also reachable by keyboard-less assistive tech. */}
                    <button
                        aria-label={t.closeMenu}
                        className="lp-menu__scrim"
                        tabIndex={-1}
                        type="button"
                        onClick={() => setMenuOpen(false)}
                    />
                    <nav aria-label="Genos" className="lp-menu__panel">
                        {navItems.map((item) => (
                            <Link
                                key={item.key}
                                aria-current={active === item.key ? "page" : undefined}
                                to={item.to}
                                onClick={() => setMenuOpen(false)}
                            >
                                {t.nav[item.key]}
                            </Link>
                        ))}
                        <div className="lp-actions" style={{ marginTop: 12 }}>
                            <a className="lp-btn lp-btn--primary" href={appHref(APP_URL)}>
                                {t.tryDemo}
                            </a>
                            <a
                                className="lp-btn lp-btn--secondary"
                                href={appHref(`${APP_URL}/signin`)}
                            >
                                {t.signIn}
                            </a>
                        </div>
                    </nav>
                </div>
            )}

            <main id="lp-main">{children({ lang, appHref })}</main>

            <footer className="lp-footer">
                <div className="lp-container">
                    <div className="lp-footer__grid">
                        <div className="lp-stack-s">
                            <Link className="lp-logo" to="/home">
                                <img alt="" height={28} src="/genos-logo.png" width={28} />
                                <span>Genos</span>
                            </Link>
                            <p>{t.tagline}</p>
                        </div>
                        <div>
                            <h2>{t.cols.product}</h2>
                            <ul>
                                <li>
                                    <Link to="/features-guide">{t.links.features}</Link>
                                </li>
                                <li>
                                    <Link to="/demo-guide">{t.links.demo}</Link>
                                </li>
                                <li>
                                    <Link to="/plans">{t.links.plans}</Link>
                                </li>
                                <li>
                                    <Link to="/developers">{t.links.developers}</Link>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h2>{t.cols.forYou}</h2>
                            <ul>
                                <li>
                                    <Link to="/for-research">{t.links.research}</Link>
                                </li>
                                <li>
                                    <Link to="/for-teams">{t.links.teams}</Link>
                                </li>
                                <li>
                                    <Link to="/for-projects">{t.links.projects}</Link>
                                </li>
                                <li>
                                    <Link to="/for-students">{t.links.students}</Link>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h2>{t.cols.resources}</h2>
                            <ul>
                                <li>
                                    <Link to="/blog">{t.links.blog}</Link>
                                </li>
                                <li>
                                    <Link to="/support">{t.links.support}</Link>
                                </li>
                                <li>
                                    <Link to="/privacy">{t.links.privacy}</Link>
                                </li>
                                <li>
                                    <Link to="/legal">{t.links.legal}</Link>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h2>{t.cols.company}</h2>
                            <ul>
                                <li>
                                    <a href={appHref(SIGNUP_URL)}>{t.links.signup}</a>
                                </li>
                                <li>
                                    <a href={`mailto:${CONTACT_EMAIL}`}>{t.links.contact}</a>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="lp-footer__base">
                        <span>
                            © {year} {t.rights}
                        </span>
                        <span translate="no">{CONTACT_EMAIL}</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
