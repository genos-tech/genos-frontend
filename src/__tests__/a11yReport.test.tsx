/**
 * Automated accessibility scan (MIP-1827): axe-core over the rendered public
 * pages and the sign-in form.
 *
 * REPORT-ONLY. A violation never fails this test: the point is a count per
 * page, written to a JSON file that the CI job `frontend-a11y (report-only)`
 * uploads. It runs only when `A11Y_REPORT=1`, so the required test shards skip
 * it and pay nothing for it.
 *
 *   A11Y_REPORT=1 A11Y_REPORT_FILE=/abs/path/a11y-report.json npx vitest run src/__tests__/a11yReport.test.tsx
 *
 * jsdom lays nothing out, so axe's `color-contrast` rule cannot measure
 * colours here. It is switched off below and contrast is covered by
 * `lpContrast.test.ts` (MIP-1828), which measures the real --lp pairs.
 */
import { appendFileSync, writeFileSync } from "node:fs";
import type { ReactElement } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render } from "@testing-library/react";
import axe, { type AxeResults, type Result } from "axe-core";
import { MemoryRouter } from "react-router-dom";
import { afterAll, describe, it, vi } from "vitest";

import { SignInForm } from "../features/admin/components/SignInForm";
import AccessibilityPage from "../lp/AccessibilityPage";
import BlogPage from "../lp/BlogPage";
import ChangelogPage from "../lp/ChangelogPage";
import ContactPage from "../lp/ContactPage";
import CookiesPage from "../lp/CookiesPage";
import DemoPage from "../lp/DemoPage";
import DevelopersPage from "../lp/DevelopersPage";
import DocsPage from "../lp/DocsPage";
import FeaturesPage from "../lp/FeaturesPage";
import LandingPage from "../lp/LandingPage";
import LegalPage from "../lp/LegalPage";
import MigratePage from "../lp/MigratePage";
import PlansPage from "../lp/PlansPage";
import PrivacyPage from "../lp/PrivacyPage";
import SecurityPage from "../lp/SecurityPage";
import SegmentLandingPage from "../lp/SegmentLandingPage";
import SubprocessorsPage from "../lp/SubprocessorsPage";
import SupportPage from "../lp/SupportPage";
import TermsPage from "../lp/TermsPage";

const ENABLED = process.env.A11Y_REPORT === "1";

/** The sign-in form reads the auth context; the scan needs no session. */
vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: null, setAccessToken: () => {} }),
    useOptionalAccessToken: () => null,
}));

/** One entry per public route (src/lp/seo/routes.ts, src/main.tsx) plus the sign-in form. */
const PAGES: [string, ReactElement][] = [
    ["/", <LandingPage key="p" />],
    ["/for-teams", <SegmentLandingPage key="p" segment="teams" />],
    ["/for-research", <SegmentLandingPage key="p" segment="research" />],
    ["/for-projects", <SegmentLandingPage key="p" segment="projects" />],
    ["/for-students", <SegmentLandingPage key="p" segment="students" />],
    ["/features-guide", <FeaturesPage key="p" />],
    ["/demo-guide", <DemoPage key="p" />],
    ["/plans", <PlansPage key="p" />],
    ["/developers", <DevelopersPage key="p" />],
    ["/contact", <ContactPage key="p" />],
    ["/support", <SupportPage key="p" />],
    ["/migrate", <MigratePage key="p" />],
    ["/docs", <DocsPage key="p" />],
    ["/security", <SecurityPage key="p" />],
    ["/accessibility", <AccessibilityPage key="p" />],
    ["/changelog", <ChangelogPage key="p" />],
    ["/privacy", <PrivacyPage key="p" />],
    ["/terms", <TermsPage key="p" />],
    ["/subprocessors", <SubprocessorsPage key="p" />],
    ["/cookies", <CookiesPage key="p" />],
    ["/legal", <LegalPage key="p" />],
    ["/blog", <BlogPage key="p" />],
    [
        "/signin",
        <CssVarsProvider key="p">
            <SignInForm />
        </CssVarsProvider>,
    ],
];

type Summary = {
    page: string;
    /** Elements rendered: a blank page would pass axe with zero violations. */
    elements: number;
    violations: number;
    incomplete: number;
    incompleteRules: string[];
    rules: Record<string, number>;
};
const summaries: Summary[] = [];

const tally = (rs: Result[]) => {
    const rules: Record<string, number> = {};
    for (const r of rs) rules[r.id] = (rules[r.id] ?? 0) + r.nodes.length;
    return rules;
};

describe.skipIf(!ENABLED)("public pages, axe-core (report-only)", () => {
    it.each(PAGES)(
        "%s",
        async (path, page) => {
            const { container, unmount } = render(
                <MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>
            );
            const results: AxeResults = await axe.run(container, {
                // No layout in jsdom: contrast is measured by lpContrast.test.ts.
                rules: { "color-contrast": { enabled: false } },
                resultTypes: ["violations", "incomplete"],
            });
            summaries.push({
                page: path,
                elements: container.querySelectorAll("*").length,
                incompleteRules: results.incomplete.map((r) => r.id),
                violations: results.violations.reduce((n, r) => n + r.nodes.length, 0),
                incomplete: results.incomplete.reduce((n, r) => n + r.nodes.length, 0),
                rules: tally(results.violations),
            });
            unmount();
            cleanup();
        },
        60_000
    );
});

afterAll(() => {
    if (!ENABLED || summaries.length === 0) return;
    const total = summaries.reduce((n, s) => n + s.violations, 0);
    const report = {
        generatedAt: new Date().toISOString(),
        axeCore: axe.version,
        total,
        pages: summaries,
    };
    const file = process.env.A11Y_REPORT_FILE ?? "a11y-report.json";
    writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(
        `axe report: ${total} violation node(s) across ${summaries.length} pages -> ${file}`
    );
    for (const s of summaries)
        console.log(
            `  ${s.page}\t${s.elements} el\t${s.violations} violations\t${s.incompleteRules.join(",")}`
        );
    // Make the result visible without opening the artifact (MIP-1901): a table in the job
    // summary and one workflow annotation per page with a violation. Still never fails.
    for (const s of summaries) {
        if (s.violations > 0) {
            const rules = Object.entries(s.rules)
                .map(([id, n]) => `${id} x${n}`)
                .join(", ");
            console.log(`::warning title=axe::${s.page} ${rules}`);
        }
    }
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
        const rows = summaries
            .filter((s) => s.violations > 0)
            .map(
                (s) =>
                    `| ${s.page} | ${Object.entries(s.rules)
                        .map(([id, n]) => `${id} (${n})`)
                        .join(", ")} | ${s.violations} |`
            );
        appendFileSync(
            summaryFile,
            [
                `### axe-core: ${total} violation node(s) across ${summaries.length} pages (report-only)`,
                "",
                ...(rows.length > 0
                    ? ["| Page | Rule | Nodes |", "| --- | --- | --- |", ...rows]
                    : ["No violations."]),
                "",
            ].join("\n")
        );
    }
});
