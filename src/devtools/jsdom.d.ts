// `jsdom` ships no types and this is the only place the app's sources use it (the
// BlockNote compatibility check's command line, which needs a DOM under Node).
// Just the part that is used.
declare module "jsdom" {
    export class JSDOM {
        constructor(html?: string, options?: { url?: string; pretendToBeVisual?: boolean });
        readonly window: Window & typeof globalThis;
    }
}
