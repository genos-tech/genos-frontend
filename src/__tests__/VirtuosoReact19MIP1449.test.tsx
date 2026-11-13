/**
 * react-virtuoso must take its useSyncExternalStore path on this React (MIP-1449).
 *
 * "Something went wrong in Tasks" on some fresh loads of a task page was a React #185 ("Maximum
 * update depth exceeded") raised from `dispatchSetState` inside a subscriber of react-virtuoso,
 * under `TaskCommentList` (MIP-1037, comment 7). react-virtuoso 4.14.0 chose how its components
 * subscribe to its engine with `React.version.startsWith("18")`, so React 19 ("19.1.1") fell
 * through to the legacy `useState` + layout-effect subscription, where a size report during
 * layout can set state again and again. Fixed upstream in 4.18.5 ("Fix useSyncExternalStore
 * detection for React 19+"): `parseInt(React.version, 10) >= 18`.
 *
 * jsdom has no layout, so the loop itself cannot be reproduced here. What can be held is the cause:
 * on React 19 the installed Virtuoso must subscribe through `useSyncExternalStore`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { Virtuoso } from "react-virtuoso";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

const renderList = () =>
    render(
        <Virtuoso
            data={["a", "b", "c"]}
            itemContent={(_index, label) => <div>{label}</div>}
            style={{ height: 300 }}
        />
    );

describe("react-virtuoso on this React", () => {
    it("runs on React 18 or newer (the premise)", () => {
        expect(parseInt(React.version, 10)).toBeGreaterThanOrEqual(19);
    });

    it("subscribes to its engine through useSyncExternalStore, not the legacy state-in-an-effect path", () => {
        const spy = vi.spyOn(React, "useSyncExternalStore");
        renderList();
        // Nothing else is rendered, so every call is Virtuoso's own.
        expect(spy).toHaveBeenCalled();
    });

    it("the control: the spy sees calls from a component that does use it", () => {
        const spy = vi.spyOn(React, "useSyncExternalStore");
        const Probe = () => {
            React.useSyncExternalStore(
                () => () => {},
                () => 1
            );
            return null;
        };
        render(<Probe />);
        expect(spy).toHaveBeenCalledTimes(1);
    });
});

// The release that fixed it. A caret floor and the lockfile both name it, so neither a fresh
// `npm install` nor `npm ci` can resolve an older one by accident.
const FIXED_IN = [4, 18, 5];
const atLeastFixed = (version: string) => {
    const [major, minor, patch] = version
        .replace(/^[^\d]*/, "")
        .split(".")
        .map(Number);
    const got = [major, minor, patch];
    for (let i = 0; i < 3; i++) {
        if (got[i] !== FIXED_IN[i]) return got[i] > FIXED_IN[i];
    }
    return true;
};
const ROOT = resolve(__dirname, "..", "..");

describe("the project does not go back to a release with the bug", () => {
    it("package.json asks for 4.18.5 or newer", () => {
        const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
        expect(atLeastFixed(pkg.dependencies["react-virtuoso"])).toBe(true);
    });

    it("the lockfile resolves 4.18.5 or newer", () => {
        const lock = JSON.parse(readFileSync(resolve(ROOT, "package-lock.json"), "utf8"));
        expect(atLeastFixed(lock.packages["node_modules/react-virtuoso"].version)).toBe(true);
    });

    it("the comparison itself is right (so the two checks above can fail)", () => {
        expect(atLeastFixed("^4.14.0")).toBe(false);
        expect(atLeastFixed("4.18.4")).toBe(false);
        expect(atLeastFixed("^4.18.5")).toBe(true);
        expect(atLeastFixed("4.18.22")).toBe(true);
        expect(atLeastFixed("5.0.0")).toBe(true);
    });
});
