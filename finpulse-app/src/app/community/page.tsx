"use client";
import { useState, useEffect, useCallback } from "react";
import BottomNav from "@/components/BottomNav";

interface Post {
  id: string;
  author: string;
  content: string;
  category: "자유" | "종목토론" | "매매일지" | "질문";
  likes: number;
  comments: Comment[];
  createdAt: number;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: number;
}

const STORAGE_KEY = "finpulse_community";
const CATEGORIES = ["전체", "자유", "종목토론", "매매일지", "질문"] as const;

const NICKNAME_KEY = "finpulse_nickname";

function getPosts(): Post[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultPosts();
  } catch { return getDefaultPosts(); }
}

function savePosts(posts: Post[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

function getNickname(): string {
  if (typeof window === "undefined") return "익명";
  return localStorage.getItem(NICKNAME_KEY) || "";
}

function setNicknameStorage(name: string) {
  localStorage.setItem(NICKNAME_KEY, name);
}

function getDefaultPosts(): Post[] {
  const now = Date.now();
  return [
    {
      id: "d1", author: "퀀트마스터", content: "NVDA 실적 발표 앞두고 변동성 커지고 있네요. 5월 27일 실적 발표 전에 포지션 정리할 분?", category: "종목토론",
      likes: 12, comments: [
        { id: "c1", author: "AI투자러", content: "저는 홀딩합니다. 데이터센터 매출 기대되요", createdAt: now - 3600000 },
      ], createdAt: now - 7200000,
    },
    {
      id: "d2", author: "삼성덕후", content: "삼성전자 18만원대 진입했습니다. HBM 기대감으로 3분기부터 실적 반등 예상. 영업이익 회복세가 보이네요!", category: "매매일지",
      likes: 8, comments: [], createdAt: now - 14400000,
    },
    {
      id: "d3", author: "주린이", content: "PER이랑 PBR 차이가 뭔가요? 둘 다 낮으면 좋은 건가요?", category: "질문",
      likes: 3, comments: [
        { id: "c2", author: "가치투자", content: "PER은 주가/순이익, PBR은 주가/순자산입니다. 업종마다 적정 수준이 달라요!", createdAt: now - 10800000 },
      ], createdAt: now - 21600000,
    },
    {
      id: "d4", author: "매크로맨", content: "연준 금리 동결 예상이지만, 6월 CPI 결과에 따라 7월 인하 가능성도 보입니다. 채권 쪽 눈여겨볼 필요 있어요.", category: "자유",
      likes: 15, comments: [], createdAt: now - 43200000,
    },
  ];
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<string>("전체");
  const [showWrite, setShowWrite] = useState(false);
  const [nickname, setNickname] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<Post["category"]>("자유");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [showNicknameModal, setShowNicknameModal] = useState(false);

  useEffect(() => {
    setPosts(getPosts());
    const saved = getNickname();
    if (saved) setNickname(saved);
  }, []);

  const filteredPosts = filter === "전체" ? posts : posts.filter(p => p.category === filter);

  const handleSubmit = useCallback(() => {
    if (!newContent.trim()) return;
    if (!nickname.trim()) {
      setShowNicknameModal(true);
      return;
    }
    const post: Post = {
      id: `p${Date.now()}`,
      author: nickname,
      content: newContent.trim(),
      category: newCategory,
      likes: 0,
      comments: [],
      createdAt: Date.now(),
    };
    const updated = [post, ...posts];
    setPosts(updated);
    savePosts(updated);
    setNewContent("");
    setShowWrite(false);
  }, [newContent, nickname, newCategory, posts]);

  const handleLike = (postId: string) => {
    const updated = posts.map(p =>
      p.id === postId ? { ...p, likes: p.likes + 1 } : p
    );
    setPosts(updated);
    savePosts(updated);
  };

  const handleDelete = (postId: string) => {
    const updated = posts.filter(p => p.id !== postId);
    setPosts(updated);
    savePosts(updated);
  };

  const handleComment = (postId: string) => {
    if (!commentText.trim() || !nickname.trim()) {
      if (!nickname.trim()) setShowNicknameModal(true);
      return;
    }
    const comment: Comment = {
      id: `cm${Date.now()}`,
      author: nickname,
      content: commentText.trim(),
      createdAt: Date.now(),
    };
    const updated = posts.map(p =>
      p.id === postId ? { ...p, comments: [...p.comments, comment] } : p
    );
    setPosts(updated);
    savePosts(updated);
    setCommentText("");
  };

  const saveNickname = () => {
    if (nickname.trim()) {
      setNicknameStorage(nickname.trim());
      setShowNicknameModal(false);
    }
  };

  const categoryColors: Record<string, string> = {
    "자유": "bg-dark-border text-dark-muted",
    "종목토론": "bg-accent/20 text-accent",
    "매매일지": "bg-up/20 text-up",
    "질문": "bg-amber-500/20 text-amber-400",
  };

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">커뮤니티</h1>
            <p className="text-[10px] text-dark-muted">투자자들과 함께 소통하세요</p>
          </div>
          {nickname && (
            <button onClick={() => setShowNicknameModal(true)} className="text-[10px] text-accent bg-accent/10 px-2.5 py-1 rounded-full font-semibold">
              {nickname}
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition ${filter === c ? "bg-accent text-white" : "bg-dark-border/50 text-dark-muted"}`}
            >{c}</button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-4 fade-in">
        {/* Posts */}
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-dark-muted text-sm">아직 게시글이 없습니다</p>
            <p className="text-dark-muted text-[10px] mt-1">첫 번째 글을 작성해보세요!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map(post => (
              <div key={post.id} className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                        {post.author[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{post.author}</p>
                        <p className="text-[9px] text-dark-muted">{timeAgo(post.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${categoryColors[post.category]}`}>
                        {post.category}
                      </span>
                      {post.author === nickname && (
                        <button onClick={() => handleDelete(post.id)} className="text-[10px] text-dark-muted hover:text-down">
                          삭제
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-4 mt-3 pt-2 border-t border-dark-border/30">
                    <button onClick={() => handleLike(post.id)} className="flex items-center gap-1 text-[10px] text-dark-muted hover:text-accent transition">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      <span className="font-semibold">{post.likes}</span>
                    </button>
                    <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)} className="flex items-center gap-1 text-[10px] text-dark-muted hover:text-accent transition">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      <span className="font-semibold">{post.comments.length}</span>
                    </button>
                  </div>
                </div>

                {/* Comments */}
                {expandedPost === post.id && (
                  <div className="bg-dark-bg/50 px-4 py-3 border-t border-dark-border/30">
                    {post.comments.map(cm => (
                      <div key={cm.id} className="flex gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-dark-border flex items-center justify-center text-[8px] font-bold text-dark-muted shrink-0 mt-0.5">
                          {cm.author[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold">{cm.author}</span>
                            <span className="text-[9px] text-dark-muted">{timeAgo(cm.createdAt)}</span>
                          </div>
                          <p className="text-[11px] text-gray-300">{cm.content}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <input
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleComment(post.id)}
                        placeholder="댓글을 입력하세요..."
                        className="flex-1 bg-dark-card border border-dark-border rounded-lg px-3 py-1.5 text-[11px] text-white placeholder:text-dark-muted outline-none focus:border-accent"
                      />
                      <button onClick={() => handleComment(post.id)} className="px-3 py-1.5 bg-accent rounded-lg text-[10px] font-semibold text-white">
                        등록
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB - Write Button */}
      <button
        onClick={() => {
          if (!nickname) { setShowNicknameModal(true); return; }
          setShowWrite(true);
        }}
        className="fixed bottom-24 right-4 max-w-[430px] w-14 h-14 bg-accent rounded-full shadow-lg shadow-accent/30 flex items-center justify-center z-40 active:scale-95 transition"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>

      {/* Write Modal */}
      {showWrite && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-dark-card w-full max-w-[430px] rounded-t-3xl p-5 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">새 글 작성</h3>
              <button onClick={() => setShowWrite(false)} className="text-dark-muted text-sm">취소</button>
            </div>

            {/* Category Select */}
            <div className="flex gap-1.5 mb-3">
              {(["자유", "종목토론", "매매일지", "질문"] as const).map(c => (
                <button key={c} onClick={() => setNewCategory(c)}
                  className={`px-3 py-1 rounded-full text-[10px] font-semibold transition ${newCategory === c ? "bg-accent text-white" : "bg-dark-border/50 text-dark-muted"}`}
                >{c}</button>
              ))}
            </div>

            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="투자 경험이나 의견을 공유해보세요..."
              rows={5}
              className="w-full bg-dark-bg border border-dark-border rounded-xl p-3 text-sm text-white placeholder:text-dark-muted outline-none focus:border-accent resize-none"
            />

            <button onClick={handleSubmit}
              disabled={!newContent.trim()}
              className={`w-full mt-3 py-3 rounded-xl font-semibold text-sm transition ${newContent.trim() ? "bg-accent text-white" : "bg-dark-border text-dark-muted"}`}
            >
              게시하기
            </button>
          </div>
        </div>
      )}

      {/* Nickname Modal */}
      {showNicknameModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-5">
          <div className="bg-dark-card w-full max-w-[360px] rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-2">닉네임 설정</h3>
            <p className="text-[10px] text-dark-muted mb-4">커뮤니티에서 사용할 닉네임을 입력해주세요</p>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveNickname()}
              placeholder="닉네임 (2~10자)"
              maxLength={10}
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-dark-muted outline-none focus:border-accent mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowNicknameModal(false)} className="flex-1 py-2.5 rounded-xl bg-dark-border text-dark-muted text-sm font-semibold">취소</button>
              <button onClick={saveNickname} disabled={nickname.trim().length < 2}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${nickname.trim().length >= 2 ? "bg-accent text-white" : "bg-dark-border text-dark-muted"}`}
              >확인</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
