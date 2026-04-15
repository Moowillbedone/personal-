import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { fetchNews, fetchArticleContent } from "@/lib/api";

export const revalidate = 60;

export default async function NewsDetail({ params }: { params: { id: string } }) {
  const allNews = await fetchNews();
  const article = allNews.find((n) => n.id === params.id);

  if (!article) {
    return (
      <>
        <div className="min-h-screen pb-24 flex items-center justify-center">
          <div className="text-center">
            <p className="text-dark-muted text-sm">뉴스를 찾을 수 없습니다</p>
            <Link href="/" className="text-accent text-sm mt-3 inline-block">홈으로 돌아가기</Link>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  // 원문 기사 본문 추출 시도
  let paragraphs: string[] = [];
  if (article.link) {
    paragraphs = await fetchArticleContent(article.link);
  }

  const categoryLabel = article.category === "stock" ? "주식" : article.category === "coin" ? "코인" : "경제";
  const categoryColors = article.isBreaking
    ? "bg-amber-500/20 text-amber-400"
    : article.category === "coin"
    ? "bg-orange-500/20 text-orange-400"
    : article.category === "macro"
    ? "bg-cyan-500/20 text-cyan-400"
    : "bg-accent/20 text-indigo-400";

  const categoryIcon = article.category === "stock"
    ? "📈" : article.category === "coin" ? "₿" : "🌍";

  const hasContent = paragraphs.length > 0;

  return (
    <>
      <div className="min-h-screen pb-24">
        {/* Header */}
        <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-3 flex items-center gap-3">
          <Link href="/" className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${categoryColors}`}>
                {article.isBreaking ? "속보" : categoryLabel}
              </span>
              <span className="text-[10px] text-dark-muted truncate">{article.source} · {article.time}</span>
            </div>
          </div>
        </div>

        <div className="px-5 mt-4 fade-in">
          {/* Title */}
          <h1 className="text-lg font-bold leading-snug mb-4">{article.title}</h1>

          {/* Meta Info */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="3"><circle cx="12" cy="12" r="10"/></svg>
              </div>
              <span className="text-[11px] text-dark-muted">{article.source}</span>
            </div>
            <span className="text-[11px] text-dark-muted">{categoryLabel}</span>
            <span className="text-[11px] text-dark-muted">{article.time}</span>
          </div>

          {/* Article Content — 원문 추출 성공 */}
          {hasContent ? (
            <div className="bg-dark-card rounded-2xl border border-dark-border p-5 mb-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                기사 본문
              </h3>
              <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
                {paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          ) : (
            /* Article Preview Card — 깔끔한 프리뷰 디자인 */
            <div className="space-y-4 mb-4">
              {/* Category Hero Card */}
              <div className={`rounded-2xl p-6 border border-dark-border ${
                article.category === "stock" ? "bg-gradient-to-br from-indigo-950/80 to-indigo-900/40" :
                article.category === "coin" ? "bg-gradient-to-br from-orange-950/80 to-orange-900/40" :
                "bg-gradient-to-br from-cyan-950/80 to-cyan-900/40"
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                    article.category === "stock" ? "bg-indigo-500/20" :
                    article.category === "coin" ? "bg-orange-500/20" :
                    "bg-cyan-500/20"
                  }`}>
                    {categoryIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold mb-1 ${
                      article.category === "stock" ? "text-indigo-400" :
                      article.category === "coin" ? "text-orange-400" :
                      "text-cyan-400"
                    }`}>
                      {article.isBreaking ? "🔴 속보" : categoryLabel.toUpperCase() + " NEWS"}
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {article.source}에서 제공하는 {categoryLabel} 뉴스입니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Article Summary Card */}
              <div className="bg-dark-card rounded-2xl border border-dark-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <h3 className="text-sm font-semibold">기사 정보</h3>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-dark-muted w-12 flex-shrink-0">출처</span>
                    <span className="text-sm text-gray-300">{article.source}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-dark-muted w-12 flex-shrink-0">카테고리</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${categoryColors}`}>
                      {categoryLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-dark-muted w-12 flex-shrink-0">시간</span>
                    <span className="text-sm text-gray-300">{article.time}</span>
                  </div>
                </div>
              </div>

              {/* Read Original CTA */}
              {article.link && (
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-gradient-to-r from-accent/90 to-indigo-500/90 rounded-2xl p-5 text-center active:scale-[0.98] transition"
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    <span className="text-sm font-bold text-white">전체 기사 읽기</span>
                  </div>
                  <p className="text-[11px] text-white/70">{article.source}에서 원문 확인</p>
                </a>
              )}
            </div>
          )}

          {/* Original Link (only shown when article content is extracted) */}
          {hasContent && article.link && (
            <div className="text-center mb-4">
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dark-card border border-dark-border text-sm font-medium text-gray-300 hover:bg-dark-border/50 transition active:scale-95"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                원문 보기
              </a>
            </div>
          )}

          {/* Source info */}
          <div className="text-center py-4">
            <p className="text-[10px] text-dark-muted">출처: {article.source}</p>
            <p className="text-[10px] text-dark-muted mt-1">실시간 뉴스 피드에서 수집된 기사입니다. 투자 판단의 참고자료로만 활용하세요.</p>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
