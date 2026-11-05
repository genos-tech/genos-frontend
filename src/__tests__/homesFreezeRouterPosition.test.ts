/**
 * Each keep-alive Home must be wrapped in `FreezeRouterWhenHidden`, directly
 * inside its `FreezeWhenHidden` and outside its error boundary and `Suspense`
 * (MIP-971).
 *
 * Structural, like `appThemeProviderPosition.test.ts`: the behaviour is covered
 * by `freezeRouterWhenHidden.test.tsx` with stand-in screens, but only the
 * source can say that the real `ChatHome`, `TaskHome` and `NoteHome` are
 * wrapped, in the right order, with the `active` flag of their own service:
 *
 *  - Missing wrapper: the hidden Home follows every navigation again (about
 *    14,000 component updates per task click, none of them visible).
 *  - Wrong `active`: the Home would be frozen while it is shown (it would not
 *    follow the URL at all) or shown while hidden (no saving).
 *  - Inside the `Suspense` instead of outside: on a first visit the Home is a
 *    lazy chunk; if the user leaves before it arrives it would commit for the
 *    first time while hidden, and a wrapper mounted at that moment would
 *    capture a foreign URL instead of holding the one that hid it.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Prettier puts every prop on its own line at this nesting depth, so compare
// with all whitespace removed.
const flat = readFileSync(resolve(__dirname, "..", "App.tsx"), "utf8").replace(/\s+/g, "");

const HOMES = [
    ["chat", "ChatHome"],
    ["tasks", "TaskHome"],
    ["notes", "NoteHome"],
] as const;

/** The keep-alive block of one Home, from its `homesToRender` guard to its closing wrapper. */
const blockOf = (service: string) => {
    const start = flat.indexOf(`homesToRender.has("${service}")`);
    const end = flat.indexOf("</FreezeWhenHidden>", start);
    return start === -1 || end === -1 ? "" : flat.slice(start, end + "</FreezeWhenHidden>".length);
};

describe("keep-alive Homes in App.tsx", () => {
    it("imports the component", () => {
        expect(flat).toContain(
            'import{FreezeRouterWhenHidden}from"./components/layout/FreezeRouterWhenHidden";'
        );
    });

    it("wraps exactly the three Homes", () => {
        expect(flat.match(/<FreezeWhenHidden/g)).toHaveLength(3);
        expect(flat.match(/<FreezeRouterWhenHidden/g)).toHaveLength(3);
        expect(flat.match(/<\/FreezeRouterWhenHidden>/g)).toHaveLength(3);
    });

    it.each(HOMES)(
        "%s: FreezeWhenHidden > FreezeRouterWhenHidden > the Home's boundaries",
        (service, home) => {
            const block = blockOf(service);
            expect(block).not.toBe("");

            const active = `active={activeService==="${service}"}`;
            const order = [
                `<FreezeWhenHidden${active}>`,
                `<FreezeRouterWhenHidden${active}>`,
                "<FeatureErrorBoundary",
                "<Suspense",
                `<${home}`,
                "</Suspense>",
                "</FeatureErrorBoundary>",
                "</FreezeRouterWhenHidden>",
                "</FreezeWhenHidden>",
            ];
            let at = -1;
            for (const part of order) {
                const found = block.indexOf(part, at + 1);
                expect(
                    found,
                    `${part} after position ${at} in the ${service} block`
                ).toBeGreaterThan(at);
                at = found;
            }
        }
    );

    it.each(HOMES)("%s: the wrapper holds this Home alone", (service, home) => {
        const block = blockOf(service);
        // No other Home inside this block, and nothing between the two openings.
        for (const [, other] of HOMES) {
            if (other !== home) expect(block).not.toContain(`<${other}`);
        }
        expect(block).toMatch(
            new RegExp(
                `<FreezeWhenHiddenactive=\\{activeService==="${service}"\\}><FreezeRouterWhenHiddenactive=\\{activeService==="${service}"\\}><FeatureErrorBoundary`
            )
        );
    });
});
