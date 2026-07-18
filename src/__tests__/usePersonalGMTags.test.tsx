/**
 * Integration coverage for the personal-GM-tags store against MSW —
 * the async paths the pure `gmTagFilters` tests can't reach: the bundle
 * GET wiring, and (most importantly) optimistic-update ROLLBACK when a
 * mutation's HTTP call fails.
 */

import { act } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
    _resetPersonalGMTagsStoreForTests,
    PersonalGMTagsBootstrap,
    usePersonalGMTags,
} from "../hooks/common/usePersonalGMTags";
import { server } from "./msw/server";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

const bundle = {
    tags: [
        {
            tagId: 1,
            name: "Client A",
            color: "#ff2323",
            textColor: "white",
            isDefaultVisible: true,
            sortOrder: 0,
        },
        {
            tagId: 2,
            name: "Urgent",
            color: "#1dc200",
            textColor: "black",
            isDefaultVisible: false,
            sortOrder: 1,
        },
    ],
    assignments: { "chan-1": [1] },
    defaultVisibleTagIds: [1],
};

// A wrapper mounts the bootstrap (sets the module token + kicks the
// initial GET); the hook under test reads the shared module store.
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <>
        <PersonalGMTagsBootstrap />
        {children}
    </>
);

const renderLoaded = async () => {
    const view = renderHook(() => usePersonalGMTags(), { wrapper });
    await waitFor(() => expect(view.result.current.loaded).toBe(true));
    return view;
};

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
    server.resetHandlers();
    _resetPersonalGMTagsStoreForTests();
});
afterAll(() => server.close());

describe("usePersonalGMTags store (MSW)", () => {
    it("loads the bundle on mount", async () => {
        server.use(http.get("*/api/v3/personal-tags/", () => HttpResponse.json(bundle)));
        const { result } = await renderLoaded();

        expect(result.current.tags.map((t) => t.tagId)).toEqual([1, 2]);
        expect(result.current.assignmentsByChannelId).toEqual({ "chan-1": [1] });
        expect(result.current.defaultVisibleTagIds).toEqual([1]);
    });

    it("degrades to empty state when the GET fails", async () => {
        server.use(
            http.get("*/api/v3/personal-tags/", () => new HttpResponse(null, { status: 500 }))
        );
        const { result } = renderHook(() => usePersonalGMTags(), { wrapper });
        // loaded stays false; consumers render nothing rather than crash.
        await waitFor(() => expect(result.current.tags).toEqual([]));
        expect(result.current.loaded).toBe(false);
    });

    it("persists setChannelTags on success", async () => {
        server.use(
            http.get("*/api/v3/personal-tags/", () => HttpResponse.json(bundle)),
            http.put("*/api/v3/channels/chan-1/personal-tags/", () =>
                HttpResponse.json({ channelId: "chan-1", tagIds: [1, 2] })
            )
        );
        const { result } = await renderLoaded();

        let ok: boolean | undefined;
        await act(async () => {
            ok = await result.current.setChannelTags("chan-1", [1, 2]);
        });
        expect(ok).toBe(true);
        expect(result.current.assignmentsByChannelId["chan-1"]).toEqual([1, 2]);
    });

    it("rolls back setChannelTags on a 500", async () => {
        server.use(
            http.get("*/api/v3/personal-tags/", () => HttpResponse.json(bundle)),
            http.put(
                "*/api/v3/channels/chan-1/personal-tags/",
                () => new HttpResponse(null, { status: 500 })
            )
        );
        const { result } = await renderLoaded();

        let ok: boolean | undefined;
        await act(async () => {
            ok = await result.current.setChannelTags("chan-1", [1, 2]);
        });
        expect(ok).toBe(false);
        // Restored to the original single assignment.
        expect(result.current.assignmentsByChannelId["chan-1"]).toEqual([1]);
    });

    it("rolls back deleteTag on a 500, restoring the tag and its assignments", async () => {
        server.use(
            http.get("*/api/v3/personal-tags/", () => HttpResponse.json(bundle)),
            http.delete("*/api/v3/personal-tags/1/", () => new HttpResponse(null, { status: 500 }))
        );
        const { result } = await renderLoaded();

        let ok: boolean | undefined;
        await act(async () => {
            ok = await result.current.deleteTag(1);
        });
        expect(ok).toBe(false);
        expect(result.current.tags.map((t) => t.tagId)).toEqual([1, 2]);
        expect(result.current.assignmentsByChannelId["chan-1"]).toEqual([1]);
    });

    it("appends a created tag from the server response", async () => {
        server.use(
            http.get("*/api/v3/personal-tags/", () => HttpResponse.json(bundle)),
            http.post("*/api/v3/personal-tags/", () =>
                HttpResponse.json(
                    {
                        tagId: 3,
                        name: "New",
                        color: "#0044c2",
                        textColor: "white",
                        isDefaultVisible: false,
                        sortOrder: 0,
                    },
                    { status: 201 }
                )
            )
        );
        const { result } = await renderLoaded();

        await act(async () => {
            await result.current.createTag({ name: "New", color: "#0044c2", textColor: "white" });
        });
        expect(result.current.tags.map((t) => t.tagId)).toEqual([1, 2, 3]);
    });
});
