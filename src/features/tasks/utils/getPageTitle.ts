export async function getPageTitle(url: string) {
    const response = await fetch(`http://localhost:8890/api/v2/getPageTitle/?url=${url}`);
    const data = await response.json();
    return data.title;
}
