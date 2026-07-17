/**
 * GIF picker: trending grid on open, selection payload, paging, the
 * unconfigured-server notice, and the (ToS-required) GIPHY attribution.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GifPicker } from "../components/ui/gif/GifPicker";
import { GifSearchPage } from "../services/gifApi";

const { searchGifs } = vi.hoisted(() => ({ searchGifs: vi.fn() }));
vi.mock("../services/gifApi", () => ({ searchGifs }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const gif = (id: string): GifSearchPage["results"][number] => ({
    id,
    title: `GIF ${id}`,
    url: `https://media.giphy.com/${id}/giphy.gif`,
    previewUrl: `https://media.giphy.com/${id}/200w.gif`,
    width: 480,
    height: 270,
});

const renderPicker = (props: Record<string, unknown> = {}) =>
    render(
        <CssVarsProvider>
            <GifPicker setShowGifPicker={vi.fn()} showGifPicker onSelect={vi.fn()} {...props} />
        </CssVarsProvider>
    );

beforeEach(() => {
    searchGifs.mockReset();
});

describe("GifPicker", () => {
    it("loads the trending grid on open and shows the GIPHY attribution", async () => {
        searchGifs.mockResolvedValue({ results: [gif("a"), gif("b")], next: "" });
        renderPicker();

        expect(await screen.findByTestId("gif-picker-item-a")).toBeInTheDocument();
        expect(screen.getByTestId("gif-picker-item-b")).toBeInTheDocument();
        // Trending = no q param on the first fetch.
        expect(searchGifs).toHaveBeenCalledWith("tok", { q: undefined });
        expect(screen.getByText("Powered by GIPHY")).toBeInTheDocument();
    });

    it("fires onSelect with the full-size URL and closes on click", async () => {
        searchGifs.mockResolvedValue({ results: [gif("a")], next: "" });
        const onSelect = vi.fn();
        const setShowGifPicker = vi.fn();
        renderPicker({ onSelect, setShowGifPicker });

        fireEvent.click(await screen.findByTestId("gif-picker-item-a"));
        expect(onSelect).toHaveBeenCalledWith({
            url: "https://media.giphy.com/a/giphy.gif",
            title: "GIF a",
        });
        expect(setShowGifPicker).toHaveBeenCalledWith(false);
    });

    it("appends the next page via Load more", async () => {
        searchGifs
            .mockResolvedValueOnce({ results: [gif("a")], next: "24" })
            .mockResolvedValueOnce({ results: [gif("b")], next: "" });
        renderPicker();

        fireEvent.click(await screen.findByText("Load more"));
        await waitFor(() => expect(screen.getByTestId("gif-picker-item-b")).toBeInTheDocument());
        // First page still present (appended, not replaced).
        expect(screen.getByTestId("gif-picker-item-a")).toBeInTheDocument();
        expect(searchGifs).toHaveBeenLastCalledWith("tok", { q: undefined, offset: "24" });
    });

    it("shows the not-configured notice on a 503-backed page", async () => {
        searchGifs.mockResolvedValue({ results: [], next: "", notConfigured: true });
        renderPicker();
        expect(await screen.findByText(/isn't configured/)).toBeInTheDocument();
    });
});
