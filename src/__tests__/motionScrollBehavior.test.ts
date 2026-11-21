/**
 * MIP-1829: smooth scrolling in the app follows prefers-reduced-motion.
 *
 * Every `scrollIntoView` / `scrollTo` that animates asks `smoothScrollBehavior()` instead of
 * writing `behavior: "smooth"` itself. The ratchet below fails when a new literal appears, so a
 * new call site cannot quietly ignore the user's setting.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOTION_FILE = "utils/motion.ts";

const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "__tests__" || entry.name === "node_modules") continue;
            walk(full, out);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
};

describe("smooth scroll honours prefers-reduced-motion", () => {
    it("the helper is smooth normally and instant when reduced", async () => {
        const { smoothScrollBehavior, prefersReducedMotion } = await import("../utils/motion");
        const realMatchMedia = window.matchMedia;
        const stub = (matches: boolean) => {
            window.matchMedia = ((query: string) => ({
                matches: query === "(prefers-reduced-motion: reduce)" && matches,
                media: query,
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => false,
            })) as unknown as typeof window.matchMedia;
        };
        try {
            stub(false);
            expect(prefersReducedMotion()).toBe(false);
            expect(smoothScrollBehavior()).toBe("smooth");
            stub(true);
            expect(prefersReducedMotion()).toBe(true);
            expect(smoothScrollBehavior()).toBe("auto");
        } finally {
            window.matchMedia = realMatchMedia;
        }
    });

    it('no source file hard-codes behavior: "smooth" outside the helper', () => {
        const offenders = walk(SRC)
            .filter((file) => !file.endsWith(path.normalize(MOTION_FILE)))
            .filter((file) => /behavior:\s*["']smooth["']/.test(fs.readFileSync(file, "utf8")))
            .map((file) => path.relative(SRC, file));
        expect(offenders).toEqual([]);
    });
});
