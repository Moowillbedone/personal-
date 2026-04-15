"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function NewsViewContent() {
  const searchParams = useSearchParams();
  const title = searchParams.get("title") || "";
  const titleOriginal = searchParams.get("titleOriginal") || "";
  const source = searchParams.get("source") || "";
  const time = searchParams.get("time") || "";
  const link = searchParams.get("link") || "";
  const summary = searchParams.get("summary") || "";

  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [translated, setTranslated] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    if (!link) { setLoading(false); return; }
    fetch(`/api/news-detail?url=${encodeURIComponent(link)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setParagraphs(data.paragraphs || []);
          setTranslated(data.translated || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [link]);

  const contentToShow = showOriginal ? paragraphs : translated;

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-3 flex items-center gap-3">
        <Link href="/" className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">{source}</p>
          <p className="text-[10px] text-dark-muted">{time}</p>
        </div>
      </div>

      <div className="px-5 mt-4 fade-in">
        {/* 제목 */}
        <h1 className="text-lg font-bold leading-snug mb-2">{title}</h1>
        {titleOriginal && titleOriginal !== title && (
          <p className="text-xs text-dark-muted mb-4 leading-relaxed">{titleOriginal}</p>
        )}

        {/* 소스 + 시간 */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dark-border">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-accent/20 text-accent">{source}</span>
          <span className="text-[10px] text-dark-muted">{time}</span>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] text-accent font-semibold">
              원문 보기 →
            </a>
          )}
        </div>

        {/* 요약 */}
        {summary && (
          <div className="bg-accent/10 rounded-xl p-4 mb-4">
            <p className="text-[10px] text-accent font-semibold mb-1">요약</p>
            <p className="text-sm leading-relaxed">{summary}</p>
          </div>
        )}

        {/* 원문/번역 토글 */}
        {paragraphs.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setShowOriginal(false)}
              className={`text-[10px] px-3 py-1 rounded-full font-semibold transition ${!showOriginal ? "bg-accent text-white" : "bg-dark-card text-dark-muted"}`}
            >
              한글 번역
            </button>
            <button
              onClick={() => setShowOriginal(true)}
              className={`text-[10px] px-3 py-1 rounded-full font-semibold transition ${showOriginal ? "bg-accent text-white" : "bg-dark-card text-dark-muted"}`}
            >
              영어 원문
            </button>
          </div>
        )}

        {/* 본문 */}
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-dark-muted">기사 본문 번역 중...</span>
          </div>
        ) : contentToShow.length > 0 ? (
          <div className="space-y-4">
            {contentToShow.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-gray-300">{p}</p>
            ))}
          </div>
        ) : summary ? (
          <p className="text-sm leading-relaxed text-gray-300">{summary}</p>
        ) : (
          <div className="text-center py-8">
            <p className="text-dark-muted text-sm mb-2">본문을 불러오지 못했습니다</p>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="text-accent text-sm font-semibold">
                원문에서 읽기 →
              </a>
            )}
          </div>
        )}

        {/* 하단 원문 링크 */}
        {link && (
          <div className="mt-6 pt-4 border-t border-dark-border">
            <a href={link} target="_blank" rel="noopener noreferrer"
              className="block text-center text-[11px] text-accent font-semibold py-2 bg-accent/10 rounded-xl"
            >
              {source} 원문에서 읽기 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewsViewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NewsViewContent />
    </Suspense>
  );
}
