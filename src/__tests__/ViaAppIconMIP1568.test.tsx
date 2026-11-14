/**
 * MIP-1568: a change made through the official Claude or ChatGPT app shows that app's
 * small round mark instead of the generic "via MCP" chip.
 *
 * Pinned here: only the two exact family strings are believed (spoofs and lookalikes
 * fall back to the generic chip), the fallback is unchanged for a missing `app`, an API
 * key and an old server, the words stay available to a screen reader, and the NAME of
 * the member's key or app is never reachable through the new path by anyone but the owner.
 */
import type { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ViaAppIcon } from "../components/ui/misc/ViaAppIcon";
import { ViaChip } from "../components/ui/misc/ViaChip";
import {
    viaSourceFromVia,
    viaSourceOfComment,
    viaSourceOfRow,
} from "../features/tasks/utils/viaSource";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import type { TaskActivityProps } from "../types/tasks";

afterEach(cleanup);

const wrap = (node: ReactNode) => <CssVarsProvider>{node}</CssVarsProvider>;

/** What the API sends every viewer for a connected app it recognises. */
const CLAUDE = { kind: "oauth", app: "claude" };
const CHATGPT = { kind: "oauth", app: "chatgpt" };
/** What the owner (and only the owner) is also handed. */
const CLAUDE_OWN = {
    ...CLAUDE,
    connection_id: "conn-9f3a-x",
    client_name: "Ken's private app name",
};

describe("viaSource: the app family", () => {
    it("believes exactly claude and chatgpt, for a connected app", () => {
        expect(viaSourceFromVia(CLAUDE, false)).toEqual({
            kind: "mcp",
            name: null,
            app: "claude",
        });
        expect(viaSourceFromVia(CHATGPT, false)).toEqual({
            kind: "mcp",
            name: null,
            app: "chatgpt",
        });
    });

    it("missing app, or an older server, is today's generic chip", () => {
        expect(viaSourceFromVia({ kind: "oauth" }, false)?.app).toBeNull();
        expect(viaSourceFromVia({ kind: "oauth", app: null }, false)?.app).toBeNull();
        expect(viaSourceFromVia({ kind: "oauth", app: undefined }, true)?.app).toBeNull();
    });

    it("anything but the two exact strings is null: spoofs, case, padding, other types", () => {
        for (const app of [
            "Claude",
            "CLAUDE",
            "Claude ",
            " claude",
            "claude\n",
            "claude-evil",
            "claude evil",
            "claudee",
            "chatgpt ",
            "ChatGPT",
            "gpt",
            "openai",
            "anthropic",
            "",
            0,
            1,
            true,
            ["claude"],
            { toString: () => "claude" },
            {},
        ]) {
            expect(
                viaSourceFromVia({ kind: "oauth", app }, true)?.app,
                JSON.stringify(app)
            ).toBeNull();
            expect(
                viaSourceFromVia({ kind: "oauth", app }, false)?.app,
                JSON.stringify(app)
            ).toBeNull();
        }
    });

    it("an API key never earns an app mark, even if the payload names a family", () => {
        expect(viaSourceFromVia({ kind: "api_key", app: "claude" }, true)).toEqual({
            kind: "apiKey",
            name: null,
            app: null,
        });
        expect(viaSourceFromVia({ kind: "app", app: "claude" }, true)).toBeNull();
        expect(viaSourceFromVia({ kind: "agent", app: "claude" }, true)).toBeNull();
    });

    it("the family comes through the comment path and the history-row path alike", () => {
        expect(viaSourceOfComment({ via: CLAUDE })?.app).toBe("claude");
        const row = {
            metadata: { via: CHATGPT },
            actor: { userId: "u1", userName: "Ken", avatarImgPath: null },
        } as Pick<TaskActivityProps, "metadata" | "actor">;
        expect(viaSourceOfRow(row, "u2")?.app).toBe("chatgpt");
        expect(viaSourceOfRow(row, "u1")?.app).toBe("chatgpt");
    });
});

describe("ViaAppIcon", () => {
    it("renders nothing without a known app", () => {
        const { container } = render(
            wrap(
                <>
                    <ViaAppIcon app={null} />
                    <ViaAppIcon app={undefined} />
                    <ViaAppIcon app={"claude-evil" as never} />
                </>
            )
        );
        expect(container.querySelector("[data-via-app]")).toBeNull();
        expect(container.querySelector("img")).toBeNull();
    });

    it("is a labelled round image: via Claude, via ChatGPT", () => {
        render(
            wrap(
                <>
                    <ViaAppIcon app="claude" />
                    <ViaAppIcon app="chatgpt" size={20} />
                </>
            )
        );
        expect(screen.getByRole("img", { name: "via Claude" })).toHaveAttribute(
            "data-via-app",
            "claude"
        );
        const gpt = screen.getByRole("img", { name: "via ChatGPT" });
        const art = gpt.querySelector("img");
        expect(art).toHaveAttribute("width", "20");
        expect(art).toHaveAttribute("alt", "");
        // Local artwork only (a bundled file or its data URI), nothing fetched from a vendor.
        expect(art?.getAttribute("src")).not.toMatch(/^https?:/);
    });

    it("the label can be overridden by a surface", () => {
        render(wrap(<ViaAppIcon app="claude" label="Made by Claude" />));
        expect(screen.getByRole("img", { name: "Made by Claude" })).toBeInTheDocument();
    });
});

describe("ViaChip with and without an app", () => {
    it("a connected app with a family shows the mark, not the words 'via MCP'", () => {
        render(wrap(<ViaChip source={{ kind: "mcp", name: null, app: "claude" }} />));
        expect(screen.getByRole("img", { name: "via Claude" })).toBeInTheDocument();
        expect(screen.queryByText("via MCP")).toBeNull();
    });

    it("the words stay for a screen reader (accessible name) and a hover (tooltip)", () => {
        render(wrap(<ViaChip source={{ kind: "mcp", name: null, app: "chatgpt" }} />));
        const icon = screen.getByRole("img", { name: "via ChatGPT" });
        fireEvent.mouseOver(icon);
        return screen
            .findByText("Made through ChatGPT, a connected AI app, not typed in Genos")
            .then((tip) => expect(tip).toBeInTheDocument());
    });

    it("no app (null), or an API key: today's generic chip, unchanged", () => {
        const { container } = render(
            wrap(
                <>
                    <ViaChip source={{ kind: "mcp", name: null, app: null }} />
                    <ViaChip source={{ kind: "apiKey", name: null, app: null }} />
                </>
            )
        );
        expect(screen.getByText("via MCP")).toBeInTheDocument();
        expect(screen.getByText("via API key")).toBeInTheDocument();
        expect(container.querySelector("[data-via-app]")).toBeNull();
        expect(container.querySelectorAll("[data-via]")).toHaveLength(2);
    });

    it("an API key row keeps its chip even if a source were built with an app", () => {
        render(wrap(<ViaChip source={{ kind: "apiKey", name: null, app: "claude" }} />));
        expect(screen.getByText("via API key")).toBeInTheDocument();
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("the owner's tooltip names their own app; the mark itself never carries the name", () => {
        const source = viaSourceFromVia(CLAUDE_OWN, true)!;
        expect(source.name).toBe("Ken's private app name");
        const { container } = render(wrap(<ViaChip source={source} />));
        // Nothing visible or announced carries it until the owner hovers.
        expect(container.textContent).not.toContain("private app name");
        const icon = screen.getByRole("img", { name: "via Claude" });
        expect(icon.getAttribute("aria-label")).not.toContain("private");
        fireEvent.mouseOver(icon);
        return screen
            .findByText(/your connected app “Ken's private app name”/)
            .then((tip) => expect(tip).toBeInTheDocument());
    });
});

describe("privacy: who learns what through the family path", () => {
    const SECRET = "Ken's private app name";
    const everything = (container: HTMLElement) =>
        `${container.textContent ?? ""}\n${Array.from(container.querySelectorAll("*"))
            .flatMap((el) => Array.from(el.attributes).map((a) => a.value))
            .join("\n")}`;

    it("a colleague is told the family (Claude / ChatGPT) and never the name, even if the payload held it", () => {
        // Defence in depth: the server already strips the name for a colleague, and the
        // row-actor check strips it a second time here.
        const row = {
            metadata: { via: CLAUDE_OWN },
            actor: { userId: "owner", userName: "Ken", avatarImgPath: null },
        } as Pick<TaskActivityProps, "metadata" | "actor">;
        const seen = viaSourceOfRow(row, "colleague");
        expect(seen).toEqual({ kind: "mcp", name: null, app: "claude" });

        const { container } = render(wrap(<ViaChip source={seen!} />));
        const icon = screen.getByRole("img", { name: "via Claude" });
        fireEvent.mouseOver(icon);
        expect(everything(container)).not.toContain(SECRET);
        expect(everything(container)).not.toContain("conn-9f3a-x");
        return screen
            .findByText("Made through Claude, a connected AI app, not typed in Genos")
            .then(() => {
                expect(everything(document.body)).not.toContain(SECRET);
            });
    });

    it("an unknown actor is nobody: no name", () => {
        const row = {
            metadata: { via: CLAUDE_OWN },
            actor: null,
        } as unknown as Pick<TaskActivityProps, "metadata" | "actor">;
        expect(viaSourceOfRow(row, "u1")?.name).toBeNull();
    });

    it("a spoofed family from a lookalike client name does not borrow the real mark", () => {
        // A member registers an app called "Claude" (or "claude"): the server decides the
        // family, and a client name is never read for it.
        const via = { kind: "oauth", client_name: "claude", key_name: "chatgpt" };
        expect(viaSourceFromVia(via, true)?.app).toBeNull();
    });
});

describe("the strings, in all seven locales", () => {
    type Via = {
        apps?: Record<string, string>;
        viaApp?: string;
        appHint?: string;
        appHintNamed?: string;
    };
    const via = (c: unknown) =>
        (c as { tasks?: { activity?: { via?: Via } } }).tasks?.activity?.via;

    for (const [name, catalog] of Object.entries({ en, ja, zh, es, fr, hi, ar })) {
        it(`${name}: names, label and both hints, with their slots`, () => {
            const v = via(catalog);
            expect(v?.apps?.claude, name).toBe("Claude");
            expect(v?.apps?.chatgpt, name).toBe("ChatGPT");
            expect(v?.viaApp, name).toContain("{app}");
            expect(v?.appHint, name).toContain("{app}");
            expect(v?.appHint, name).not.toContain("{name}");
            expect(v?.appHintNamed, name).toContain("{app}");
            expect(v?.appHintNamed, name).toContain("{name}");
        });
    }

    it("English reads via Claude / via ChatGPT", () => {
        expect(via(en)?.viaApp).toBe("via {app}");
    });
});
