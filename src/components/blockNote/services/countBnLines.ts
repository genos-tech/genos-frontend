export const countBnLines = (contents: any[]): number => {
    let count = 0;
    for (const content of contents) {
        count += 1; // count the current content itself
        if (content.children?.length) {
            count += countBnLines(content.children); // recursive call
        }
    }
    return count;
};
