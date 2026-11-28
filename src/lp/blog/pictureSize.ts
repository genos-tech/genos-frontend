import guideShots from "../kit/guideShots.json";
import { shotRect, type ShotName } from "../kit/shots";

/**
 * The size of a screenshot a blog post shows (`/lp/guide/en/<name>.webp` or
 * `/lp/shots/en/<name>.webp`), so the page reserves its space. English only, like the blog.
 */
export const pictureSize = (src: string): { width?: number; height?: number } => {
    const found = /^\/lp\/(guide|shots)\/en\/([\w-]+)\.webp$/.exec(src);
    if (!found) return {};
    const [, kind, name] = found;
    const size =
        kind === "guide"
            ? (guideShots as Record<string, { en: { width: number; height: number } }>)[name]?.en
            : shotRect(name as ShotName, "en");
    return size ? { width: size.width, height: size.height } : {};
};
