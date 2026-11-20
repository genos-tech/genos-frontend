import type { CSSProperties } from "react";

import type { Lang } from "../lpLang";
import { shotRect, type ShotName } from "./shots";

/**
 * Other pictures of the same scene, picked by the visitor's window and theme: a dark one (the page's
 * light/dark toggle, `.lp-root[data-mode]`, shows it by CSS), and a narrow one for a phone (a `<source>`
 * under 640 px, cut so the small marks in the picture stay readable).
 */
export type ShotVariants = {
    dark?: ShotName;
    narrow?: ShotName;
    narrowDark?: ShotName;
};

/** The width at which the narrow picture replaces the wide one. Keep in step with lp.css. */
const NARROW = "(max-width: 640px)";

function ShotPicture({
    name,
    narrow,
    lang,
    alt,
    eager,
    phone,
    className,
}: {
    name: ShotName;
    narrow?: ShotName;
    lang: Lang;
    alt: string;
    eager: boolean;
    phone: boolean;
    className?: string;
}) {
    const shot = shotRect(name, lang);
    const base = `/lp/shots/${lang}/${name}`;
    const narrowShot = narrow ? shotRect(narrow, lang) : null;
    const narrowBase = narrow ? `/lp/shots/${lang}/${narrow}` : "";
    const img = (
        <img
            alt={alt}
            data-narrow={narrow ? "" : undefined}
            decoding="async"
            fetchPriority={eager ? "high" : "auto"}
            height={shot.height}
            loading={eager ? "eager" : "lazy"}
            sizes={phone ? "320px" : "(max-width: 1240px) 100vw, 1200px"}
            src={`${base}.webp`}
            srcSet={`${base}.webp ${shot.width}w, ${base}@2x.webp ${shot.width * 2}w`}
            style={
                narrowShot
                    ? ({
                          "--lp-narrow-ratio": `${narrowShot.width} / ${narrowShot.height}`,
                      } as CSSProperties)
                    : undefined
            }
            width={shot.width}
        />
    );
    if (!narrowShot) return className ? <span className={className}>{img}</span> : img;
    return (
        <picture className={className}>
            <source
                media={NARROW}
                sizes="100vw"
                srcSet={`${narrowBase}.webp ${narrowShot.width}w, ${narrowBase}@2x.webp ${narrowShot.width * 2}w`}
            />
            {img}
        </picture>
    );
}

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
    variants,
}: {
    name: ShotName;
    lang: Lang;
    alt: string;
    /** Above the fold: load first instead of lazily. */
    priority?: boolean;
    phone?: boolean;
    caption?: string;
    variants?: ShotVariants;
}) {
    return (
        <figure className="lp-shot-wrap" style={{ margin: 0 }}>
            <div
                className={[
                    "lp-shot",
                    phone && "lp-shot--phone",
                    variants?.dark && "lp-shot--has-dark",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <ShotPicture
                    alt={alt}
                    className={variants?.dark ? "lp-shot__light" : undefined}
                    eager={priority}
                    lang={lang}
                    name={name}
                    narrow={variants?.narrow}
                    phone={phone}
                />
                {variants?.dark && (
                    // The dark picture is only fetched in dark mode: it is lazy, and hidden (so not
                    // loaded) until `.lp-root[data-mode="dark"]` shows it.
                    <ShotPicture
                        alt={alt}
                        className="lp-shot__dark"
                        eager={false}
                        lang={lang}
                        name={variants.dark}
                        narrow={variants.narrowDark ?? variants.narrow}
                        phone={phone}
                    />
                )}
            </div>
            {caption && <figcaption className="lp-caption">{caption}</figcaption>}
        </figure>
    );
}
