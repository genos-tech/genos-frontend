// The currency switcher on a pricing page.
//
// Renders NOTHING when only one currency is configured, which is the
// state Genos is in until USD prices exist in Stripe. A picker with one
// option is a control that asks a question with no answer.
//
// Deliberately plain <select>: this sits on both the in-app plans page
// (Joy UI) and the marketing page (Tailwind), and a native control is
// the one thing that looks at home in both without dragging either
// design system into the other.

import { currencyLabel } from "../../utils/currency";

interface Props {
    /** Currencies the SERVER has prices for, default first. */
    supported: string[] | undefined;
    value: string;
    onChange: (code: string) => void;
    className?: string;
    /** Accessible name; the pages differ in whether a label is visible. */
    ariaLabel: string;
}

export const CurrencyPicker = ({ supported, value, onChange, className, ariaLabel }: Props) => {
    // `supported` is derived server-side from configured Stripe prices,
    // so a currency can never be offered here before it can actually be
    // bought — no picker option leading to a dead checkout.
    if (!supported || supported.length < 2) return null;

    return (
        <select
            aria-label={ariaLabel}
            className={className}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            {supported.map((code) => (
                <option key={code} value={code}>
                    {currencyLabel(code)}
                </option>
            ))}
        </select>
    );
};
