import { Plus } from "lucide-react";

import { BILLING_FAQ } from "./copy/billingFaq";
import type { Lang } from "./lpLang";

/**
 * The billing questions under the pricing table (MIP-1250).
 *
 * `firstMonthOffer` is the server's own switch, read from `/billing/plans/` (`first_month_offer`):
 * the first-month answer renders only when it is true, so the page never describes an offer that is
 * not live. The copy and the rule are the same for both languages.
 */
export function BillingFaq({ lang, firstMonthOffer }: { lang: Lang; firstMonthOffer: boolean }) {
    const copy = BILLING_FAQ[lang];
    const items = copy.items.filter((item) => !item.firstMonth || firstMonthOffer);
    return (
        <section aria-labelledby="billing-faq-heading" className="lp-section lp-section--flush">
            <div className="lp-container">
                <div className="lp-head" style={{ marginBottom: 24 }}>
                    <h2 className="lp-h2" id="billing-faq-heading">
                        {copy.heading}
                    </h2>
                    <p className="lp-small">{copy.lead}</p>
                </div>
                <div className="lp-faq">
                    {items.map((item) => (
                        <details key={item.id}>
                            <summary>
                                {item.q}
                                <Plus size={18} aria-hidden />
                            </summary>
                            <div>
                                {item.a.map((paragraph) => (
                                    <p key={paragraph}>{paragraph}</p>
                                ))}
                            </div>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
