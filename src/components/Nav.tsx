import { Link, useLocation } from "@tanstack/react-router";
import { Home, ScanLine, Clock, Settings } from "lucide-react";

const items: ReadonlyArray<{
  to: "/app" | "/scan" | "/history" | "/settings";
  label: string;
  icon: typeof Home;
  primary?: boolean;
}> = [
  { to: "/app", label: "홈", icon: Home },
  { to: "/scan", label: "스캔", icon: ScanLine, primary: true },
  { to: "/history", label: "기록", icon: Clock },
  { to: "/settings", label: "설정", icon: Settings },
];

function isNavItemActive(pathname: string, to: (typeof items)[number]["to"]) {
  if (to === "/app") return pathname === "/app";
  if (to === "/settings") {
    return (
      pathname.startsWith("/settings") ||
      pathname.startsWith("/preferences") ||
      pathname.startsWith("/admin")
    );
  }
  return pathname.startsWith(to);
}

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border safe-bottom md:hidden"
      style={{ height: "calc(64px + env(safe-area-inset-bottom))" }}
      aria-label="주 메뉴"
    >
      <ul className="grid h-16 grid-cols-4">
        {items.map((it) => {
          const active = isNavItemActive(pathname, it.to);
          const Icon = it.icon;
          return (
            <li key={it.to} className="flex">
              <Link
                to={it.to}
                className="flex flex-1 flex-col items-center justify-center gap-1"
                style={{
                  color: active ? "#0F766E" : "#6B7280",
                  minHeight: 44,
                }}
              >
                {it.primary ? (
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full -mt-4 shadow-card"
                    style={{
                      backgroundColor: active ? "#0F766E" : "#0F766E",
                      color: "#fff",
                    }}
                  >
                    <Icon size={22} />
                  </span>
                ) : (
                  <Icon size={22} />
                )}
                <span className="text-[11px] font-medium" style={{ lineHeight: "14px" }}>
                  {it.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();
  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 bottom-0 w-[248px] bg-surface border-r border-border flex-col"
      aria-label="사이드바"
    >
      <div className="px-6 py-5 border-b border-border">
        <Link
          to="/"
          aria-label="홈 화면으로 이동"
          className="inline-flex text-lg font-bold text-foreground hover:text-primary"
        >
          식품 스캔
        </Link>
      </div>
      <ul className="flex-1 py-4 px-3 space-y-1">
        {items.map((it) => {
          const active = isNavItemActive(pathname, it.to);
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  backgroundColor: active ? "#CCFBF1" : "transparent",
                  color: active ? "#115E59" : "#334155",
                }}
              >
                <Icon size={20} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
