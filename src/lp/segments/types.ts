export type Lang = "ja" | "en";

export type SegmentKey = "research" | "teams" | "projects" | "students";

export interface SegmentMeta {
    pageTitle: string;
    metaDescription: string;
    ogTitle: string;
    ogDescription: string;
}

export interface SegmentHero {
    badge: string;
    title: string;
    titleSub: string;
    lead: string;
    primary: string;
    secondary: string;
    footnote: string;
}

export interface ProblemCard {
    title: string;
    body: string;
}

export interface SegmentProblem {
    eyebrow: string;
    title: string;
    body: string;
    questions: string[];
    closing: string;
    cards: ProblemCard[];
}

export interface SegmentWorkflow {
    eyebrow: string;
    title: string;
    body: string;
    steps: string[];
}

export interface SegmentSolution {
    eyebrow: string;
    title: string;
    body: string;
}

export interface SegmentFeature {
    title: string;
    subtitle: string;
    bullets: string[];
    image: string;
    imageAlt: string;
}

export interface SegmentContext {
    eyebrow: string;
    title: string;
    body: string;
    points: string[];
}

export interface SegmentAI {
    eyebrow: string;
    title: string;
    body: string;
    agentTagline: string;
    examplePrompts: string[];
}

export interface SegmentApprovalTrust {
    eyebrow: string;
    title: string;
    body: string;
    steps?: string[];
}

export interface SegmentCurrentAndNext {
    availableNow: string[];
    roadmap: string[];
}

export interface SegmentAudience {
    eyebrow: string;
    title: string;
    items: string[];
    hookQuote: string;
    hookLine: string;
}

export interface SegmentComparison {
    headers: [string, string, string];
    rows: [string, string, string][];
}

export interface SegmentCta {
    title: string;
    body: string;
    primary: string;
    secondary: string;
}

export interface FaqItem {
    q: string;
    a: string;
}

export interface SegmentFaq {
    eyebrow: string;
    title: string;
    items: FaqItem[];
}

export interface SegmentCopy {
    nav: {
        home: string;
        contact: string;
        faq: string;
        plans: string;
        demo: string;
    };
    meta: SegmentMeta;
    hero: SegmentHero;
    socialProof: string[];
    problem: SegmentProblem;
    workflow: SegmentWorkflow;
    solution: SegmentSolution;
    features: SegmentFeature[];
    context: SegmentContext;
    ai: SegmentAI;
    approvalTrust: SegmentApprovalTrust;
    currentAndNext: SegmentCurrentAndNext;
    audience: SegmentAudience;
    comparison: SegmentComparison;
    cta: SegmentCta;
    faq: SegmentFaq;
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
