/**
 * A task link whose URL is not a web link is never a live `href` (MIP-821).
 *
 * `DynamicURLManager` rendered `<a href={link.url}>`, its form checked `new URL(x)`
 * (which parses `javascript:alert(1)`), and the server stored anything. A
 * `javascript:` href runs in the app's origin when a teammate clicks it. The form
 * now refuses a non-web URL, and the renderer refuses to make one a link, which
 * is what covers a row stored before either check existed.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DynamicURLManager } from "../features/tasks/components/contents/base/sub/DynamicURLManager";
import type { TaskProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({ useOptionalAccessToken: () => "tok" }));
vi.mock("../features/tasks/utils/getPageTitle", () => ({
    getPageTitle: vi.fn(async () => "Fetched title"),
}));

type Link = { id: string; url: string; title: string };

const task = (links: Link[]) => ({ id: 1, links }) as unknown as TaskProps;

const renderManager = (links: Link[]) => {
    const setTaskContent = vi.fn();
    const setTaskUpdated = vi.fn();
    render(
        <CssVarsProvider>
            <DynamicURLManager
                setTaskContent={setTaskContent}
                setTaskUpdated={setTaskUpdated}
                taskContent={task(links)}
            />
        </CssVarsProvider>
    );
    return { setTaskContent, setTaskUpdated };
};

const addLink = async (url: string, title = "Doc") => {
    await userEvent.click(screen.getByText("Add Link"));
    await userEvent.type(screen.getByPlaceholderText("Paste URL"), url);
    await userEvent.type(screen.getByPlaceholderText("Title (optional)"), title);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
};

describe("a stored link is rendered", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("as a real link when it is a web URL", async () => {
        renderManager([{ id: "a", url: "https://example.com/doc", title: "Design doc" }]);

        const anchor = await screen.findByRole("link", { name: "Design doc" });

        expect(anchor).toHaveAttribute("href", "https://example.com/doc");
        expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
        expect(anchor).toHaveAttribute("target", "_blank");
    });

    it("as plain text, never an anchor, when a stored URL is a javascript: URL", async () => {
        renderManager([
            { id: "a", url: "javascript:alert(document.cookie)", title: "Design doc" },
        ]);

        const label = await screen.findByText("Design doc");

        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        expect(label.closest("a")).toBeNull();
        expect(document.querySelector('a[href^="javascript"]')).toBeNull();
    });

    it("as plain text for every disguised form of it", async () => {
        const forms = [
            "JaVaScRiPt:alert(1)",
            " javascript:alert(1)",
            "java\tscript:alert(1)",
            "\n\r\t javascript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "vbscript:msgbox(1)",
        ];
        for (const url of forms) {
            document.body.innerHTML = "";
            renderManager([{ id: "a", url, title: "Click me" }]);
            await screen.findByText("Click me");
            expect(screen.queryByRole("link"), JSON.stringify(url)).not.toBeInTheDocument();
        }
    });

    it("with the refused URL on hover, so the person can see why it is not a link", async () => {
        renderManager([{ id: "a", url: "javascript:alert(1)", title: "Design doc" }]);

        const label = await screen.findByText("Design doc");

        expect(label).toHaveAttribute("title", "javascript:alert(1)");
    });

    it("keeping the good links around a bad one live", async () => {
        renderManager([
            { id: "a", url: "https://one.example.com", title: "One" },
            { id: "b", url: "javascript:alert(1)", title: "Two" },
            { id: "c", url: "http://three.example.com", title: "Three" },
        ]);

        await screen.findByText("Two");

        expect(screen.getByRole("link", { name: "One" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Three" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Two" })).not.toBeInTheDocument();
    });
});

describe("the add form", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("saves a web link", async () => {
        const { setTaskContent } = renderManager([]);

        await addLink("https://example.com/doc");

        await waitFor(() => expect(setTaskContent).toHaveBeenCalledTimes(1));
        const saved = setTaskContent.mock.calls[0][0].links;
        expect(saved).toHaveLength(1);
        expect(saved[0].url).toBe("https://example.com/doc");
    });

    it("refuses a javascript: URL, says why, and saves nothing", async () => {
        const { setTaskContent, setTaskUpdated } = renderManager([]);

        await addLink("javascript:alert(1)");

        expect(await screen.findByText("Please enter a valid URL.")).toBeInTheDocument();
        expect(setTaskContent).not.toHaveBeenCalled();
        expect(setTaskUpdated).not.toHaveBeenCalled();
    });

    it("refuses the other script-capable schemes", async () => {
        for (const url of [
            "data:text/html,<b>x</b>",
            "vbscript:msgbox(1)",
            "file:///etc/passwd",
        ]) {
            document.body.innerHTML = "";
            const { setTaskContent } = renderManager([]);
            await addLink(url);
            await screen.findByText("Please enter a valid URL.");
            expect(setTaskContent, url).not.toHaveBeenCalled();
        }
    });

    it("refuses text that is not a URL at all", async () => {
        const { setTaskContent } = renderManager([]);

        await addLink("not a url");

        expect(await screen.findByText("Please enter a valid URL.")).toBeInTheDocument();
        expect(setTaskContent).not.toHaveBeenCalled();
    });
});

describe("editing a link", () => {
    it("refuses to change a good link into a javascript: one", async () => {
        const { setTaskContent } = renderManager([
            { id: "a", url: "https://example.com", title: "Design doc" },
        ]);

        await userEvent.click(await screen.findByRole("button", { name: /edit/i }));
        const input = screen.getAllByRole("textbox")[0];
        await userEvent.clear(input);
        await userEvent.type(input, "javascript:alert(1)");
        await userEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(await screen.findByText("Please enter a valid URL.")).toBeInTheDocument();
        expect(setTaskContent).not.toHaveBeenCalled();
    });
});
