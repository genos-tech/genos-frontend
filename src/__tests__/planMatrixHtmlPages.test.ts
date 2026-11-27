/**
 * The HTML page rows of the plan table (MIP-2362): page count (Unlimited since MIP-2453), page size,
 * storage quota and saves per hour.
 *
 * The numbers come from the `html_pages` limit the public plans endpoint serves, which the api reads
 * off `HTML_NOTE_LIMITS` (the one table the save path enforces; pinned on the api side by
 * `test_plans_payload_html_notes_come_from_the_one_html_note_table`). The fixture is a copy of that
 * payload. Free has no HTML pages and shows a cross, never "0" or "Unlimited".
 */

import { describe, expect, it } from "vitest";

import { planMatrixGroups, type MatrixCell } from "../features/billing/planMatrix";
import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";
import type { PlanTier } from "../services/billingApi";
import payload from "./fixtures/plansPayloadTierPlanV2.json";

const p = en.settings.planUsage;

const make = (strip = false) =>
    payload.tiers.map((t) => {
        const limits = { ...t.limits } as Record<string, unknown>;
        if (strip) delete limits.html_pages;
        return {
            tier: t.tier,
            price: null,
            purchasable: false,
            contact_sales: t.tier === "enterprise",
            limits,
        };
    }) as unknown as PlanTier[];

const text = (c: MatrixCell): string =>
    c.kind === "yes" ? "yes" : c.kind === "no" ? "no" : c.label;

const rowOf = (groups: ReturnType<typeof planMatrixGroups>, key: string) =>
    groups.flatMap((g) => g.rows).find((r) => r.key === key);

describe("plan table, HTML page rows (MIP-2362)", () => {
    const groups = planMatrixGroups(make(), p, "en");

    it("shows Unlimited pages, page size, storage and saves per plan, Free as a cross", () => {
        const shown = (key: string) => rowOf(groups, key)?.cells.map(text);
        const unlimited = p.matrixUnlimited;
        expect(shown("html-pages")).toEqual(["no", unlimited, unlimited, unlimited, unlimited]);
        expect(shown("html-size")).toEqual(["no", "512 KB", "1 MB", "1 MB", "1 MB"]);
        expect(shown("html-storage")).toEqual(["no", "200 MB", "1 GB", "1 GB", "1 GB"]);
        expect(shown("html-saves")).toEqual(["no", "30", "60", "60", "60"]);
    });

    it("every number shown equals the served limits (no second copy in the matrix)", () => {
        const served = payload.tiers.map((t) => t.limits.html_pages);
        const row = (key: string) => rowOf(groups, key)!.cells;
        const bytesOf = (label: string) => {
            const unit = label.endsWith("GB")
                ? 1024 ** 3
                : label.endsWith("MB")
                  ? 1024 ** 2
                  : 1024;
            return parseInt(label, 10) * unit;
        };
        served.forEach((h, i) => {
            if (h === null) {
                for (const k of ["html-pages", "html-size", "html-storage", "html-saves"]) {
                    expect(row(k)[i].kind).toBe("no");
                }
                return;
            }
            expect(text(row("html-saves")[i]).replace(/,/g, "")).toBe(String(h.saves_per_hour));
            expect(bytesOf(text(row("html-size")[i]))).toBe(h.max_bytes);
            expect(bytesOf(text(row("html-storage")[i]))).toBe(h.max_storage_bytes);
        });
    });

    it("the storage and saves rows say what they are counted against", () => {
        expect(rowOf(groups, "html-storage")?.hint).toBe(p.matrixHintHtmlStorage);
        expect(rowOf(groups, "html-saves")?.hint).toBe(p.matrixHintPerPerson);
    });

    it("leaves the rows out on a server that does not send html_pages", () => {
        const old = planMatrixGroups(make(true), p, "en");
        for (const k of ["html-pages", "html-size", "html-storage", "html-saves"]) {
            expect(rowOf(old, k)).toBeUndefined();
        }
    });

    it("renders in Japanese with the localized labels", () => {
        const jp = planMatrixGroups(make(), ja.settings?.planUsage as typeof p, "ja");
        expect(rowOf(jp, "html-pages")?.label).toBe(ja.settings?.planUsage?.matrixRowHtmlPages);
        expect(rowOf(jp, "html-storage")?.label).toBe(
            ja.settings?.planUsage?.matrixRowHtmlStorage
        );
        expect(rowOf(jp, "html-size")?.cells.map(text)).toEqual([
            "no",
            "512 KB",
            "1 MB",
            "1 MB",
            "1 MB",
        ]);
    });
});
