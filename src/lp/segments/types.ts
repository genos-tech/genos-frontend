export type Lang = "ja" | "en";

export type SegmentKey = "research" | "teams" | "projects" | "students";

export interface FaqItem {
    q: string;
    a: string;
}

/**
 * One audience page in one language (MIP-1232). Lean on purpose: a page that
 * answers "is this for me, how does it work, what do I get, what is not here
 * yet" in that order, and nothing else. The earlier model carried fifteen
 * sections per page, most of them restating each other.
 */
export interface SegmentCopy {
    meta: { title: string; description: string; ogTitle: string; ogDescription: string };
    hero: {
        title: string;
        sub: string;
        lead: string;
        primary: string;
        secondary: string;
        footnote: string;
    };
    /** Three short facts under the hero. */
    trust: string[];
    /** The questions this audience keeps asking, and what is wrong with the answer today. */
    questions: { title: string; items: string[]; closing: string };
    /** The loop the audience's work follows, as ordered steps. */
    workflow: { title: string; body: string; steps: string[] };
    features: Array<{ title: string; subtitle: string; bullets: string[] }>;
    ai: { title: string; body: string; prompts: string[] };
    /** What works today, and what is genuinely not available yet (shown with a "Coming" badge). */
    now: string[];
    coming: string[];
    audience: { title: string; items: string[]; quote: string };
    faq: { title: string; items: FaqItem[] };
    cta: { title: string; body: string; primary: string; secondary: string };
}

export interface SegmentConfig {
    key: SegmentKey;
    route: string;
    /** Subject-line tag used in the "discuss a pilot" mailto, e.g. "[Genos Research Pilot]". */
    mailtoTag: string;
    /** Students' secondary CTA scrolls to the workflow section instead of opening a pilot mailto. */
    secondaryCtaKind: "mailto" | "anchor";
    ja: SegmentCopy;
    en: SegmentCopy;
}
