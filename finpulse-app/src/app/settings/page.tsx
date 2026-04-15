"use client";
import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import { getAlerts, removeAlert, PriceAlert } from "@/lib/store";

interface UserProfile {
  name: string;
  email: string;
  provider: string | null;
  avatar: string;
}

const PROFILE_KEY = "finpulse_profile";

function getProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(PROFILE_KEY);
  return data ? JSON.parse(data) : null;
}

function saveProfile(profile: UserProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

export default function Settings() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  useEffect(() => {
    setAlerts(getAlerts());
    setProfile(getProfile());
  }, []);

  function handleRemoveAlert(id: string) {
    removeAlert(id);
    setAlerts(getAlerts());
  }

  function handleSocialLogin(provider: string) {
    // Demo: simulate social login
    const demoProfiles: Record<string, UserProfile> = {
      google: { name: "사용자", email: "user@gmail.com", provider: "Google", avatar: "G" },
      apple: { name: "사용자", email: "user@icloud.com", provider: "Apple", avatar: "A" },
      kakao: { name: "사용자", email: "user@kakao.com", provider: "Kakao", avatar: "K" },
    };
    const p = demoProfiles[provider];
    saveProfile(p);
    setProfile(p);
    setShowLoginSheet(false);
  }

  function handleLogout() {
    clearProfile();
    setProfile(null);
  }

  return (
    <>
      <div className="min-h-screen pb-24">
        <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-3">
          <h1 className="text-lg font-bold">마이페이지</h1>
        </div>
        <div className="px-5 mt-3 space-y-3 fade-in">
          {/* Profile / Guest */}
          {profile ? (
            <div className="bg-dark-card rounded-2xl p-4 border border-dark-border">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-r from-accent to-purple-500 flex items-center justify-center text-lg font-bold">
                  {profile.avatar}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{profile.name}</p>
                  <p className="text-xs text-dark-muted">{profile.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-indigo-400 font-medium">Free Plan</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-dark-border text-dark-muted font-medium">{profile.provider} 연동</span>
                  </div>
                </div>
              </div>
              <button onClick={handleLogout} className="w-full mt-3 py-2 rounded-xl border border-dark-border text-dark-muted text-xs hover:border-down/50 hover:text-down transition">로그아웃</button>
            </div>
          ) : (
            <div className="bg-dark-card rounded-2xl p-5 border border-dark-border">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-dark-border flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <p className="font-semibold">게스트</p>
                  <p className="text-xs text-dark-muted">로그인하여 데이터를 안전하게 보관하세요</p>
                </div>
              </div>
              <button onClick={() => setShowLoginSheet(true)} className="w-full py-3 rounded-xl bg-gradient-to-r from-accent to-purple-500 font-semibold text-sm">로그인 / 회원가입</button>
            </div>
          )}

          {/* Active Alerts */}
          {alerts.length > 0 && (
            <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
              <div className="p-4 border-b border-dark-border">
                <p className="text-sm font-semibold">활성 알림 ({alerts.length})</p>
              </div>
              {alerts.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between border-b border-dark-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{a.symbol}</p>
                    <p className="text-[10px] text-dark-muted">{a.currency}{a.targetPrice.toLocaleString()} {a.condition === "above" ? "이상" : "이하"}</p>
                  </div>
                  <button onClick={() => handleRemoveAlert(a.id)} className="text-xs text-down px-3 py-1 rounded-full border border-down/30">삭제</button>
                </div>
              ))}
            </div>
          )}

          {/* Menu */}
          <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
            {[
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, label: "알림 설정", detail: alerts.length > 0 ? `${alerts.length}개 활성` : "없음" },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>, label: "Morning Brief 시간", detail: "07:30" },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>, label: "다크모드", detail: "활성" },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>, label: "AI 요약 설정", detail: "한국어" },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, label: "개인정보 보호", detail: "" },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>, label: "앱 정보", detail: "v2.0.0" },
            ].map((item, i, arr) => (
              <div key={i} className={`p-4 flex items-center justify-between ${i < arr.length - 1 ? "border-b border-dark-border" : ""} active:bg-dark-border/50 cursor-pointer transition`}>
                <div className="flex items-center gap-3">{item.icon}<span className="text-sm">{item.label}</span></div>
                <div className="flex items-center gap-2">
                  {item.detail && <span className="text-xs text-dark-muted">{item.detail}</span>}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              </div>
            ))}
          </div>

          {/* Premium */}
          <div className="bg-gradient-to-br from-indigo-950 to-purple-950 rounded-2xl p-5 border border-accent/30">
            <div className="flex items-center gap-2 mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#6366f1" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>
              <p className="text-indigo-300 font-bold text-sm">FinPulse Premium</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">무제한 AI 뉴스 요약, 실시간 가격 알림, 포트폴리오 분석, 광고 제거 등 프리미엄 기능을 이용하세요.</p>
            <button className="w-full py-3 rounded-xl bg-accent font-semibold text-sm">월 4,900원으로 시작하기</button>
          </div>

          {/* Footer */}
          <div className="text-center py-4">
            <p className="text-[10px] text-dark-muted">FinPulse v2.0.0</p>
            <p className="text-[10px] text-dark-muted mt-1">투자에 대한 최종 결정은 본인의 판단으로 하시기 바랍니다.</p>
          </div>
        </div>
      </div>

      {/* Social Login Bottom Sheet */}
      {showLoginSheet && (
        <div className="fixed inset-0 max-w-[430px] mx-auto z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowLoginSheet(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-dark-card rounded-t-3xl p-6 border-t border-dark-border">
            <div className="w-10 h-1 rounded-full bg-dark-border mx-auto mb-5" />
            <h3 className="font-bold text-base mb-2">로그인</h3>
            <p className="text-xs text-dark-muted mb-5">간편하게 소셜 계정으로 로그인하세요</p>
            <div className="space-y-3">
              <button onClick={() => handleSocialLogin("google")} className="w-full py-3.5 rounded-xl bg-white text-gray-900 font-medium text-sm flex items-center justify-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google로 계속하기
              </button>
              <button onClick={() => handleSocialLogin("apple")} className="w-full py-3.5 rounded-xl bg-gray-900 border border-gray-700 text-white font-medium text-sm flex items-center justify-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                Apple로 계속하기
              </button>
              <button onClick={() => handleSocialLogin("kakao")} className="w-full py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-3" style={{ backgroundColor: "#FEE500", color: "#191919" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#191919"><path d="M12 3C6.48 3 2 6.58 2 10.94c0 2.74 1.74 5.14 4.38 6.54-.15.53-.95 3.4-.98 3.61 0 0-.02.17.09.24.1.06.23.01.23.01.31-.04 3.55-2.32 4.11-2.72.7.1 1.43.16 2.17.16 5.52 0 10-3.58 10-7.94S17.52 3 12 3"/></svg>
                카카오로 계속하기
              </button>
            </div>
            <p className="text-[10px] text-dark-muted text-center mt-4">계속 진행하면 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다.</p>
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}
