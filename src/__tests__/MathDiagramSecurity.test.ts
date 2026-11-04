/**
 * What a formula or a diagram in a SHARED note may do in someone else's browser
 * (MIP-1019). The editors render other people's TeX (KaTeX) and Mermaid source, so the
 * libraries' safe defaults are load-bearing: BlockNote's packages pass no `trust`
 * and no `securityLevel` of their own, and this pins that the defaults they fall back
 * to are the safe ones. A later upgrade that loosens either fails here.
 */
import { initializeMermaid } from "@blocknote/diagram-block";
import { latexToHTMLString } from "@blocknote/math-block";
import mermaid from "mermaid";
import { describe, expect, it } from "vitest";

describe("KaTeX (the math blocks)", () => {
    /** The rendered markup, parsed (inert in jsdom): what a browser would be handed. */
    const parse = (latex: string) => {
        const host = document.createElement("div");
        host.innerHTML = latexToHTMLString(latex).htmlString;
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
        const host = parse(latex);
        // KaTeX shows an unsupported command as visible red source text (so the string
        // "javascript:" may appear as TEXT); what matters is that nothing is active.
        expect(
            host.querySelectorAll("a, img, script, iframe, object, embed, form, link, style")
        ).toHaveLength(0);
        expect(host.querySelectorAll("[href], [src], [srcset], [xlink\\:href]")).toHaveLength(0);
        for (const el of host.querySelectorAll("*")) {
            for (const attr of Array.from(el.attributes)) {
                expect(attr.name, `${el.tagName} ${attr.name}`).not.toMatch(/^on/i);
                expect(attr.value, `${el.tagName} ${attr.name}`).not.toMatch(/javascript:/i);
            }
        }
        expect(host.querySelector(".evil, #evil, [data-k]")).toBeNull();
        expect(host.querySelector('[style*="position"]')).toBeNull();
    });

    it("renders ordinary maths", () => {
        expect(parse("E=mc^2").querySelector(".katex")).not.toBeNull();
    });
});

describe("Mermaid (the diagram block)", () => {
    it("is initialised in strict mode by the package, which sets no level of its own", () => {
        initializeMermaid();
        // Mermaid's own default; `strict` encodes HTML tags in the diagram text and
        // turns click handlers off. `loose` / `antiscript` / `sandbox` would be a change.
        expect(mermaid.mermaidAPI.getConfig().securityLevel).toBe("strict");
    });

    it("does not allow HTML labels, so a label cannot carry markup", () => {
        initializeMermaid();
        const config = mermaid.mermaidAPI.getConfig();
        expect(config.flowchart?.htmlLabels).toBeFalsy();
    });
});
