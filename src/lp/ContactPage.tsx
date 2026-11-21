import { useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { CONTACT_COPY, type ContactCopy, type ContactTopic } from "./copy/contact";
import { LpShell } from "./kit/LpShell";
import type { Lang } from "./lpLang";
import { CONTACT_META } from "./seo/pageMeta";
import { SUPPORT_EMAIL } from "./supportLabels";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * `/contact` — the contact form (MIP-1261), with an Enterprise enquiry variant
 * (`/contact?topic=enterprise`).
 *
 * The form posts to `POST /api/v2/contact/`, which mails the message to the
 * support inbox and stores nothing (decision D11). The plain mailto address
 * stays visible under the form for anyone whose request fails or who prefers
 * email. Honeypot field `website` is hidden from people and filled by bots.
 */

const API_BASE = import.meta.env.VITE_DJANGO_URL || "https://api.genosai.dev";
const TOPICS: ContactTopic[] = ["general", "enterprise", "security", "press"];
const MESSAGE_MAX = 4000;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_TIMEOUT_MS = 15000;

type FieldName = "name" | "email" | "topic" | "message";
type FieldErrors = Partial<Record<FieldName, string>>;
type Values = { name: string; email: string; topic: ContactTopic; message: string };
type Status = "idle" | "submitting" | "sent" | "error";

const topicFromQuery = (raw: string | null): ContactTopic =>
    TOPICS.includes(raw as ContactTopic) ? (raw as ContactTopic) : "general";

function validate(values: Values, c: ContactCopy): FieldErrors {
    const errors: FieldErrors = {};
    if (!values.name.trim()) errors.name = c.errors.required;
    if (!values.email.trim()) errors.email = c.errors.required;
    else if (!EMAIL_SHAPE.test(values.email.trim())) errors.email = c.errors.invalidEmail;
    if (!values.message.trim()) errors.message = c.errors.required;
    else if (values.message.length > MESSAGE_MAX) errors.message = c.errors.tooLong;
    return errors;
}

/** Map the API's field codes (never values) onto this page's messages. */
function fieldErrorsFromApi(codes: Record<string, string>, c: ContactCopy): FieldErrors {
    const out: FieldErrors = {};
    for (const [field, code] of Object.entries(codes)) {
        if (field === "email")
            out.email = code === "invalid" ? c.errors.invalidEmail : c.errors.required;
        else if (field === "topic") out.topic = c.errors.invalidTopic;
        else if (field === "message")
            out.message = code === "too_long" ? c.errors.tooLong : c.errors.required;
        else if (field === "name")
            out.name = code === "too_long" ? c.errors.tooLong : c.errors.required;
    }
    return out;
}

function ContactBody({ lang }: { lang: Lang }) {
    const c = CONTACT_COPY[lang];
    useDocumentMeta({ ...CONTACT_META[lang], lang });
    const [params] = useSearchParams();

    const [values, setValues] = useState<Values>(() => ({
        name: "",
        email: "",
        topic: topicFromQuery(params.get("topic")),
        message: "",
    }));
    const [honeypot, setHoneypot] = useState("");
    const [errors, setErrors] = useState<FieldErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [status, setStatus] = useState<Status>("idle");
    const refs = {
        name: useRef<HTMLInputElement>(null),
        email: useRef<HTMLInputElement>(null),
        topic: useRef<HTMLSelectElement>(null),
        message: useRef<HTMLTextAreaElement>(null),
    };

    const isEnterprise = values.topic === "enterprise";
    const update = (field: FieldName, value: string) => {
        setValues((v) => ({ ...v, [field]: value }));
        if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    };

    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (status === "submitting") return;
        setFormError(null);

        const clientErrors = validate(values, c);
        setErrors(clientErrors);
        const first = (["name", "email", "topic", "message"] as FieldName[]).find(
            (f) => clientErrors[f]
        );
        if (first) {
            setFormError(c.errors.summary);
            refs[first].current?.focus();
            return;
        }

        setStatus("submitting");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const res = await fetch(`${API_BASE}/api/v2/contact/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "omit",
                signal: controller.signal,
                body: JSON.stringify({
                    name: values.name,
                    email: values.email,
                    topic: values.topic,
                    message: values.message,
                    language: lang,
                    website: honeypot,
                }),
            });
            if (res.status === 202) {
                setStatus("sent");
                setValues((v) => ({ ...v, name: "", email: "", message: "" }));
                return;
            }
            if (res.status === 400) {
                const body = (await res.json().catch(() => ({}))) as {
                    errors?: Record<string, string>;
                };
                const apiErrors = fieldErrorsFromApi(body.errors ?? {}, c);
                setErrors(apiErrors);
                setFormError(c.errors.summary);
                const firstApi = (["name", "email", "topic", "message"] as FieldName[]).find(
                    (f) => apiErrors[f]
                );
                if (firstApi) refs[firstApi].current?.focus();
                setStatus("error");
                return;
            }
            setFormError(res.status === 429 ? c.errors.rateLimited : c.errors.unavailable);
            setStatus("error");
        } catch {
            // Network failure or the timeout above: the mailto line below still works.
            setFormError(c.errors.unavailable);
            setStatus("error");
        } finally {
            clearTimeout(timer);
        }
    }

    return (
        <>
            <header className="lp-pagehead">
                <div className="lp-container lp-container--narrow lp-stack-s">
                    <h1 className="lp-title">{isEnterprise ? c.enterpriseTitle : c.title}</h1>
                    <p className="lp-body">{isEnterprise ? c.enterpriseLead : c.lead}</p>
                </div>
            </header>

            <div className="lp-container lp-container--narrow lp-pagebody">
                {status === "sent" ? (
                    <div className="lp-contact__sent" role="status">
                        <h2 className="lp-contact__sent-heading">{c.sent.heading}</h2>
                        <p>{c.sent.body}</p>
                    </div>
                ) : (
                    <form className="lp-contact" noValidate onSubmit={submit}>
                        {formError && (
                            <p className="lp-contact__alert" role="alert">
                                {formError}
                            </p>
                        )}

                        <div className="lp-field">
                            <label htmlFor="contact-name">{c.fields.name}</label>
                            <input
                                ref={refs.name}
                                aria-describedby={errors.name ? "contact-name-error" : undefined}
                                aria-invalid={errors.name ? true : undefined}
                                autoComplete="name"
                                id="contact-name"
                                maxLength={200}
                                name="name"
                                type="text"
                                value={values.name}
                                onChange={(e) => update("name", e.target.value)}
                            />
                            {errors.name && (
                                <p className="lp-field__error" id="contact-name-error">
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        <div className="lp-field">
                            <label htmlFor="contact-email">{c.fields.email}</label>
                            <input
                                ref={refs.email}
                                aria-describedby={errors.email ? "contact-email-error" : undefined}
                                aria-invalid={errors.email ? true : undefined}
                                autoComplete="email"
                                id="contact-email"
                                inputMode="email"
                                name="email"
                                spellCheck={false}
                                type="email"
                                value={values.email}
                                onChange={(e) => update("email", e.target.value)}
                            />
                            {errors.email && (
                                <p className="lp-field__error" id="contact-email-error">
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        <div className="lp-field">
                            <label htmlFor="contact-topic">{c.fields.topic}</label>
                            <select
                                ref={refs.topic}
                                aria-describedby={errors.topic ? "contact-topic-error" : undefined}
                                aria-invalid={errors.topic ? true : undefined}
                                id="contact-topic"
                                name="topic"
                                value={values.topic}
                                onChange={(e) => update("topic", e.target.value)}
                            >
                                {TOPICS.map((t) => (
                                    <option key={t} value={t}>
                                        {c.topics[t]}
                                    </option>
                                ))}
                            </select>
                            {errors.topic && (
                                <p className="lp-field__error" id="contact-topic-error">
                                    {errors.topic}
                                </p>
                            )}
                        </div>

                        <div className="lp-field">
                            <label htmlFor="contact-message">{c.fields.message}</label>
                            <textarea
                                ref={refs.message}
                                aria-invalid={errors.message ? true : undefined}
                                id="contact-message"
                                name="message"
                                rows={7}
                                value={values.message}
                                aria-describedby={
                                    errors.message
                                        ? "contact-message-count contact-message-error"
                                        : "contact-message-count"
                                }
                                onChange={(e) => update("message", e.target.value)}
                            />
                            <div className="lp-field__meta">
                                <span className="lp-small" id="contact-message-count">
                                    {c.fields.messageCount(values.message.length, MESSAGE_MAX)}
                                </span>
                            </div>
                            {errors.message && (
                                <p className="lp-field__error" id="contact-message-error">
                                    {errors.message}
                                </p>
                            )}
                        </div>

                        {/* Honeypot: hidden from people and screen readers; bots fill every field. */}
                        <div aria-hidden="true" className="lp-contact__hp">
                            <label htmlFor="contact-website">Website</label>
                            <input
                                autoComplete="off"
                                id="contact-website"
                                name="website"
                                tabIndex={-1}
                                type="text"
                                value={honeypot}
                                onChange={(e) => setHoneypot(e.target.value)}
                            />
                        </div>

                        <p className="lp-small lp-contact__privacy">{c.privacy}</p>

                        <div>
                            <button
                                className="lp-btn lp-btn--primary"
                                disabled={status === "submitting"}
                                type="submit"
                                data-cta={
                                    isEnterprise ? "contact_enterprise_submit" : "contact_submit"
                                }
                            >
                                {status === "submitting" ? c.submitting : c.submit}
                            </button>
                        </div>

                        <p className="lp-small">
                            {c.fallbackIntro}{" "}
                            <a href={`mailto:${SUPPORT_EMAIL}`}>
                                <span translate="no">{SUPPORT_EMAIL}</span>
                            </a>
                        </p>
                    </form>
                )}
            </div>
        </>
    );
}

export default function ContactPage() {
    return <LpShell active={null}>{({ lang }) => <ContactBody lang={lang} />}</LpShell>;
}
