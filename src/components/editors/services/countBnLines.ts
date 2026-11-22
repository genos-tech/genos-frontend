type BnLineNode = { children?: BnLineNode[]; content?: { text?: string }[]; type?: string };

export const countBnLines = (contents: BnLineNode[]): number => {
    let count = 0;
    for (const content of contents) {
        count += 1; // count the current content itself
        if (content.children?.length) {
            count += countBnLines(content.children); // recursive call
        }
    }
    return count;
};
