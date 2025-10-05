const base_url = import.meta.env.VITE_API_BASE_URL;
export async function getPageTitle(url: string) {
    const response = await fetch(`${base_url}/getPageTitle/?url=${url}`);
    const data = await response.json();
    return data.title;
}
