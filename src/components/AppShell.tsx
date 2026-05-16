import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BottomNav, Sidebar } from "./Nav";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  right?: ReactNode;
  back?: () => void;
  hideAppBar?: boolean;
}

export function AppShell({ children, title, right, back, hideAppBar }: AppShellProps) {
  const heading = title || "식품 스캔";

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="md:pl-[248px]">
        {!hideAppBar && (
          <header
            className="sticky top-0 z-30 h-14 bg-surface border-b border-border flex items-center px-4 gap-2"
            style={{ height: 56 }}
          >
            {back && (
              <button
                onClick={back}
                aria-label="뒤로"
                className="h-11 w-11 -ml-2 flex items-center justify-center rounded-md hover:bg-subtle"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <h1 className="text-base font-bold text-foreground flex-1 truncate">
              {heading === "식품 스캔" ? (
                <Link to="/app" aria-label="앱 홈으로 이동" className="hover:text-primary">
                  {heading}
                </Link>
              ) : (
                heading
              )}
            </h1>
            {right}
          </header>
        )}
        <main
          className="px-4 md:px-8 mx-auto"
          style={{
            maxWidth: 1120,
            paddingBottom: "calc(88px + env(safe-area-inset-bottom))",
          }}
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
