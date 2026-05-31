/**
 * ChannelListV3 — search + kind grouping + per-section unread tests.
 *
 * The existing V3ChatSurfaces tests cover the flat-list shape (sort
 * order, pin/unpin click, click-to-select). These tests guard the
 * session-3 parity additions:
 *   - Search filter narrows by title + latest-message preview
 *   - Channels are grouped under collapsible per-kind sections
 *   - Empty sections (no channels of that kind) are not rendered
 *   - Section unread badge reflects the per-kind sum
 *   - Collapse hides items but keeps the section header
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ChannelListV3 } from "../features/channel/components/ChannelListV3";
import { channelService } from "../services/channel/channelService";
import { ChannelKind, type Channel, type Message } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

function fakeChannel(id: string, overrides: Partial<Channel> = {}): Channel {
    return {
        id,
        kind: ChannelKind.GM,
        title: `Channel ${id}`,
        profileImageUrl: "",
        projectId: null,
        ownerId: null,
        isPrivate: false,
        latestMessage: null,
        unreadCount: 0,
        tsCreated: "2026-01-01T00:00:00Z",
        tsUpdated: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

function fakeLatest(id: string, channelId: string, bodyText: string): Message {
    return {
        id,
        channelId,
        channelKind: ChannelKind.GM,
        sender: {
            userId: "u-other",
            userName: "Other",
            userEmail: "o@x",
            avatarImgPath: null,
            isSystemUser: false,
        },
        seq: 1,
        body: [],
        bodyText,
        parentId: null,
        threadRootId: null,
        isThreadReply: false,
        replyCount: 0,
        reactions: [],
        mentions: [],
        attachments: [],
        metadata: {},
        editedAt: null,
        deletedAt: null,
        tsSent: "2026-01-01T00:00:01Z",
        tsUpdated: "2026-01-01T00:00:01Z",
    };
}

async function resetService() {
    const snap = channelService.getSnapshot();
    for (const id of Array.from(snap.channels.keys())) {
        channelService.setCurrentUserId("test-self");
        channelService.handleChannelMemberRemoved({
            channelId: id,
            channelKind: ChannelKind.GM,
            userId: "test-self",
        });
    }
    channelService.setCurrentUserId(null);
    channelService.resetIdbHealth();
    await channelService.hydrateFromIDB();
}

describe("ChannelListV3 — search filter", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("narrows the visible list to channels whose title matches the query", () => {
        channelService.handleChannelCreated(fakeChannel("c-1", { title: "Engineering" }));
        channelService.handleChannelCreated(fakeChannel("c-2", { title: "Marketing" }));
        channelService.handleChannelCreated(fakeChannel("c-3", { title: "Engineering Leads" }));

        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);

        fireEvent.change(screen.getByTestId("channel-list-v3-search"), {
            target: { value: "engineering" },
        });

        expect(screen.getByTestId("channel-list-v3-item-c-1")).toBeInTheDocument();
        expect(screen.getByTestId("channel-list-v3-item-c-3")).toBeInTheDocument();
        expect(screen.queryByTestId("channel-list-v3-item-c-2")).toBeNull();
    });

    it("matches against latestMessage.bodyText, not just title", () => {
        channelService.handleChannelCreated(
            fakeChannel("c-1", {
                title: "Engineering",
                latestMessage: fakeLatest("m-1", "c-1", "weekly review at 3"),
            })
        );
        channelService.handleChannelCreated(
            fakeChannel("c-2", {
                title: "Random",
                latestMessage: fakeLatest("m-2", "c-2", "lunch idea?"),
            })
        );

        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);

        fireEvent.change(screen.getByTestId("channel-list-v3-search"), {
            target: { value: "weekly" },
        });

        expect(screen.getByTestId("channel-list-v3-item-c-1")).toBeInTheDocument();
        expect(screen.queryByTestId("channel-list-v3-item-c-2")).toBeNull();
    });

    it("is case-insensitive", () => {
        channelService.handleChannelCreated(fakeChannel("c-1", { title: "ProductHunt" }));
        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);
        fireEvent.change(screen.getByTestId("channel-list-v3-search"), {
            target: { value: "PRODUCT" },
        });
        expect(screen.getByTestId("channel-list-v3-item-c-1")).toBeInTheDocument();
    });

    it("shows a 'No channels match' message when the query rules everything out", () => {
        channelService.handleChannelCreated(fakeChannel("c-1", { title: "Engineering" }));
        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);
        fireEvent.change(screen.getByTestId("channel-list-v3-search"), {
            target: { value: "nothing-matches-this" },
        });
        expect(screen.getByTestId("channel-list-v3-no-results")).toBeInTheDocument();
        expect(screen.queryByTestId("channel-list-v3-item-c-1")).toBeNull();
    });

    it("clearing the search restores the full list", () => {
        channelService.handleChannelCreated(fakeChannel("c-1", { title: "Engineering" }));
        channelService.handleChannelCreated(fakeChannel("c-2", { title: "Random" }));
        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);

        fireEvent.change(screen.getByTestId("channel-list-v3-search"), {
            target: { value: "engineering" },
        });
        expect(screen.queryByTestId("channel-list-v3-item-c-2")).toBeNull();

        fireEvent.change(screen.getByTestId("channel-list-v3-search"), {
            target: { value: "" },
        });
        expect(screen.getByTestId("channel-list-v3-item-c-2")).toBeInTheDocument();
    });
});

describe("ChannelListV3 — kind grouping", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("renders one section header per kind that has at least one channel", () => {
        channelService.handleChannelCreated(
            fakeChannel("dm-1", { kind: ChannelKind.DM, title: "DM with Alice" })
        );
        channelService.handleChannelCreated(
            fakeChannel("gm-1", { kind: ChannelKind.GM, title: "Engineering" })
        );
        // No PM, no MDM.

        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);

        expect(
            screen.getByTestId(`channel-list-v3-section-header-${ChannelKind.DM}`)
        ).toBeInTheDocument();
        expect(
            screen.getByTestId(`channel-list-v3-section-header-${ChannelKind.GM}`)
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId(`channel-list-v3-section-header-${ChannelKind.PM}`)
        ).toBeNull();
        expect(
            screen.queryByTestId(`channel-list-v3-section-header-${ChannelKind.MDM}`)
        ).toBeNull();
    });

    it("groups channels under their kind's section", () => {
        channelService.handleChannelCreated(
            fakeChannel("dm-1", { kind: ChannelKind.DM, title: "DM 1" })
        );
        channelService.handleChannelCreated(
            fakeChannel("gm-1", { kind: ChannelKind.GM, title: "GM 1" })
        );
        channelService.handleChannelCreated(
            fakeChannel("gm-2", { kind: ChannelKind.GM, title: "GM 2" })
        );

        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);

        // Walk the list in DOM order: DM section header, dm-1, then
        // GM section header, gm-1 (or gm-2 depending on sort).
        const list = screen.getByTestId("channel-list-v3-list");
        const items = Array.from(list.querySelectorAll("[data-testid]"));
        const ids = items.map((el) => el.getAttribute("data-testid"));
        const dmHeaderIdx = ids.indexOf(`channel-list-v3-section-header-${ChannelKind.DM}`);
        const gmHeaderIdx = ids.indexOf(`channel-list-v3-section-header-${ChannelKind.GM}`);
        const dm1Idx = ids.indexOf("channel-list-v3-item-dm-1");
        const gm1Idx = ids.indexOf("channel-list-v3-item-gm-1");
        // DM header before DM channel before GM header before GM channels.
        expect(dmHeaderIdx).toBeLessThan(dm1Idx);
        expect(dm1Idx).toBeLessThan(gmHeaderIdx);
        expect(gmHeaderIdx).toBeLessThan(gm1Idx);
    });

    it("collapsing a section hides its items but keeps the header visible", () => {
        channelService.handleChannelCreated(
            fakeChannel("gm-1", { kind: ChannelKind.GM, title: "GM 1" })
        );
        channelService.handleChannelCreated(
            fakeChannel("gm-2", { kind: ChannelKind.GM, title: "GM 2" })
        );

        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);

        expect(screen.getByTestId("channel-list-v3-item-gm-1")).toBeInTheDocument();
        expect(screen.getByTestId("channel-list-v3-item-gm-2")).toBeInTheDocument();

        fireEvent.click(screen.getByTestId(`channel-list-v3-section-toggle-${ChannelKind.GM}`));

        expect(screen.queryByTestId("channel-list-v3-item-gm-1")).toBeNull();
        expect(screen.queryByTestId("channel-list-v3-item-gm-2")).toBeNull();
        expect(
            screen.getByTestId(`channel-list-v3-section-header-${ChannelKind.GM}`)
        ).toHaveAttribute("data-collapsed", "true");
    });

    it("collapsing one section doesn't affect the other sections", () => {
        channelService.handleChannelCreated(
            fakeChannel("dm-1", { kind: ChannelKind.DM, title: "DM 1" })
        );
        channelService.handleChannelCreated(
            fakeChannel("gm-1", { kind: ChannelKind.GM, title: "GM 1" })
        );

        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);
        fireEvent.click(screen.getByTestId(`channel-list-v3-section-toggle-${ChannelKind.GM}`));

        expect(screen.queryByTestId("channel-list-v3-item-gm-1")).toBeNull();
        // DM section unaffected.
        expect(screen.getByTestId("channel-list-v3-item-dm-1")).toBeInTheDocument();
        expect(
            screen.getByTestId(`channel-list-v3-section-header-${ChannelKind.DM}`)
        ).toHaveAttribute("data-collapsed", "false");
    });

    it("re-clicking the toggle restores the section to expanded", () => {
        channelService.handleChannelCreated(
            fakeChannel("gm-1", { kind: ChannelKind.GM, title: "GM 1" })
        );
        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);

        const toggle = screen.getByTestId(`channel-list-v3-section-toggle-${ChannelKind.GM}`);
        fireEvent.click(toggle);
        expect(screen.queryByTestId("channel-list-v3-item-gm-1")).toBeNull();
        fireEvent.click(toggle);
        expect(screen.getByTestId("channel-list-v3-item-gm-1")).toBeInTheDocument();
    });
});

describe("ChannelListV3 — per-section unread badges", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("shows the per-kind unread sum on the section header", () => {
        channelService.handleChannelCreated(
            fakeChannel("gm-1", { kind: ChannelKind.GM, unreadCount: 2 })
        );
        channelService.handleChannelCreated(
            fakeChannel("gm-2", { kind: ChannelKind.GM, unreadCount: 5 })
        );
        channelService.handleChannelCreated(
            fakeChannel("dm-1", { kind: ChannelKind.DM, unreadCount: 1 })
        );

        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);

        expect(
            screen.getByTestId(`channel-list-v3-section-unread-${ChannelKind.GM}`)
        ).toHaveTextContent("7");
        expect(
            screen.getByTestId(`channel-list-v3-section-unread-${ChannelKind.DM}`)
        ).toHaveTextContent("1");
    });

    it("omits the section badge when the kind has zero unread", () => {
        channelService.handleChannelCreated(
            fakeChannel("gm-1", { kind: ChannelKind.GM, unreadCount: 0 })
        );
        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);
        expect(
            screen.queryByTestId(`channel-list-v3-section-unread-${ChannelKind.GM}`)
        ).toBeNull();
    });

    it("total in the header is the cross-kind sum", () => {
        channelService.handleChannelCreated(
            fakeChannel("dm-1", { kind: ChannelKind.DM, unreadCount: 1 })
        );
        channelService.handleChannelCreated(
            fakeChannel("gm-1", { kind: ChannelKind.GM, unreadCount: 5 })
        );
        channelService.handleChannelCreated(
            fakeChannel("pm-1", { kind: ChannelKind.PM, unreadCount: 3 })
        );

        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);
        expect(screen.getByTestId("channel-list-v3-total-unread")).toHaveTextContent("9");
    });
});
