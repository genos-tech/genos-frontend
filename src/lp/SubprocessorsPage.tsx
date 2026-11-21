import { Link } from "react-router-dom";

import { LpShell } from "./kit/LpShell";
import { PROCESSORS } from "./privacyProcessors";
import { SUBPROCESSORS_META } from "./seo/pageMeta";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * `/subprocessors` — the public list of the third parties that process
 * user data for Genos (MIP-1251). The rows are the same `PROCESSORS` table
 * the privacy page renders (privacyProcessors.ts), so the two cannot drift.
 * Region is "not stated" for every row: no region has been verified for
 * any of them, so none is claimed here.
 */

const ProcessorTable = ({ lang }: { lang: "ja" | "en" }) => {
    const ja = lang === "ja";
    return (
        <div className="lp-table-scroll">
            <table>
                <thead>
                    <tr>
                        <th scope="col">{ja ? "事業者" : "Processor"}</th>
                        <th scope="col">{ja ? "送信される情報" : "What it receives"}</th>
                        <th scope="col">{ja ? "地域" : "Region"}</th>
                    </tr>
                </thead>
                <tbody>
                    {PROCESSORS.map((p) => (
                        <tr key={p.name}>
                            <th scope="row">{p.name}</th>
                            <td>{ja ? p.ja : p.en}</td>
                            <td>{ja ? "未記載" : "not stated"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default function SubprocessorsPage() {
    useDocumentMeta(SUBPROCESSORS_META);
    return (
        <LpShell active={null}>
            {() => (
                <>
                    <header className="lp-pagehead">
                        <div className="lp-container lp-container--narrow lp-stack-s">
                            <h1 className="lp-title" lang="ja">
                                サブプロセッサー一覧
                            </h1>
                            <p className="lp-body" lang="en">
                                Subprocessors — the Japanese text is operative; an English summary
                                follows.
                            </p>
                        </div>
                    </header>

                    <div className="lp-container lp-container--narrow lp-pagebody">
                        <article className="lp-prose">
                            <section className="lp-pagesection" lang="ja">
                                <h2>1. 処理を委託している事業者</h2>
                                <p>
                                    お客様のデータを、サービスの提供に必要な範囲で処理している事業者の一覧です。各事業者に送信される情報は、プライバシーポリシーの第
                                    3 項と同じ内容です。
                                </p>
                                <ProcessorTable lang="ja" />
                                <p>
                                    地域（データを保存・処理する国や地域）は、いずれの事業者についても現時点では記載していません。
                                </p>
                                <p>
                                    事業者を追加・削除する場合は、本ページとプライバシーポリシーを更新します。
                                    詳しくは<Link to="/privacy">プライバシーポリシー</Link>、
                                    <Link to="/cookies">Cookie と分析</Link>
                                    をご覧ください。
                                </p>
                            </section>

                            <section className="lp-pagesection" lang="en">
                                <h2>Subprocessors (English summary)</h2>
                                <p>
                                    The third parties that process user data to run the service,
                                    and what each receives (the same table as the privacy policy).
                                    Region is not stated for any of them.
                                </p>
                                <ProcessorTable lang="en" />
                                <p>
                                    We will update this list and the privacy policy when a
                                    processor is added or removed. See the{" "}
                                    <Link to="/privacy">Privacy Policy</Link> and{" "}
                                    <Link to="/cookies">Cookies &amp; analytics</Link>.
                                </p>
                            </section>
                        </article>
                    </div>
                </>
            )}
        </LpShell>
    );
}
