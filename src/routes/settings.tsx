import { createFileRoute, Link } from "@tanstack/react-router";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  BadgeCheck,
  Database,
  Download,
  Info,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import {
  buildLocalDataInventory,
  dataSourceTiers,
  TRUST_PRINCIPLES,
  type LocalDataInventoryItem,
} from "@/lib/trust-center";
import {
  exportLocalDataSnapshot,
  getOcrDrafts,
  getProvisional,
  getRecent,
  getRecentSearches,
  getSavedProducts,
  hasStoredPrefs,
  importLocalDataSnapshot,
} from "@/lib/storage";
import {
  localDataExportFileName,
  mergeLocalDataExports,
  parseLocalDataExport,
  summarizeLocalDataExport,
  type LocalDataExport,
} from "@/lib/local-data-portability";
import {
  accountSyncErrorMessage,
  clearStoredAccountSession,
  fetchAccountSnapshot,
  getStoredAccountSession,
  isValidAccountPin,
  isValidAccountUsername,
  signInOrCreateAccount,
  signOutAccount,
  syncAccountSnapshot,
  type AccountSession,
} from "@/lib/account-sync";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "설정 — 식품 스캔" }, { name: "description", content: "앱 설정 및 정보" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [inventory, setInventory] = useState<LocalDataInventoryItem[]>([]);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [accountSession, setAccountSession] = useState<AccountSession | null>(null);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPin, setAccountPin] = useState("");
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const refreshInventory = () => {
    setInventory(
      buildLocalDataInventory({
        recentCount: getRecent().length,
        savedCount: getSavedProducts().length,
        provisionalCount: getProvisional().length,
        hasPreferences: hasStoredPrefs(),
        ocrDraftCount: getOcrDrafts().length,
        recentSearchCount: getRecentSearches().length,
      }),
    );
  };

  useEffect(() => {
    refreshInventory();
    setAccountSession(getStoredAccountSession());
  }, []);

  const syncRemoteSnapshot = async (
    session: AccountSession,
    remoteSnapshot: LocalDataExport | null,
  ) => {
    const localSnapshot = exportLocalDataSnapshot();
    if (remoteSnapshot) {
      const merged = mergeLocalDataExports(remoteSnapshot, localSnapshot);
      importLocalDataSnapshot(merged);
      await syncAccountSnapshot(session, exportLocalDataSnapshot());
      refreshInventory();
      return summarizeLocalDataExport(merged);
    }

    await syncAccountSnapshot(session, localSnapshot);
    refreshInventory();
    return summarizeLocalDataExport(localSnapshot);
  };

  const handleAccountLogin = async () => {
    if (!isValidAccountUsername(accountUsername)) {
      setAccountMessage("계정 ID는 영문 소문자, 숫자, 점, 대시, 밑줄 3-32자여야 합니다.");
      return;
    }
    if (!isValidAccountPin(accountPin)) {
      setAccountMessage("PIN은 숫자 4-12자리여야 합니다.");
      return;
    }

    setAccountBusy(true);
    setAccountMessage(null);
    try {
      const result = await signInOrCreateAccount(accountUsername, accountPin);
      setAccountSession(result.session);
      setAccountPin("");
      const summary = await syncRemoteSnapshot(result.session, result.snapshot);
      setAccountMessage(
        `${result.created ? "계정 생성" : "로그인"} 완료. 기록 ${summary.recentCount}개, 검색어 ${summary.recentSearchCount}개를 동기화했습니다.`,
      );
    } catch (error) {
      setAccountMessage(accountSyncErrorMessage(error));
    } finally {
      setAccountBusy(false);
    }
  };

  const handlePullAccountSnapshot = async () => {
    const session = getStoredAccountSession();
    if (!session) {
      setAccountSession(null);
      setAccountMessage("로그인이 필요합니다.");
      return;
    }

    setAccountBusy(true);
    setAccountMessage(null);
    try {
      const remoteSnapshot = await fetchAccountSnapshot(session);
      const summary = await syncRemoteSnapshot(session, remoteSnapshot);
      setAccountMessage(
        `서버 기록을 반영했습니다. 기록 ${summary.recentCount}개, 검색어 ${summary.recentSearchCount}개.`,
      );
    } catch (error) {
      setAccountMessage(accountSyncErrorMessage(error));
    } finally {
      setAccountBusy(false);
    }
  };

  const handlePushAccountSnapshot = async () => {
    const session = getStoredAccountSession();
    if (!session) {
      setAccountSession(null);
      setAccountMessage("로그인이 필요합니다.");
      return;
    }

    setAccountBusy(true);
    setAccountMessage(null);
    try {
      const snapshot = exportLocalDataSnapshot();
      await syncAccountSnapshot(session, snapshot);
      const summary = summarizeLocalDataExport(snapshot);
      setAccountMessage(
        `현재 기록을 서버에 저장했습니다. 기록 ${summary.recentCount}개, 검색어 ${summary.recentSearchCount}개.`,
      );
    } catch (error) {
      setAccountMessage(accountSyncErrorMessage(error));
    } finally {
      setAccountBusy(false);
    }
  };

  const handleAccountLogout = async () => {
    const session = getStoredAccountSession();
    setAccountBusy(true);
    setAccountMessage(null);
    try {
      if (session) await signOutAccount(session);
    } catch {
      clearStoredAccountSession();
    } finally {
      setAccountSession(null);
      setAccountBusy(false);
      setAccountMessage("로그아웃했습니다. 로컬 기록은 삭제하지 않았습니다.");
    }
  };

  const handleExportLocalData = () => {
    const snapshot = exportLocalDataSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = localDataExportFileName(snapshot.exportedAt);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setTransferMessage("로컬 데이터 백업 파일을 생성했습니다.");
  };

  const handleImportLocalData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      const parsed = parseLocalDataExport(await file.text());
      if (!parsed.ok) {
        setTransferMessage(importErrorMessage(parsed.error));
        return;
      }
      importLocalDataSnapshot(parsed.value);
      refreshInventory();
      setTransferMessage(
        `로컬 데이터를 가져왔습니다. 최근 ${parsed.summary.recentCount}개, 저장 ${parsed.summary.savedCount}개`,
      );
    } catch {
      setTransferMessage("로컬 데이터 파일을 읽을 수 없습니다.");
    }
  };

  return (
    <AppShell title="설정">
      <div className="pt-4 space-y-4">
        <section className="bg-surface border border-border rounded-md p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: "#CCFBF1", color: "#0F766E" }}
              >
                <SlidersHorizontal size={20} />
              </span>
              <div>
                <h2 className="text-[16px] font-bold">개인 기준</h2>
                <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                  알레르기, 영양 한도, 첨가물 경고는 제품 점수를 바꾸지 않고 별도 개인 경고로만
                  표시합니다.
                </p>
              </div>
            </div>
            <Link
              to="/preferences"
              className="inline-flex h-10 flex-shrink-0 items-center justify-center rounded-md px-3 text-[13px] font-bold"
              style={{ backgroundColor: "#F1F5F9", color: "#334155" }}
            >
              관리
            </Link>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-md p-4 shadow-card">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: "#CCFBF1", color: "#0F766E" }}
            >
              <UserRound size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold">계정 동기화</h2>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    로그인하면 최근 검색어, 스캔 기록, 저장 상품, 개인 기준을 서버 스냅샷으로 보관합니다.
                  </p>
                </div>
                {accountSession ? (
                  <span
                    className="rounded-[6px] px-2 py-1 text-[12px] font-bold"
                    style={{ backgroundColor: "#ECFDF5", color: "#047857" }}
                  >
                    {accountSession.username}
                  </span>
                ) : null}
              </div>

              {accountSession ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePullAccountSnapshot}
                    disabled={accountBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-md px-4 font-semibold disabled:opacity-60"
                    style={{
                      height: 44,
                      backgroundColor: "#0F766E",
                      color: "#FFFFFF",
                      fontSize: 14,
                    }}
                  >
                    <RefreshCw size={16} />
                    서버 기록 가져오기
                  </button>
                  <button
                    type="button"
                    onClick={handlePushAccountSnapshot}
                    disabled={accountBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-md px-4 font-semibold disabled:opacity-60"
                    style={{
                      height: 44,
                      backgroundColor: "#FFFFFF",
                      color: "#0F766E",
                      border: "1px solid #99F6E4",
                      fontSize: 14,
                    }}
                  >
                    <Upload size={16} />
                    현재 기록 서버 저장
                  </button>
                  <button
                    type="button"
                    onClick={handleAccountLogout}
                    disabled={accountBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-md px-4 font-semibold disabled:opacity-60"
                    style={{
                      height: 44,
                      backgroundColor: "#FFFFFF",
                      color: "#334155",
                      border: "1px solid #CBD5E1",
                      fontSize: 14,
                    }}
                  >
                    <LogOut size={16} />
                    로그아웃
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid gap-2 md:grid-cols-[1fr_160px_auto]">
                  <input
                    value={accountUsername}
                    onChange={(event) => setAccountUsername(event.currentTarget.value)}
                    placeholder="계정 ID"
                    autoComplete="username"
                    className="h-11 rounded-md border border-border bg-white px-3 text-[14px] outline-none focus:border-[#0F766E]"
                  />
                  <input
                    value={accountPin}
                    onChange={(event) => setAccountPin(event.currentTarget.value)}
                    placeholder="PIN"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    className="h-11 rounded-md border border-border bg-white px-3 text-[14px] outline-none focus:border-[#0F766E]"
                  />
                  <button
                    type="button"
                    onClick={handleAccountLogin}
                    disabled={accountBusy}
                    className="inline-flex h-11 items-center justify-center rounded-md px-4 text-[14px] font-bold text-white disabled:opacity-60"
                    style={{ backgroundColor: "#0F766E" }}
                  >
                    로그인 / 생성
                  </button>
                </div>
              )}

              <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                계정 ID는 영문 소문자, 숫자, 점, 대시, 밑줄만 허용합니다. PIN 분실 시 복구 기능은 없습니다.
              </p>
              {accountMessage ? (
                <p className="mt-3 text-[13px] font-semibold" style={{ color: "#334155" }}>
                  {accountMessage}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-md p-4 shadow-card">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: "#CCFBF1", color: "#0F766E" }}
            >
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="text-[16px] font-bold">신뢰 센터</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                점수, 추천, 로컬 데이터 처리 원칙
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {TRUST_PRINCIPLES.map((principle) => (
              <div key={principle.key} className="flex gap-2">
                <TrustIcon principleKey={principle.key} />
                <div>
                  <p className="text-[14px] font-bold">{principle.title}</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                    {principle.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface border border-border rounded-md p-4 shadow-card">
          <h2 className="text-[16px] font-bold">데이터 출처</h2>
          <ul className="mt-3 divide-y divide-border text-[13px]">
            {dataSourceTiers().map((tier) => (
              <li
                key={tier.key}
                className="grid grid-cols-[80px_1fr] gap-3 py-2 first:pt-0 last:pb-0"
              >
                <span className="font-bold text-foreground">{tier.label}</span>
                <span className="text-muted-foreground">
                  {tier.source} · {tier.scoreUse}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-surface border border-border rounded-md p-4 shadow-card">
          <div className="flex items-center gap-2">
            <Database size={17} style={{ color: "#0F766E" }} />
            <h2 className="text-[16px] font-bold">내 로컬 데이터</h2>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {inventory.map((item) => (
              <li
                key={item.key}
                className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-[14px] font-bold">{item.label}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{item.purpose}</p>
                </div>
                <span
                  className="flex-shrink-0 rounded-[6px] px-2 py-1 text-[12px] font-bold"
                  style={{ backgroundColor: "#F1F5F9", color: "#334155" }}
                >
                  {item.countLabel}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-surface border border-border rounded-md p-4 shadow-card">
          <h2 className="text-[16px] font-bold">데이터 관리</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/admin"
              className="inline-flex items-center justify-center gap-2 px-4 rounded-md font-semibold"
              style={{
                height: 44,
                backgroundColor: "#FFFFFF",
                color: "#0F766E",
                border: "1px solid #99F6E4",
                fontSize: 14,
              }}
            >
              <ShieldCheck size={16} />
              관리자 검수
            </Link>
            <button
              type="button"
              onClick={handleExportLocalData}
              className="inline-flex items-center justify-center gap-2 px-4 rounded-md font-semibold"
              style={{
                height: 44,
                backgroundColor: "#FFFFFF",
                color: "#0F766E",
                border: "1px solid #99F6E4",
                fontSize: 14,
              }}
            >
              <Download size={16} />
              로컬 데이터 내보내기
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-4 rounded-md font-semibold"
              style={{
                height: 44,
                backgroundColor: "#FFFFFF",
                color: "#334155",
                border: "1px solid #CBD5E1",
                fontSize: 14,
              }}
            >
              <Upload size={16} />
              로컬 데이터 가져오기
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("저장된 모든 기록과 기준을 삭제할까요?")) {
                  localStorage.clear();
                  location.reload();
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-4 rounded-md font-semibold"
              style={{
                height: 44,
                backgroundColor: "#FFFFFF",
                color: "#DC2626",
                border: "1px solid #FCA5A5",
                fontSize: 14,
              }}
            >
              <Trash2 size={16} />
              로컬 데이터 모두 삭제
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportLocalData}
            />
          </div>
          {transferMessage ? (
            <p className="mt-3 text-[13px] font-semibold" style={{ color: "#334155" }}>
              {transferMessage}
            </p>
          ) : null}
        </section>
        <div className="rounded-md p-4 flex gap-2" style={{ backgroundColor: "#E2E8F0" }}>
          <Info size={18} style={{ color: "#334155" }} className="flex-shrink-0 mt-0.5" />
          <p className="text-[13px]" style={{ color: "#334155" }}>
            본 서비스 정보는 의학적 진단을 대체하지 않습니다. 알레르기 또는 건강 우려가 있다면
            전문가와 상담하세요.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function importErrorMessage(error: string) {
  if (error === "unsupported_app") return "이 앱의 로컬 데이터 파일이 아닙니다.";
  if (error === "unsupported_version") return "지원하지 않는 백업 파일 버전입니다.";
  if (error === "invalid_payload") return "백업 파일 구조가 올바르지 않습니다.";
  return "JSON 파일 형식이 올바르지 않습니다.";
}

function TrustIcon({ principleKey }: { principleKey: string }) {
  const iconStyle = { color: "#0F766E" };
  const common =
    "mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[6px] bg-[#F0FDFA]";
  if (principleKey === "independent_scoring") {
    return (
      <span className={common}>
        <Scale size={15} style={iconStyle} />
      </span>
    );
  }
  if (principleKey === "no_sponsored_recommendations") {
    return (
      <span className={common}>
        <BadgeCheck size={15} style={iconStyle} />
      </span>
    );
  }
  if (principleKey === "unverified_labeling") {
    return (
      <span className={common}>
        <Sparkles size={15} style={iconStyle} />
      </span>
    );
  }
  if (principleKey === "no_commercial_sale") {
    return (
      <span className={common}>
        <LockKeyhole size={15} style={iconStyle} />
      </span>
    );
  }
  return (
    <span className={common}>
      <Info size={15} style={iconStyle} />
    </span>
  );
}
