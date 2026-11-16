/**
 * MIP-1628: in the multi-person DM stack each face is drawn over the start side of the next, so a
 * no-picture member's initial, centred, was half under the face before it (a "B" read as a "3").
 * The initial now sits on the part of its face that stays visible.
 *
 * jsdom has no layout, so these pin what is written: the offset the initial gets, that it is
 * logical (the mirrored RTL stack flips it with the faces), and that the faces' own geometry and
 * the pictures are untouched. Where the letter lands is checked by eye in a browser.
 */

import { CacheProvider } from "@emotion/react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MDMAvatar } from "../components/ui/avatars/MDMAvatar";
import { MDM_STEP, mdmInitialOffset, mdmStackWidth } from "../components/ui/avatars/mdmStack";
import { getRtlCache } from "../theme/rtlCache";
import type { UserProps } from "../types/admin";
import type { MDMMemberProps } from "../types/chat";

afterEach(cleanup);

const member = (i: number, withPicture = false) =>
    ({
        userId: `u${i}`,
        userName: `User ${i}`,
        avatarImgPath: withPicture ? `p/${i}.png` : "",
    }) as MDMMemberProps;

/** Every declaration emotion wrote for the classes on `el`, as one string. */
const css = (el: Element): string => {
    const classes = Array.from(el.classList);
    const out: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of Array.from(sheet.cssRules)) {
            const text = rule.cssText;
            const selector = text.slice(0, text.indexOf("{"));
            if (classes.some((c) => new RegExp(`\\.${c}(?![\\w-])`).test(selector)))
                out.push(text);
        }
    }
    return out.join("\n");
};

const faces = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>("[class*='MuiAvatar-root'] > span")).map(
        (initial) => ({
            initial,
            face: initial.closest<HTMLElement>("[class*='MuiAvatar-root']")!.parentElement!,
        })
    );

const draw = (ui: React.ReactElement, rtl = false) =>
    render(
        rtl ? (
            <CacheProvider value={getRtlCache()}>
                <CssVarsProvider>{ui}</CssVarsProvider>
            </CacheProvider>
        ) : (
            <CssVarsProvider>{ui}</CssVarsProvider>
        )
    );

describe("mdmInitialOffset", () => {
    it("the first face is drawn whole: its initial stays centred", () => {
        expect(mdmInitialOffset(0, 28, false)).toEqual({ inline: 0, block: 0 });
        expect(mdmInitialOffset(0, 28, true)).toEqual({ inline: 0, block: 0 });
    });

    it("a later face's initial moves to the middle of the part its neighbour leaves visible", () => {
        for (const size of [18, 20, 28, 32]) {
            const { inline, block } = mdmInitialOffset(1, size, false);
            // The visible part runs from (1 - STEP) of the face to its far edge.
            const visibleMiddle = ((1 - MDM_STEP) * size + size) / 2;
            expect(size / 2 + inline).toBeCloseTo(visibleMiddle);
            expect(block).toBe(0);
        }
        expect(mdmInitialOffset(1, 20, false).inline).toBeCloseTo(4.5);
        expect(mdmInitialOffset(2, 28, false).inline).toBeCloseTo(6.3);
        expect(mdmInitialOffset(2, 32, false).inline).toBeCloseTo(7.2);
    });

    it("with a presence dot it moves less to the end and up, off the dot's corner", () => {
        const plain = mdmInitialOffset(1, 28, false);
        const dotted = mdmInitialOffset(1, 28, true);
        expect(dotted.inline).toBeGreaterThan(0);
        expect(dotted.inline).toBeLessThan(plain.inline);
        expect(dotted.block).toBeLessThan(0);
    });
});

describe("MDMAvatar: where a no-picture initial sits", () => {
    it("the first face's initial is not moved; the others move to the visible side", () => {
        const { container } = draw(
            <MDMAvatar avatarSize={20} members={[member(0), member(1), member(2)]} />
        );
        const [a, b, c] = faces(container);
        expect(css(a.initial)).toMatch(/inset-inline-start:\s*0(px)?\s*[;}]/);
        expect(css(b.initial)).toMatch(/inset-inline-start:\s*4\.5px/);
        expect(css(c.initial)).toMatch(/inset-inline-start:\s*4\.5px/);
    });

    it.each([
        ["sm", 28, 6.3],
        ["md", 32, 7.2],
    ] as const)("the %s preset (%ipx) moves a later initial %ipx", (size, _px, shift) => {
        const { container } = draw(<MDMAvatar members={[member(0), member(1)]} size={size} />);
        const [, b] = faces(container);
        expect(css(b.initial)).toMatch(new RegExp(`inset-inline-start:\\s*${shift}px`));
    });

    it("with presence dots (the chat list) the initial keeps off the dot", () => {
        const profiles = Object.fromEntries(
            [0, 1, 2].map((i) => [`u${i}`, { userId: `u${i}`, isOnline: true } as UserProps])
        );
        const { container } = draw(
            <MDMAvatar members={[member(0), member(1), member(2)]} teamMemberProfiles={profiles} />
        );
        const [a, b] = faces(container);
        expect(css(a.initial)).not.toMatch(/inset-block-start:\s*-/);
        expect(css(b.initial)).toMatch(/inset-inline-start:\s*2\.52px/);
        expect(css(b.initial)).toMatch(/inset-block-start:\s*-1\.96px/);
    });

    it("the offset is a logical property, so the mirrored (RTL) stack flips it with the faces", () => {
        const { container } = draw(
            <MDMAvatar avatarSize={20} members={[member(0), member(1), member(2)]} />,
            true
        );
        const [a, b] = faces(container);
        // The rtl plugin turns the faces' physical `left` into `right` (the stack starts at the
        // right edge) ...
        expect(css(b.face)).toMatch(/right:\s*11px/);
        expect(css(b.face)).not.toMatch(/left:\s*11px/);
        expect(css(a.face)).toMatch(/right:\s*0/);
        // ... and leaves the initial's logical offset alone, which the browser reads against
        // `dir=rtl` as "towards the left", the visible side of a mirrored stack.
        expect(css(b.initial)).toMatch(/inset-inline-start:\s*4\.5px/);
        expect(css(b.initial)).not.toMatch(/(^|[^-])(left|right):\s*4\.5px/);
    });
});

describe("MDMAvatar: what did not change", () => {
    it("every face stays a face wide, step 55% apart, three at most, stack width unchanged", () => {
        const { container } = draw(
            <MDMAvatar
                avatarSize={20}
                members={[member(0), member(1), member(2), member(3), member(4)]}
            />
        );
        const all = faces(container);
        expect(all).toHaveLength(3);
        all.forEach(({ face }, i) => {
            expect(css(face)).toMatch(new RegExp(`left:\\s*${i * 20 * MDM_STEP}px`));
            expect(css(face)).toMatch(/width:\s*20px/);
        });
        const stack = all[0].face.parentElement!;
        expect(css(stack)).toMatch(new RegExp(`width:\\s*${mdmStackWidth(5, 20)}px`));
        expect(mdmStackWidth(5, 20)).toBe(42);
    });

    it("a member with a picture still draws it (the initial is only the fallback)", () => {
        const { container } = draw(
            <MDMAvatar avatarSize={20} members={[member(0), member(1, true), member(2)]} />
        );
        const imgs = container.querySelectorAll("img");
        expect(imgs).toHaveLength(1);
        expect(imgs[0].getAttribute("src")).toContain("p/1.png");
        // Letters are the members without a picture.
        expect(container.textContent).toContain("U");
    });

    it("each face sits on an opaque base, so the face under it cannot show through the letter", () => {
        const { container } = draw(
            <MDMAvatar avatarSize={20} members={[member(0), member(1), member(2)]} />
        );
        for (const { face } of faces(container)) {
            expect(css(face)).toMatch(/border-radius:\s*50%/);
            expect(css(face)).toMatch(/background-color:/);
        }
    });

    it("no members: the people glyph, no initials", () => {
        const { container } = draw(<MDMAvatar members={[]} />);
        expect(container.querySelector("[class*='MuiAvatar-root'] > span")).toBeNull();
        expect(container.querySelector('svg[data-testid="PeopleRoundedIcon"]')).not.toBeNull();
    });
});
