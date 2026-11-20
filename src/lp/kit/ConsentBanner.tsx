import { forwardRef } from "react";
import { Link } from "react-router-dom";

import type { ConsentChoice } from "../../services/marketingConsent";
import type { Lang } from "../lpLang";

// TODO(copy): MIP-1778. Every string in this table is DRAFT wording for Ken's lawyer, not
// approved text (the privacy page row is the approved wording; this is not). Keep the claim
// in step with that row: what is counted, that it needs a cookie and browser storage, and
// that "Reject" stores and sends nothing.
const BANNER = {
    ja: {
        region: "Cookie と分析の同意",
        // TODO(copy)
        text: "同意いただいた場合のみ、分析用の Cookie とブラウザのストレージを使い、このサイトでのページの閲覧、ボタンのクリック、サインアップ、アクセス元を集計して、Genos を試していただくうえで役立つ内容を調べます。拒否した場合は、何も保存・送信しません。",
        // TODO(copy)
        accept: "同意する",
        // TODO(copy)
        reject: "拒否する",
        // TODO(copy)
        privacy: "プライバシーポリシー",
    },
    en: {
        region: "Cookie and analytics consent",
        // TODO(copy)
        text: "If you accept, we use an analytics cookie and browser storage to count page views, button clicks, sign-ups and where visitors come from on this site, to learn what helps people try Genos. If you reject, nothing is stored or sent.",
        // TODO(copy)
        accept: "Accept",
        // TODO(copy)
        reject: "Reject",
        // TODO(copy)
        privacy: "Privacy policy",
    },
} as const;

/**
 * The consent banner of the marketing pages (MIP-1778). A plain region in the page flow, above
 * the header, not a dialog: nothing is covered (the hero's buttons stay where they are), there
 * is no focus trap and no autofocus, and a keyboard user reaches it right after the skip link.
 * "Accept" and "Reject" are the same component with the same class, so they are the same size
 * and weight. The choice is applied by the caller (`services/marketingConsent`).
 */
export const ConsentBanner = forwardRef<
    HTMLElement,
    { lang: Lang; onChoose: (choice: ConsentChoice) => void }
>(function ConsentBanner({ lang, onChoose }, ref) {
    const t = BANNER[lang];
    return (
        <section ref={ref} aria-label={t.region} className="lp-consent" tabIndex={-1}>
            <div className="lp-container lp-consent__row">
                <p className="lp-consent__text">
                    {t.text}{" "}
                    <Link className="lp-consent__link" to="/privacy">
                        {t.privacy}
                    </Link>
                </p>
                <div className="lp-consent__actions">
                    <button
                        className="lp-btn lp-btn--secondary"
                        type="button"
                        onClick={() => onChoose("accepted")}
                    >
                        {t.accept}
                    </button>
                    <button
                        className="lp-btn lp-btn--secondary"
                        type="button"
                        onClick={() => onChoose("rejected")}
                    >
                        {t.reject}
                    </button>
                </div>
            </div>
        </section>
    );
});
