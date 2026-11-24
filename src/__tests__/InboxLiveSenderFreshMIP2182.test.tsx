/**
 * MIP-2182: the sender on an inbox card stays fresh.
 *
 * A live (socket) card names its sender as the API reads them now, so it refreshes the avatar
 * directory (a rename or a new photo reaches the open inbox). A STORED card is as old as its last
 * incremental sync, which does not resend a row when its sender changes: it may fill a gap in the
 * directory but must never put the old name or photo back over a fresher entry.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
    forgetEveryone,
    rememberedPerson,
    rememberPeople,
} from "../components/ui/avatars/userDirectory";
import { rememberInboxSender } from "../features/inbox/components/inboxActor";
import { InboxItemAvatar } from "../features/inbox/components/InboxItemAvatar";

const OLD = { userId: "u-sam", userName: "Sam Old", avatarImgPath: "avatars/old.png" };
const NEW = { userId: "u-sam", userName: "Sam New", avatarImgPath: "avatars/new.png" };

const Icon = () => null;

const mountCard = (actor: typeof OLD) =>
    render(
        <CssVarsProvider>
            <InboxItemAvatar actor={actor} byGenos={false} Icon={Icon} tone="neutral" />
        </CssVarsProvider>
    );

afterEach(() => forgetEveryone());

describe("a live card refreshes the directory", () => {
    it("a renamed sender with a new photo replaces the remembered one", () => {
        rememberPeople([OLD]);

        rememberInboxSender({ sender: NEW });

        expect(rememberedPerson("u-sam")).toMatchObject({
            userName: "Sam New",
            avatarImgPath: "avatars/new.png",
        });
    });

    it("keeps the email a chat payload already taught the directory", () => {
        rememberPeople([{ ...OLD, userEmail: "sam@other.example" }]);

        rememberInboxSender({ sender: NEW });

        expect(rememberedPerson("u-sam")).toMatchObject({
            userEmail: "sam@other.example",
            avatarImgPath: "avatars/new.png",
        });
    });

    it("does nothing for a card nobody sent", () => {
        rememberInboxSender({ sender: null });
        rememberInboxSender({});

        expect(rememberedPerson("u-sam")).toBeUndefined();
    });
});

describe("a stored (possibly stale) card", () => {
    it("fills the directory when it holds nobody yet", () => {
        mountCard(OLD);

        expect(rememberedPerson("u-sam")).toMatchObject({ avatarImgPath: "avatars/old.png" });
    });

    it("does not put the old name and photo back over a fresher entry", () => {
        rememberPeople([NEW]);

        mountCard(OLD);

        expect(rememberedPerson("u-sam")).toMatchObject({
            userName: "Sam New",
            avatarImgPath: "avatars/new.png",
        });
    });

    it("the card after a live push does not undo it", () => {
        mountCard(OLD);
        rememberInboxSender({ sender: NEW });

        mountCard(OLD);

        expect(rememberedPerson("u-sam")?.avatarImgPath).toBe("avatars/new.png");
    });
});
