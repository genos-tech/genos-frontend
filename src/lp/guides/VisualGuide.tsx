import { Shot } from "../kit/Shot";
import { SHOT_ALT } from "../kit/shotAlts";
import type { Lang } from "../lpLang";
import { Flow } from "./Flow";
import { GUIDES, type GuideStep } from "./guides";
import { GUIDE_SHOTS } from "./guideShots";

/** One screenshot with its numbered dots. The dots repeat the numbered list under it. */
function PinnedShot({ name, lang, alt }: { name: string; lang: Lang; alt: string }) {
    const shot = GUIDE_SHOTS[name]?.[lang];
    if (!shot) return null;
    const base = `/lp/guide/${lang}/${name}`;
    return (
        // The picture opens full size: on a phone the dots are readable, the words in it are not.
        <a className="lp-guide__pic" href={`${base}@2x.webp`} rel="noreferrer" target="_blank">
            <span className="lp-guide__frame">
                <img
                    alt={alt}
                    decoding="async"
                    height={shot.height}
                    loading="lazy"
                    sizes="(max-width: 900px) 100vw, 800px"
                    src={`${base}.webp`}
                    srcSet={`${base}.webp ${shot.width}w, ${base}@2x.webp ${shot.width * 2}w`}
                    width={shot.width}
                />
                {shot.pins.map(([x, y], i) => (
                    <span
                        key={i}
                        className="lp-guide__pin"
                        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                        aria-hidden
                    >
                        {i + 1}
                    </span>
                ))}
            </span>
        </a>
    );
}

function Step({ step, lang }: { step: GuideStep; lang: Lang }) {
    const text = step[lang];
    return (
        <section className="lp-guide__step">
            <h2>{text.title}</h2>
            {text.line && <p className="lp-guide__line">{text.line}</p>}
            {step.shot && <PinnedShot alt={text.title} lang={lang} name={step.shot} />}
            {step.lpShot && (
                <Shot alt={SHOT_ALT[lang][step.lpShot]} lang={lang} name={step.lpShot} />
            )}
            {text.pins && (
                <ol className="lp-guide__pins">
                    {text.pins.map((pin) => (
                        <li key={pin}>{pin}</li>
                    ))}
                </ol>
            )}
            {text.flow && <Flow set={step.set} steps={text.flow} />}
        </section>
    );
}

/** The picture-first part of a docs topic (`guides.ts`). Nothing for a topic without one. */
export function VisualGuide({ topic, lang }: { topic: string; lang: Lang }) {
    const steps = GUIDES[topic];
    if (!steps) return null;
    return (
        <div className="lp-guide" lang={lang}>
            {steps.map((step) => (
                <Step key={step.en.title} lang={lang} step={step} />
            ))}
        </div>
    );
}
