import { forwardRef, Fragment } from "react";
import { Checkbox, FormControl, FormHelperText, Link } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { PRIVACY_PATH, TERMS_PATH } from "../legalPaths";

interface SignUpConsentProps {
    checked: boolean;
    /** Show the "please agree" message and the error colour. */
    showError: boolean;
    onChange: (checked: boolean) => void;
    linkColor: string;
    linkHover: string;
    textColor: string;
    /** Colour of the error message; legible on the card in both modes. */
    errorColor: string;
}

// Read by screen readers only: says the link leaves the form.
const VISUALLY_HIDDEN = {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
} as const;

/**
 * Splits the translated sentence around its two link slots, so each locale
 * keeps its own word order ("{terms} and {privacy}" vs "{terms}と{privacy}").
 */
const TOKEN = /(\{terms\}|\{privacy\})/;

/**
 * The required "I agree to the Terms of Service and the Privacy Policy" box.
 * Unchecked by default; the form owns the state so the OAuth buttons can ask
 * for the same consent. The links open in a new tab so a half-filled form is
 * not lost.
 */
export const SignUpConsent = forwardRef<HTMLInputElement, SignUpConsentProps>(
    function SignUpConsent(
        { checked, showError, onChange, linkColor, linkHover, textColor, errorColor },
        ref
    ) {
        const { t } = useTranslation();
        const c = t.admin.auth.signUp.consent;

        const link = (href: string, label: string) => (
            <Link
                href={href}
                rel="noopener noreferrer"
                target="_blank"
                sx={{
                    color: linkColor,
                    fontWeight: 500,
                    textDecoration: "underline",
                    "&:hover": { color: linkHover },
                }}
            >
                {label}
                <span style={VISUALLY_HIDDEN}> {c.opensInNewTab}</span>
            </Link>
        );

        const label = c.label.split(TOKEN).map((part, i) => {
            if (part === "{terms}")
                return <Fragment key={i}>{link(TERMS_PATH, c.terms)}</Fragment>;
            if (part === "{privacy}")
                return <Fragment key={i}>{link(PRIVACY_PATH, c.privacy)}</Fragment>;
            return <Fragment key={i}>{part}</Fragment>;
        });

        return (
            <FormControl error={showError}>
                <Checkbox
                    checked={checked}
                    label={label}
                    name="accepted_terms"
                    size="md"
                    slotProps={{
                        input: { ref, "aria-required": true },
                        label: { sx: { color: textColor, lineHeight: 1.5 } },
                    }}
                    sx={{ alignItems: "flex-start", gap: 1 }}
                    onChange={(event) => onChange(event.target.checked)}
                />
                {showError && (
                    <FormHelperText role="alert" sx={{ mt: 0.5, color: errorColor }}>
                        {c.required}
                    </FormHelperText>
                )}
            </FormControl>
        );
    }
);
