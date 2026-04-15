"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "홈", icon: (a: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "#6366f1" : "#6b7280"} strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { href: "/calendar", label: "일정", icon: (a: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "#6366f1" : "#6b7280"} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg> },
  { href: "/quant", label: "퀀트", isCenter: true, icon: (a: boolean) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={a ? "#fff" : "#6b7280"} strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/><path d="M2 12l4-4 4 4 4-8 4 4 4-4"/></svg> },
  { href: "/community", label: "커뮤니티", icon: (a: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "#6366f1" : "#6b7280"} strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { href: "/settings", label: "설정", icon: (a: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "#6366f1" : "#6b7280"} strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 max-w-[430px] mx-auto w-full bg-dark-card/90 backdrop-blur-xl border-t border-dark-border z-40">
      <div className="flex justify-around py-2 pb-7">
        {tabs.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          const isCenter = "isCenter" in t && t.isCenter;
          return (
            <Link key={t.href} href={t.href} className={`flex flex-col items-center gap-0.5 py-1 px-3 ${isCenter ? "" : active ? "text-accent" : "text-dark-muted"}`}>
              {isCenter ? (
                <div className={`w-11 h-11 -mt-5 rounded-full flex items-center justify-center shadow-lg ${active ? "bg-accent" : "bg-dark-card border border-dark-border"}`}>
                  {t.icon(active)}
                </div>
              ) : (
                t.icon(active)
              )}
              <span className={`text-[10px] ${isCenter ? (active ? "text-accent font-bold" : "text-dark-muted") : ""}`}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
