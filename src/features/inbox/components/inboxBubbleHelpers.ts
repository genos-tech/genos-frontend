import { fmt, getMessages } from "../../../i18n";

// Export helper for generating approval notification body
export const getItemBody = (requestType: number, targetName: string) => {
    const messages = getMessages();
    const requestNameLookUp: Record<number, string> = {
        1: messages.inbox.requestTargets.team,
        2: messages.inbox.requestTargets.project,
    };

    return [
        {
            type: "paragraph",
            props: {
                textColor: "default",
                textAlignment: "left",
                backgroundColor: "default",
            },
            content: [
                {
                    text: fmt(messages.inbox.notification.approvalBody, {
                        target: requestNameLookUp[requestType],
                    }),
                    type: "text",
                    styles: {},
                },
                {
                    text: targetName,
                    type: "text",
                    styles: { bold: true, textColor: "pink" },
                },
            ],
            children: [],
        },
        {
            type: "paragraph",
            props: {
                textColor: "default",
                textAlignment: "left",
                backgroundColor: "default",
            },
            content: [],
            children: [],
        },
    ];
};
