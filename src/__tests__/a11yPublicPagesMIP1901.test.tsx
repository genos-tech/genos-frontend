/**
 * MIP-1901: the part of the axe scan that is NOT report-only, because a regression here is
 * a plain bug. (1) /developers has no `aria-prohibited-attr` violation (the scrollable code
 * blocks are labelled groups). (2) Every public page `main.tsx` registers is in the report
 * job's page list, so the coverage claim of `a11yReport.test.tsx` stays true.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import DevelopersPage from "../lp/DevelopersPage";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

describe("public pages, accessibility regressions (MIP-1901)", () => {
    it("/developers has no aria-prohibited-attr violation", async () => {
        const { container } = render(
            <MemoryRouter initialEntries={["/developers"]}>
                <DevelopersPage />
            </MemoryRouter>
        );
        const results = await axe.run(container, {
            runOnly: { type: "rule", values: ["aria-prohibited-attr"] },
        });
        // jsdom cannot always decide this rule: it may come back "incomplete", not a violation.
        expect([...results.violations, ...results.incomplete].map((v) => v.id)).toEqual([]);
        cleanup();
    }, 60_000);

    it("/developers has no landmark-unique violation (MIP-1875)", async () => {
        const { container } = render(
            <MemoryRouter initialEntries={["/developers"]}>
                <DevelopersPage />
            </MemoryRouter>
        );
        const navs = [...container.querySelectorAll("nav")];
        // Every <nav> on the page needs its own accessible name.
        const names = navs.map(
            (n) => n.getAttribute("aria-label") ?? n.getAttribute("aria-labelledby")
        );
        expect(names.every(Boolean)).toBe(true);
        expect(new Set(names).size).toBe(names.length);
        const results = await axe.run(container, {
            runOnly: { type: "rule", values: ["landmark-unique"] },
        });
        expect(results.violations.map((v) => v.id)).toEqual([]);
        cleanup();
    }, 60_000);

    it("the report job scans every public route main.tsx registers", () => {
        const main = read("../main.tsx");
        const registered = [
            ...main.matchAll(/(?:publicPage|publicSegmentPage)\([^)]*\)[^\n]*?path="([^"]+)"/g),
        ]
            .map((m) => m[1])
            // `/home` is an alias of `/`; a `:slug` route is the blog article template.
            .filter((p) => p !== "/home" && !p.includes(":"));
        expect(registered.length).toBeGreaterThan(15);
        const scanned = new Set(
            [...read("./a11yReport.test.tsx").matchAll(/^\s*\["(\/[^"]*)",/gm)].map((m) => m[1])
        );
        expect(registered.filter((p) => !scanned.has(p))).toEqual([]);
    });
});
