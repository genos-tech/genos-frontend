export const calculateVirtuosoHight = (
    currentWindowHeight: number,
    numEditorLines: number
): number => {
    const height: number =
        currentWindowHeight - Math.min(Math.max(numEditorLines - 8, 0), 10) * 20 - 270;
    return height;
};

export const calculateVirtuosoSubHight = (
    currentWindowHeight: number,
    paneSizePCT: number,
    numEditorLines: number
): number => {
    const height: number =
        currentWindowHeight * paneSizePCT * 0.01 -
        Math.min(Math.max(numEditorLines - 8, 0), 3) * 20 -
        270;
    return height;
};
