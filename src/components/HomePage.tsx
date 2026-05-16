import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Barcode,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  ScanBarcode,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { SearchInput } from "@/components/SearchInput";
import { getRecent } from "@/lib/storage";
import type { Product } from "@/lib/types";

const landingImages = {
  hero: "/home-hero.webp",
  barcode: "/landing/barcode_scan.png",
  allergy: "/landing/allergy_match.png",
  recall: "/landing/recall_alert.png",
};

const trustPartners = [
  { label: "SafeFood", icon: ShieldCheck },
  { label: "HealthGuard", icon: ShieldAlert },
  { label: "BioTest", icon: FlaskConical },
  { label: "QualiCert", icon: ClipboardCheck },
] as const;

const featureCards = [
  {
    title: "바코드 쾌속 스캔",
    description: "제품 바코드를 즉시 스캔하고 식품 정보를 빠르게 확인합니다.",
    image: landingImages.barcode,
    icon: Barcode,
  },
  {
    title: "알레르기 정밀 매칭",
    description: "개인 건강 프로필과 원재료를 대조해 주의 성분을 분명하게 표시합니다.",
    image: landingImages.allergy,
    icon: ShieldAlert,
  },
  {
    title: "실시간 회수 이력",
    description: "공공데이터 기반 회수 정보를 함께 확인해 구매 전 위험 신호를 줄입니다.",
    image: landingImages.recall,
    icon: Bell,
  },
] as const;

export function HomePage() {
  return <LandingPage />;
}

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8f9ff] text-[#0d1c2e]">
      <header className="sticky top-0 z-40 border-b border-[#bcc9c6]/50 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-4 md:px-10">
          <Link to="/" className="flex items-center gap-2" aria-label="FoodScan 홈">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-teal-900/10 border border-[#bcc9c6]/50">
              <img src="/logo.png" alt="FoodScan 로고" className="h-full w-full object-cover" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-[#00685f]">FoodScan</span>
          </Link>
          <Link
            to="/app"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-r from-[#0d9488] to-[#2dd4bf] px-5 text-sm font-bold text-white shadow-lg shadow-teal-900/10 transition-transform hover:-translate-y-0.5"
          >
            무료로 시작하기
          </Link>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 px-4 pb-20 pt-16 md:px-10 lg:grid-cols-[1fr_560px] lg:pt-24">
          <div className="landing-fade-up max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#bcc9c6]/70 bg-white px-4 py-2 text-sm font-bold text-[#00685f] shadow-sm">
              <Sparkles size={16} />
              공공데이터 기반 식품 안전 분석
            </div>
            <h1 className="text-[40px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#0d1c2e] md:text-[58px]">
              식품 안전, 이제 스마트하게 스캔하세요
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#3d4947]">
              바코드와 제품명 검색으로 영양성분, 알레르기, 회수 이력까지 확인합니다.
              FoodScan은 식탁 앞의 의사결정을 빠르고 명확하게 만듭니다.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/app"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0d9488] to-[#2dd4bf] px-7 text-base font-extrabold text-white shadow-xl shadow-teal-900/15 transition-transform hover:-translate-y-0.5"
              >
                무료 시작하기
                <ArrowRight size={20} />
              </Link>
              <a
                href="#features"
                className="inline-flex h-14 items-center justify-center rounded-xl border border-[#bcc9c6]/80 bg-white px-7 text-base font-bold text-[#00685f] transition-colors hover:bg-[#eff4ff]"
              >
                기능 살펴보기
              </a>
            </div>
            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-[#bcc9c6]/60 bg-white/80 p-4 shadow-sm">
                <dt className="text-2xl font-extrabold text-[#00685f]">3초</dt>
                <dd className="mt-1 text-xs font-semibold text-[#3d4947]">검색 진입</dd>
              </div>
              <div className="rounded-xl border border-[#bcc9c6]/60 bg-white/80 p-4 shadow-sm">
                <dt className="text-2xl font-extrabold text-[#00685f]">3종</dt>
                <dd className="mt-1 text-xs font-semibold text-[#3d4947]">안전 신호</dd>
              </div>
              <div className="rounded-xl border border-[#bcc9c6]/60 bg-white/80 p-4 shadow-sm">
                <dt className="text-2xl font-extrabold text-[#00685f]">공공</dt>
                <dd className="mt-1 text-xs font-semibold text-[#3d4947]">데이터 연동</dd>
              </div>
            </dl>
          </div>

          <div className="landing-fade-up landing-delay-2 relative mx-auto w-full max-w-[560px]">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#62fae3]/35 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-[#89f5e7]/30 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border-[6px] border-white bg-white shadow-2xl shadow-teal-950/15">
              <img
                src={landingImages.hero}
                alt="FoodScan 앱 식품 안전 분석 화면"
                className="block h-auto w-full object-contain"
              />
            </div>
          </div>
        </section>

        <section className="border-y border-[#bcc9c6]/40 bg-white py-10">
          <div className="mx-auto max-w-[1280px] px-4 md:px-10">
            <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#6d7a77]">
              신뢰할 수 있는 기관들과 함께합니다
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-6 text-[#3d4947] md:gap-12">
              {trustPartners.map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2 opacity-75">
                  <Icon size={30} />
                  <span className="text-base font-extrabold">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="relative overflow-hidden px-4 py-20 md:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(189,211,255,0.75)_0%,rgba(255,255,255,0)_36%),radial-gradient(circle_at_90%_80%,rgba(204,255,248,0.9)_0%,rgba(255,255,255,0)_38%)]" />
          <div className="relative mx-auto max-w-[860px]">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-extrabold tracking-[-0.01em] text-[#0d1c2e] md:text-4xl">
                프리미엄 푸드스캔 기능
              </h2>
              <p className="mt-3 text-base font-medium text-[#3d4947]">
                앱 진입 후 바로 검색하거나 바코드 스캔을 시작할 수 있게 연결했습니다.
              </p>
            </div>
            <div className="flex flex-col gap-6">
              {featureCards.map(({ title, description, image, icon: Icon }, index) => (
                <article
                  key={title}
                  className="group grid grid-cols-1 items-center gap-8 rounded-[2rem] border-2 border-transparent bg-white/85 p-7 shadow-xl shadow-blue-950/5 backdrop-blur-xl transition-all duration-300 ease-out hover:border-[#00685f]/50 hover:shadow-teal-950/15 md:grid-cols-[0.9fr_1fr] md:p-10"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="h-[220px] overflow-hidden rounded-2xl bg-[#eff4ff] md:h-[240px]">
                    <img
                      src={image}
                      alt={`${title} 기능 이미지`}
                      loading="lazy"
                      className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:rotate-6 group-hover:scale-110"
                    />
                  </div>
                  <div>
                    <h3 className="flex items-center gap-3 text-2xl font-extrabold text-[#0d1c2e] transition-colors duration-300 group-hover:text-[#00685f]">
                      <span
                        aria-hidden="true"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-[#00685f] transition-transform duration-300 ease-out"
                      >
                        <Icon size={22} />
                      </span>
                      <span>{title}</span>
                    </h3>
                    <p className="mt-3 text-lg font-medium leading-8 text-[#3d4947]">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 md:px-10">
          <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0d9488] to-[#2dd4bf] p-10 text-center shadow-2xl shadow-teal-950/15 md:p-16">
            <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
            <div className="landing-shimmer absolute left-0 top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="relative">
              <CheckCircle2 className="mx-auto mb-5 text-white" size={42} />
              <h2 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-[-0.01em] text-white md:text-4xl">
                건강한 식습관의 시작, FoodScan과 함께하세요
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-7 text-white/90">
                버튼을 누르면 기존 식품 스캔 홈 화면으로 이동합니다.
              </p>
              <Link
                to="/app"
                className="mt-9 inline-flex h-14 items-center justify-center rounded-xl bg-white px-8 text-base font-extrabold text-[#00685f] shadow-lg transition-transform hover:-translate-y-0.5"
              >
                지금 무료로 시작하기
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export function AppHomePage() {
  const nav = useNavigate();
  const [recent, setRecent] = useState<Product[]>([]);

  useEffect(() => {
    setRecent(getRecent());
  }, []);

  return (
    <AppShell
      title="식품 스캔"
      right={
        <Link
          to="/settings"
          aria-label="설정"
          className="h-11 w-11 -mr-2 flex items-center justify-center rounded-md hover:bg-subtle text-foreground"
        >
          <Settings size={20} />
        </Link>
      }
    >
      <div className="pt-4">
        <SearchInput onSubmit={(q) => q && nav({ to: "/search", search: { q } })} />
      </div>

      <section className="mt-6">
        <div className="grid grid-cols-1 gap-3">
          <Link
            to="/scan"
            search={{ mode: "barcode" }}
            className="bg-surface border border-border rounded-md flex flex-col items-center justify-center gap-2 shadow-card hover:border-primary transition-colors"
            style={{ height: 96 }}
          >
            <ScanBarcode size={28} style={{ color: "#0F766E" }} />
            <span className="text-[15px] font-semibold text-foreground">바코드 스캔</span>
          </Link>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[18px] font-bold">최근 스캔</h2>
          {recent.length > 0 && (
            <Link to="/history" className="text-[13px] text-primary font-semibold">
              전체 보기
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="bg-surface border border-border rounded-md p-6 text-center shadow-card">
            <h3 className="text-[16px] font-bold text-foreground">아직 스캔한 제품이 없습니다</h3>
            <p className="mt-1 text-[14px]" style={{ color: "#64748B" }}>
              바코드 스캔이나 제품명 검색으로 첫 제품을 분석해보세요
            </p>
            <Link
              to="/scan"
              search={{ mode: "barcode" }}
              className="inline-flex items-center justify-center mt-4 px-4 rounded-md font-semibold text-white"
              style={{ height: 44, backgroundColor: "#0F766E", fontSize: 15 }}
            >
              바코드 스캔
            </Link>
          </div>
        ) : (
          <RecentScanList recent={recent} />
        )}
      </section>
    </AppShell>
  );
}

export function RecentScanList({ recent }: { recent: Product[] }) {
  return (
    <ul className="space-y-3">
      {recent.slice(0, 5).map((p) => (
        <li key={p.id}>
          <ProductCard product={p} linkView="history" />
        </li>
      ))}
    </ul>
  );
}
