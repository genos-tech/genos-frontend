import { UserProps } from "./admin";

export type GroupedReactionProps = {
    senders: UserProps[];
    emoji: string;
    count: number;
};

export type ReactionProps = {
    id: number;
    emoji: string;
    sender: UserProps;
    tsSent: string;
};
