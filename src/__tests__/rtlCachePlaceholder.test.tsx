/**
 * MIP-1107: in Arabic, a `::placeholder` style crashed its screen.
 *
 * The RTL Emotion cache (`theme/rtlCache.ts`) passes its own `prefixer`,
 * imported from top-level `stylis`. Emotion runs its OWN copy of stylis
 * internally. When the two versions differ (top-level 4.4.0, Emotion's
 * 4.2.0), the 4.4.0 prefixer's "lift" step, which runs for
 * `::placeholder` and `:read-only`, writes into a structure 4.2.0 never
 * builds and throws "Cannot read properties of undefined (reading
 * 'push')". The error boundary then replaced the task table, quick-add
 * row, title block and several modals. LTR never hit it: the default
 * cache uses Emotion's built-in prefixer.
 *
 * Fix: `stylis` is pinned to the version `@emotion/cache` bundles. The
 * second test fails loudly if a future install lets them drift apart.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { CacheProvider } from "@emotion/react";
import Box from "@mui/joy/Box";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getRtlCache } from "../theme/rtlCache";

const require = createRequire(import.meta.url);

/** Version of the `stylis` package resolved from `fromPackage`'s folder. */
const stylisVersionSeenBy = (fromPackage: string): string => {
    const base = dirname(require.resolve(`${fromPackage}/package.json`));
    const pkg = require.resolve("stylis/package.json", { paths: [base] });
    return JSON.parse(readFileSync(pkg, "utf8")).version;
};

describe("RTL emotion cache", () => {
    it("renders a ::placeholder style without throwing", () => {
        const Field = () => (
            <Box
                component="input"
                placeholder="بحث"
                sx={{ color: "red", "&::placeholder": { color: "blue" } }}
            />
        );
        expect(() =>
            render(
                <CacheProvider value={getRtlCache()}>
                    <Field />
                </CacheProvider>
            )
        ).not.toThrow();
    });

    it("uses the same stylis version as Emotion itself", () => {
        const appStylis = JSON.parse(
            readFileSync(
                join(dirname(require.resolve("stylis/package.json")), "package.json"),
                "utf8"
            )
        ).version;
        expect(appStylis).toBe(stylisVersionSeenBy("@emotion/cache"));
    });
});
