/**
 * MIP-1043: the editor must not move when a floating menu opens.
 *
 * `.bn-box.bn-container` is a flex column with an 8px gap (the composers rely
 * on it). BlockNote 0.57 renders its floating menus in a
 * `data-floating-ui-portal` element INSIDE the container: nothing until a menu
 * opens, then a second flex item, which brings the gap with it. Hovering a text
 * block (side menu) dropped the whole task-body editor 8px; typing hid the menu
 * and it jumped back. The portal has nothing to lay out (the menus position
 * themselves), so it must not take part in the column. jsdom cannot lay out, so
 * this reads the stylesheet.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "../App.css"), "utf8");

const bodyOf = (selector: string): string | null => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\>]/g, "\\$&");
    const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
    return match ? match[1] : null;
};

describe("the shared BlockNote container", () => {
    it("still lays editors out as a column with the 8px gap the composers rely on", () => {
        const body = bodyOf(".bn-box.bn-container");
        expect(body).not.toBeNull();
        expect(body).toMatch(/display:\s*flex/);
        expect(body).toMatch(/flex-direction:\s*column-reverse/);
        expect(body).toMatch(/gap:\s*8px/);
    });

    it("keeps the floating-menu portal out of that column", () => {
        const body = bodyOf(".bn-box.bn-container > [data-floating-ui-portal]");
        expect(body, "the portal rule").not.toBeNull();
        expect(body).toMatch(/display:\s*contents/);
    });
});
