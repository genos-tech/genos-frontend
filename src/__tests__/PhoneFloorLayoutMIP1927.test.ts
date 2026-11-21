import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// MIP-1927. jsdom cannot lay anything out, so this pins the three style decisions that were
// measured in Chrome (signed-in app at 280, 320, 390 and 1440 px) instead of the pixels:
//  - the 320px floor is set once on :root; the phone media rule that repeated it is gone;
//  - the app shell takes the same floor, so a window narrower than the body leaves no blank strip;
//  - the chat sidebar's tab row wraps, so on a 320px touch phone the "..." menu is not clipped.
const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("320px phone floor (MIP-1927)", () => {
    it("sets --min-width once, not again under the phone media query", () => {
        const css = read("index.css");
        expect(css.match(/--min-width:\s*320px/g)).toHaveLength(1);
    });

    it("gives the app shell the same minimum width as the body", () => {
        const app = read("App.tsx");
        expect(app).toMatch(/minWidth:\s*"var\(--min-width\)",\s*width:\s*"100vw"/);
    });

    it("lets the chat sidebar's tab row wrap so its menu stays inside the sidebar", () => {
        const sidebar = read("features/chat/components/sidebar/ChatSidebar.tsx");
        expect(sidebar).toMatch(/flexWrap:\s*"wrap",\s*rowGap:\s*0\.5/);
        expect(sidebar).toMatch(/marginInlineStart:\s*"auto"/);
    });
});
