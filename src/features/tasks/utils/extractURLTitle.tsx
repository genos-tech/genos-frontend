export const fetchPageTitle = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url, { mode: 'cors' });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const htmlText = await response.text();
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        const title = doc.querySelector('title')?.innerText;

        return title?.trim() || extractDomain(url);
    } catch (error) {
        console.warn('CORS or fetch error, using domain fallback:', error);
        return extractDomain(url);
    }
}

export const extractDomain = (url: string): string => {
    try {
        const { hostname } = new URL(url);
        // Optional: remove 'www.' prefix
        return hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}
