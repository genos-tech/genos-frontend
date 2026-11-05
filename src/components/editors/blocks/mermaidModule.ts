/*
 * Mermaid, as ONE module that is only ever imported with `import()` (see
 * `loadRenderers.ts`): the editors need the diagram spec as soon as one mounts, but Mermaid
 * (the largest dependency of the editor) is only needed once a diagram is drawn. Nothing
 * else may import this file (a test scans for it).
 *
 * `trimDiagramSvg` and `setSvgFontFamily` are adapted from `@blocknote/diagram-block`
 * 0.57.0 (https://github.com/TypeCellOS/BlockNote, MPL-2.0, Copyright (c) the BlockNote
 * contributors), `src/helpers`; this file is covered by MPL-2.0 as well.
 */
import mermaid, { type MermaidConfig } from "mermaid";

/**
 * Mermaid's configuration. `securityLevel: "strict"` encodes HTML in a diagram's text and
 * turns off click handlers, and HTML labels are off, so a shared note's diagram cannot
 * carry markup or script into the page. The package leaves the level to Mermaid's default
 * (which is strict); it is written out here because this code owns it now.
 * `MathDiagramSecurity.test.ts` pins the values.
 */
export const MERMAID_CONFIG = {
    securityLevel: "strict",
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    class: { htmlLabels: false },
    state: { htmlLabels: false },
    er: { htmlLabels: false },
    startOnLoad: false,
    suppressErrorRendering: true,
} as const;

let initialised = false;
const initialise = () => {
    if (initialised) return;
    initialised = true;
    // Mermaid reads `htmlLabels` for these diagrams, which its types do not list.
    mermaid.initialize({ ...MERMAID_CONFIG } as unknown as MermaidConfig);
};

/** The viewBox of a rendered diagram, cut to its content (Mermaid leaves a lot of room). */
export const trimDiagramSvg = (svg: string): string => {
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.visibility = "hidden";
    host.style.pointerEvents = "none";
    host.innerHTML = svg;
    const element = host.querySelector("svg");
    const box = element?.getAttribute("viewBox")?.split(/\s+/).map(Number);
    if (!element || box?.length !== 4 || box.some(Number.isNaN)) return svg;
    document.body.appendChild(host);
    try {
        const [x, y, width, height] = box;
        const content = element.getBBox();
        const wanted = content.y + content.height - y + 8;
        let changed = false;
        if (wanted < height) {
            element.setAttribute("viewBox", `${x} ${y} ${width} ${wanted}`);
            changed = true;
        }
        if (element.hasAttribute("height")) {
            element.removeAttribute("height");
            changed = true;
        }
        return changed ? element.outerHTML : svg;
    } finally {
        document.body.removeChild(host);
    }
};

/** The diagram in the editor's own font. */
export const setSvgFontFamily = (svg: string, fontFamily: string): string => {
    const element = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
    for (const style of element.querySelectorAll("style")) {
        style.textContent =
            style.textContent?.replace(/font-family:[^;}]*/g, () => `font-family:${fontFamily}`) ??
            null;
    }
    for (const node of element.querySelectorAll("[font-family]")) {
        node.setAttribute("font-family", fontFamily);
    }
    return new XMLSerializer().serializeToString(element);
};

let counter = 0;

/** Mermaid's SVG for a diagram's source; rejects with Mermaid's message when it is invalid. */
export const renderDiagramSvg = async (source: string, fontFamily?: string): Promise<string> => {
    initialise();
    await mermaid.parse(source);
    const { svg } = await mermaid.render(`mermaid-preview-${counter++}`, source);
    const trimmed = trimDiagramSvg(svg);
    return fontFamily ? setSvgFontFamily(trimmed, fontFamily) : trimmed;
};

export default mermaid;
