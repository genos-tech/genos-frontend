/**
 * `/security` and `/.well-known/security.txt` (MIP-1248).
 *
 * Pins: both languages carry the same sections in the same order; the report address is the support
 * mailbox; security.txt names that contact and an expiry; and the statements that a personal-data
 * review found contradicted stay out of the copy (note 194 on MIP-1780).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { SECURITY_COPY } from "../lp/copy/security";
import SecurityPage from "../lp/SecurityPage";

const root = resolve(__dirname, "../..");

describe("SecurityPage copy", () => {
    it("has the same sections, in the same order, in ja and en", () => {
        expect(SECURITY_COPY.ja.sections.map((s) => s.id)).toEqual(
            SECURITY_COPY.en.sections.map((s) => s.id)
        );
        expect(SECURITY_COPY.en.sections.length).toBeGreaterThanOrEqual(7);
    });

    it("does not repeat the statements the personal-data review contradicts", () => {
        const all = JSON.stringify(SECURITY_COPY);
        expect(all).not.toMatch(/Work you did with teammates/);
        expect(all).not.toMatch(/name, email and profile are anonymi[sz]ed/);
        expect(all).not.toMatch(/Teams where you were the last member/);
        expect(all).not.toMatch(/connections are removed/);
        expect(all).not.toMatch(/business-tier/i);
        expect(all).not.toMatch(/do not train/i);
        expect(all).not.toMatch(/secretary/i);
        expect(all).not.toContain("秘書");
    });

    it("never states facts that only the operator can confirm", () => {
        const all = JSON.stringify(SECURITY_COPY);
        expect(all).not.toMatch(/backup/i);
        expect(all).not.toMatch(/retention|retain for/i);
    });
});

/**
 * MIP-2284 (Ken, 2026-11-24: no paid certification now). The page may say what Railway, the host, states
 * about itself, and that Genos follows public guidance. It must never say or imply that Genos is certified,
 * compliant or audited. These pins replace the earlier "no SOC 2, no certification words" pin: the words may
 * now appear, but only where they are attributed to Railway or denied for Genos.
 */
describe("SecurityPage certification wording (MIP-2284)", () => {
    const paragraphs = (lang: "en" | "ja") =>
        SECURITY_COPY[lang].sections.flatMap((s) => s.body.map((text) => ({ id: s.id, text })));

    it("keeps SOC 2, SOC 3 and AES-256 sentences to the hosting section and names Railway in them", () => {
        for (const lang of ["en", "ja"] as const) {
            for (const { id, text } of paragraphs(lang)) {
                if (/SOC ?[23]|AES-256/.test(text)) {
                    expect(id).toBe("where");
                    expect(text).toMatch(/Railway/);
                }
            }
        }
    });

    it("never says or implies that Genos is certified, compliant, audited or at an ASVS level", () => {
        // Only these denials may contain the forbidden words; they are cut out before the scan.
        const denials = [
            "Genos itself holds no certification",
            "has not been assessed or certified against any of it",
            "Genos 自体は認証を取得していません",
            "評価や認証を受けていません",
        ];
        let all = JSON.stringify(SECURITY_COPY);
        for (const denial of denials) {
            expect(all).toContain(denial);
            all = all.split(denial).join("");
        }
        expect(all).not.toMatch(/ISO ?\/?(IEC )?27001/i);
        expect(all).not.toMatch(
            /certif|\baudited\b|compliant|conform|accredit|approved by|level [123]\b|ASVS L[123]/i
        );
        expect(all).not.toMatch(/認定|認証|監査済|取得済|取得しました|準拠|適合|レベル ?[123]/);
    });

    it("says in both languages that Genos holds no certification, in the hosting paragraph", () => {
        const en = paragraphs("en").find((p) => /SOC ?2/.test(p.text));
        const ja = paragraphs("ja").find((p) => /SOC ?2/.test(p.text));
        expect(en?.text).toMatch(/Genos itself holds no certification/);
        expect(ja?.text).toMatch(/Genos 自体は認証を取得していません/);
    });

    it("keeps the SECURITY ACTION line off the page until Ken has declared (MIP-2284)", () => {
        // Add the line (and flip this pin) in the PR that follows the declaration, with the declaration ID.
        expect(JSON.stringify(SECURITY_COPY)).not.toMatch(/SECURITY ACTION|二つ星|★/);
    });

    it("links only to https sources", () => {
        for (const lang of ["en", "ja"] as const) {
            for (const section of SECURITY_COPY[lang].sections) {
                for (const link of section.links ?? []) {
                    expect(link.href).toMatch(/^https:\/\//);
                }
            }
        }
    });

    it("publishes the five-article basic policy in both languages", () => {
        for (const lang of ["en", "ja"] as const) {
            const policy = SECURITY_COPY[lang].sections.find((s) => s.id === "policy");
            expect(policy).toBeTruthy();
            // An intro paragraph plus five numbered articles, as in IPA's sample.
            const numbers = (policy?.body ?? [])
                .map((p) => /^([1-5])\. /.exec(p)?.[1])
                .filter(Boolean);
            expect(numbers).toEqual(["1", "2", "3", "4", "5"]);
        }
    });
});

describe("SecurityPage", () => {
    it("renders the report address and the first section", () => {
        render(
            <MemoryRouter>
                <SecurityPage />
            </MemoryRouter>
        );
        expect(screen.getByText("Where your data is kept")).toBeTruthy();
        const report = document.querySelector('[data-cta="security_report_email"]');
        expect(report?.getAttribute("href")).toBe(
            "mailto:genos.support@genosai.dev?subject=Security"
        );
    });
});

describe("/.well-known/security.txt", () => {
    const text = readFileSync(resolve(root, "public/.well-known/security.txt"), "utf8");

    it("names the support mailbox as the contact", () => {
        expect(text).toMatch(/^Contact: mailto:genos\.support@genosai\.dev$/m);
    });

    it("expires 30 to 366 days ahead, so renewal fails early and visibly (MIP-1900)", () => {
        const expires = /^Expires: (.+)$/m.exec(text)?.[1];
        expect(expires).toBeTruthy();
        const days = (Date.parse(expires ?? "") - Date.now()) / 86_400_000;
        expect(days).toBeGreaterThan(30);
        expect(days).toBeLessThanOrEqual(366);
    });

    it("has the canonical location", () => {
        expect(text).toMatch(/^Canonical: https:\/\/genosai\.dev\/\.well-known\/security\.txt$/m);
    });
});

describe("/security copy claims the code backs (MIP-1900)", () => {
    it("has no billing-email, short-lived token or security-team claim", () => {
        expect(JSON.stringify(SECURITY_COPY)).not.toMatch(
            /team billing|チームの請求|short-lived|security team|セキュリティ担当/
        );
    });
});
