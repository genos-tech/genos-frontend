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
        expect(all).not.toMatch(/SOC ?2|ISO ?27001|certif/i);
        expect(all).not.toMatch(/secretary/i);
        expect(all).not.toContain("秘書");
    });

    it("never states facts that only the operator can confirm", () => {
        const all = JSON.stringify(SECURITY_COPY);
        expect(all).not.toMatch(/backup/i);
        expect(all).not.toMatch(/retention|retain for/i);
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

    it("has a future expiry and the canonical location", () => {
        const expires = /^Expires: (.+)$/m.exec(text)?.[1];
        expect(expires).toBeTruthy();
        expect(Date.parse(expires ?? "")).toBeGreaterThan(Date.now());
        expect(text).toMatch(/^Canonical: https:\/\/genosai\.dev\/\.well-known\/security\.txt$/m);
    });
});
