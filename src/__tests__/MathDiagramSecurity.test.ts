/**
 * What a formula or a diagram in a SHARED note may do in someone else's browser
 * (MIP-1019, MIP-1025). The editors render other people's TeX (KaTeX) and Mermaid source,
 * so the safe settings are load-bearing. Until MIP-1025 they were the defaults of the
 * BlockNote packages; now the app owns the renderers (`katexModule`, `mermaidModule`) and
 * sets `trust: false` and `securityLevel: "strict"` itself. This pins the values and the
 * behaviour: a later change that loosens either fails here.
 */
import mermaid from "mermaid";
import { describe, expect, it } from "vitest";

import { default as katex, katexToHtml } from "../components/editors/blocks/katexModule";
import { MERMAID_CONFIG, renderDiagramSvg } from "../components/editors/blocks/mermaidModule";

describe("KaTeX (the math blocks)", () => {
    /** The rendered markup, parsed (inert in jsdom): what a browser would be handed. */
    const parse = (latex: string, inline = false) => {
        const host = document.createElement("div");
        host.innerHTML = katexToHtml(latex, inline).html;
        return host;
    };

    it.each([
        ["a link to a javascript: address", "\\href{javascript:alert(1)}{click}"],
        ["a link to any address", "\\href{https://example.com}{click}"],
        ["an image", "\\includegraphics{https://example.com/x.png}"],
        ["a custom class", "\\htmlClass{evil}{x}"],
        ["a custom id", "\\htmlId{evil}{x}"],
        ["inline style", "\\htmlStyle{position:fixed}{x}"],
        ["a data attribute", "\\htmlData{k=v}{x}"],
    ])("does not render %s as an active element or attribute", (_name, latex) => {
        for (const inline of [false, true]) {
            const host = parse(latex, inline);
            // KaTeX shows an unsupported command as visible red source text (so the string
            // "javascript:" may appear as TEXT); what matters is that nothing is active.
            expect(
                host.querySelectorAll("a, img, script, iframe, object, embed, form, link, style")
            ).toHaveLength(0);
            expect(host.querySelectorAll("[href], [src], [srcset], [xlink\\:href]")).toHaveLength(
                0
            );
            for (const el of host.querySelectorAll("*")) {
                for (const attr of Array.from(el.attributes)) {
                    expect(attr.name, `${el.tagName} ${attr.name}`).not.toMatch(/^on/i);
                    expect(attr.value, `${el.tagName} ${attr.name}`).not.toMatch(/javascript:/i);
                }
            }
            expect(host.querySelector(".evil, #evil, [data-k]")).toBeNull();
            expect(host.querySelector('[style*="position"]')).toBeNull();
        }
    });

    it("renders ordinary maths, inline and as a display", () => {
        expect(parse("E=mc^2").querySelector(".katex-display")).not.toBeNull();
        const inline = parse("E=mc^2", true);
        expect(inline.querySelector(".katex")).not.toBeNull();
        expect(inline.querySelector(".katex-display")).toBeNull();
    });

    it("reports a source that does not parse, and still returns something to show", () => {
        const result = katexToHtml("\\frac{", false);
        expect(result.error).toBeTruthy();
        expect(result.html).not.toBe("");
        expect(katexToHtml("x^2", false).error).toBeUndefined();
    });

    it("is the module's own KaTeX that renders", () => {
        expect(typeof katex.renderToString).toBe("function");
    });
});

describe("Mermaid (the diagram block)", () => {
    it("pins strict mode and no HTML labels in the configuration it passes", () => {
        // `strict` encodes HTML tags in the diagram text and turns click handlers off.
        // `loose` / `antiscript` / `sandbox` would be a change.
        expect(MERMAID_CONFIG.securityLevel).toBe("strict");
        expect(MERMAID_CONFIG.htmlLabels).toBe(false);
        expect(MERMAID_CONFIG.flowchart.htmlLabels).toBe(false);
        expect(MERMAID_CONFIG.startOnLoad).toBe(false);
    });

    it("is initialised with that configuration before it draws anything", async () => {
        // jsdom has no layout, so the drawing itself may fail here; the configuration is
        // applied before that and is what is asserted.
        await renderDiagramSvg("graph TD\n  A --> B").catch(() => undefined);
        const config = mermaid.mermaidAPI.getConfig();
        expect(config.securityLevel).toBe("strict");
        expect(config.flowchart?.htmlLabels).toBeFalsy();
    });
});
