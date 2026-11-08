import type { Lang } from "../lpLang";
import { SHOTS, type ShotName } from "./shots";

/**
 * A real product screenshot from the demo workspace, in the visitor's language.
 *
 * The files and their sizes come from `scripts/lp-screenshots.mjs`, which
 * signs into a fresh demo workspace (never real or test data), stages each
 * scene and writes `public/lp/shots/<lang>/<name>.webp` plus a 2x copy. The
 * width and height are stamped into `shots.ts` so the browser reserves the
 * space before the image arrives (no layout shift).
 */
export function Shot({
    name,
    lang,
    alt,
    priority = false,
    phone = false,
    caption,
}: {
    name: ShotName;
    lang: Lang;
    alt: string;
    /** Above the fold: load first instead of lazily. */
    priority?: boolean;
    phone?: boolean;
    caption?: string;
}) {
    const shot = SHOTS[name];
    const base = `/lp/shots/${lang}/${name}`;
    return (
        <figure className="lp-shot-wrap" style={{ margin: 0 }}>
            <div className={phone ? "lp-shot lp-shot--phone" : "lp-shot"}>
                <img
                    alt={alt}
                    decoding="async"
                    fetchPriority={priority ? "high" : "auto"}
                    height={shot.height}
                    loading={priority ? "eager" : "lazy"}
                    sizes={phone ? "320px" : "(max-width: 1240px) 100vw, 1200px"}
                    src={`${base}.webp`}
                    srcSet={`${base}.webp ${shot.width}w, ${base}@2x.webp ${shot.width * 2}w`}
                    width={shot.width}
                />
            </div>
            {caption && <figcaption className="lp-caption">{caption}</figcaption>}
        </figure>
    );
}
