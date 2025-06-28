export const getDomainFromUrl = (url: string): string => {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname;
    } catch (error) {
        // console.error("Invalid URL:", error);
        return url.slice(0, 30);
    }
};
