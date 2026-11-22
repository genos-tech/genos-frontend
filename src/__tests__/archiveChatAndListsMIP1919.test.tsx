// MIP-1919: a project's chat follows its project, not the channel-list diff.
// MIP-1921: the Archived section lists joined projects only; the count labels come from
// `{count}` catalog strings; an archived group offers no "Archive instead"; hidden archived
// chats add nothing to the unread badge.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { archivedJoinedProjects } from "../features/archive/archiveApi";
import { ArchivedBanner } from "../features/archive/ArchivedBanner";
import {
    getArchiveSnapshot,
    isChatArchived,
    markProjectArchived,
    setArchivedChannelIds,
    setArchivedProjects,
} from "../features/archive/archiveState";
import { fmt, I18nProvider } from "../i18n";
import { en } from "../i18n/locales/en";
import { channelService } from "../services/channel/channelService";

const get = vi.fn();
vi.mock("axios", () => ({
    default: {
        create: () => ({ get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
        isAxiosError: () => false,
    },
}));
vi.mock("../db", () => ({
    initDB: vi.fn(async () => {
        throw new Error("no idb in this test");
    }),
    STORES: new Proxy({}, { get: (_t, k) => String(k) }),
}));
vi.mock("../features/tasks/services/loadTeamProjects", () => ({ loadTeamProjects: vi.fn() }));

const channel = (id: string, projectId: number | null, archived = false) => ({
    id,
    archived,
    kind: 2,
    title: id,
    profileImageUrl: "",
    projectId,
    ownerId: "u",
    isPrivate: false,
    legacyChatId: null,
    latestMessage: null,
    unreadCount: 0,
    tsCreated: "2026-01-01T00:00:00Z",
    tsUpdated: "2026-01-01T00:00:00Z",
});
const proj = (projectId: number, isJoined: boolean) =>
    ({ projectId, projectName: `P${projectId}`, isJoined }) as never;

beforeEach(() => {
    get.mockReset();
    setArchivedProjects([]);
    setArchivedChannelIds([]);
    channelService.setAccessToken("tok");
    channelService.setCurrentUserId("u");
    channelService.setCurrentTeamId(null);
});

describe("a project's chat after the project is restored (MIP-1919)", () => {
    it("is not pinned in the archived chat ids by a channel-list load", async () => {
        get.mockImplementation(async (_url: string, cfg: { params: Record<string, string> }) => ({
            data: {
                channels: cfg.params.include_archived
                    ? [channel("pm1", 7, true), channel("g1", null, true), channel("live", null)]
                    : [channel("live", null)],
            },
        }));
        await channelService.listChannels();
        expect(getArchiveSnapshot().archivedChannelIds.has("g1")).toBe(true);
        expect(getArchiveSnapshot().archivedChannelIds.has("pm1")).toBe(false);
        // The project is archived, then restored: its chat follows it.
        markProjectArchived({ projectId: 7 } as never, true);
        expect(isChatArchived({ chatId: "pm1", projectId: 7 })).toBe(true);
        markProjectArchived({ projectId: 7 } as never, false);
        expect(isChatArchived({ chatId: "pm1", projectId: 7 })).toBe(false);
    });
});

describe("the Archived section (MIP-1921)", () => {
    it("holds joined projects only", async () => {
        const archivedRow = (projectId: number, isJoined: boolean) =>
            ({ ...(proj(projectId, isJoined) as object), archived: true }) as never;
        const rows = [proj(1, true), archivedRow(2, true), archivedRow(3, false)];
        expect(archivedJoinedProjects(rows).map((p) => p.projectId)).toEqual([2]);
    });

    it("builds its count labels from a {count} placeholder", () => {
        expect(en.common.archive.archivedSection).toContain("{count}");
        expect(en.common.archive.showArchived).toContain("{count}");
        expect(fmt(en.common.archive.archivedSection, { count: 3 })).toBe("Archived (3)");
    });

    it("a project's chat banner says the project's chat, not the group", () => {
        render(
            <I18nProvider>
                <ArchivedBanner kind="chat" projectChat />
            </I18nProvider>
        );
        expect(screen.getByRole("status").textContent).toContain(
            en.common.archive.chatBannerProjectTitle
        );
        expect(screen.getByRole("status").textContent).not.toContain("This group");
    });
});
