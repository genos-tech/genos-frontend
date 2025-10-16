import { forwardRef } from "react";
import { List } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { InboxSectionProps } from "../types/inboxTypes";
import { InboxBubble } from "./InboxBubble";

export const InboxSection = forwardRef<VirtuosoHandle, InboxSectionProps>(
    (
        {
            items,
            myself,
            setMyself,
            setCurrentChat,
            setOpeningService,
            socket,
            teamMemberProfiles,
            itemKeyPrefix,
        },
        ref
    ) => {
        return (
            <List
                className="custom-scrollbar"
                size="sm"
                sx={{
                    "--ListItem-paddingY": "0.3rem",
                    "--ListItem-paddingX": "1rem",
                    overflowY: "auto",
                    overflowX: "hidden",
                }}
            >
                <Virtuoso
                    ref={ref}
                    atBottomThreshold={128}
                    atTopThreshold={64}
                    className="custom-scrollbar"
                    initialTopMostItemIndex={0}
                    style={{ height: "100%" }}
                    totalCount={items.length}
                    itemContent={(index) => {
                        const item = items[index];
                        return (
                            <InboxBubble
                                key={`${itemKeyPrefix}-${item.itemId}`}
                                inboxItem={item}
                                myself={myself}
                                setCurrentChat={setCurrentChat}
                                setMyself={setMyself}
                                setOpeningService={setOpeningService}
                                socket={socket}
                                teamMemberProfiles={teamMemberProfiles}
                            />
                        );
                    }}
                />
            </List>
        );
    }
);

InboxSection.displayName = "InboxSection";
