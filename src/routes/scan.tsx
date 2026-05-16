import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Flashlight, FlashlightOff, RefreshCw, Search } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { isValidBarcode } from "@/lib/barcode-utils";

const scanSearchSchema = z.object({
  mode: z.literal("barcode").optional().default("barcode"),
});

export const Route = createFileRoute("/scan")({
  validateSearch: scanSearchSchema,
  head: () => ({
    meta: [
      { title: "스캔 — 식품 스캔" },
      { name: "description", content: "바코드로 제품을 분석합니다." },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  const nav = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualCode, setManualCode] = useState("");

  const handleDetectedBarcode = (code: string) => {
    setManualCode(code.replace(/\D/g, "").slice(0, 14));
  };

  const { status, error, scanDuration, engineName, torchSupported, torchOn, toggleTorch, restart } =
    useBarcodeScanner(videoRef, handleDetectedBarcode, {
      enabled: true,
    });

  const submitManualBarcode = () => {
    const code = manualCode.trim();
    if (!code) {
      toast.error("바코드 번호를 입력하세요");
      return;
    }
    if (!isValidBarcode(code)) {
      toast.error("유효하지 않은 바코드 형식입니다 (숫자 8~14자리)");
      return;
    }
    nav({ to: "/product/$id", params: { id: code } });
  };

  return (
    <AppShell title="스캔" back={() => history.back()} hideAppBar={false}>
      <div className="-mx-4 md:mx-0 md:mt-4">
        <div className="space-y-3">
          <div
            className="relative bg-[#020617] overflow-hidden md:rounded-md"
            style={{ minHeight: 320, height: "calc(100vh - 380px)" }}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="border-2 rounded-md relative"
                style={{
                  width: 280,
                  height: 120,
                  borderColor:
                    status === "found"
                      ? "#22C55E"
                      : status === "scanning"
                        ? "#fff"
                        : "rgba(255,255,255,0.5)",
                  boxShadow: status === "found" ? "0 0 20px rgba(34,197,94,0.4)" : "none",
                  transition: "border-color 0.3s, box-shadow 0.3s",
                }}
                aria-hidden
              >
                {status === "scanning" && (
                  <div
                    className="absolute left-2 right-2 h-[2px] rounded-full"
                    style={{
                      background: "linear-gradient(90deg, transparent, #22D3EE, transparent)",
                      animation: "scanLine 2s ease-in-out infinite",
                    }}
                  />
                )}
              </div>
            </div>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 200px 90px at center, transparent 60%, rgba(2,6,23,0.55) 70%)",
              }}
            />
            <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm">
              {status === "scanning" && (
                <div>
                  <p>바코드를 가이드 안에 맞춰주세요</p>
                  {scanDuration >= 5 && scanDuration < 10 && (
                    <p className="mt-1 text-[12px] opacity-80 animate-pulse">
                      바코드를 좀 더 가까이 대 주세요
                    </p>
                  )}
                  {scanDuration >= 10 && scanDuration < 15 && (
                    <p className="mt-1 text-[12px] opacity-80 animate-pulse">
                      다른 각도로 시도해보세요
                    </p>
                  )}
                  {scanDuration >= 15 && (
                    <p className="mt-1 text-[12px] opacity-80 animate-pulse">
                      인식이 어려우시면 아래에서 직접 입력하세요
                    </p>
                  )}
                </div>
              )}
              {status === "requesting" && "카메라 권한을 확인하세요"}
              {status === "found" && "인식된 번호를 확인한 뒤 검색하세요"}
              {status === "denied" && (
                <div className="px-6">
                  <p className="font-semibold">카메라 권한이 필요합니다</p>
                  <p className="opacity-80 mt-1 text-[13px]">
                    브라우저 설정에서 카메라 권한을 허용해주세요
                  </p>
                </div>
              )}
              {status === "unsupported" && (
                <div className="px-6">
                  <p className="font-semibold">이 환경에서는 카메라를 사용할 수 없습니다</p>
                  {error && <p className="opacity-70 mt-1 text-[12px]">{error}</p>}
                </div>
              )}
            </div>
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              {engineName && status === "scanning" ? (
                <span className="rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-1 text-[10px] font-medium text-white/80 uppercase tracking-wide">
                  {engineName === "native" ? "HW" : engineName === "zbar-wasm" ? "ZBar" : "ZXing"}
                </span>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                {torchSupported && status === "scanning" && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className="flex items-center gap-1.5 rounded-md bg-white/20 backdrop-blur-sm px-3 py-1.5 text-white text-[13px] font-medium hover:bg-white/30 transition-colors"
                    aria-label={torchOn ? "플래시 끄기" : "플래시 켜기"}
                  >
                    {torchOn ? <FlashlightOff size={14} /> : <Flashlight size={14} />}
                  </button>
                )}
                {(status === "denied" || status === "unsupported") && (
                  <button
                    type="button"
                    onClick={restart}
                    className="flex items-center gap-1.5 rounded-md bg-white/20 backdrop-blur-sm px-3 py-1.5 text-white text-[13px] font-medium hover:bg-white/30 transition-colors"
                  >
                    <RefreshCw size={14} />
                    재시도
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mx-4 md:mx-0">
            <div className="rounded-md border border-border bg-surface p-4 shadow-card">
              <label className="block text-[13px] font-semibold mb-2">바코드 번호 입력</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={14}
                  placeholder="8801234567890"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && submitManualBarcode()}
                  className="flex-1 rounded-md border border-border-strong bg-subtle px-3 py-2.5 text-[15px] tabular font-medium tracking-wider text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={submitManualBarcode}
                  disabled={!manualCode.trim()}
                  aria-label="바코드 검색"
                  className="rounded-md px-4 py-2.5 font-semibold text-white disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: "#0F766E", fontSize: 14 }}
                >
                  <Search size={16} />
                </button>
              </div>
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                {status === "found"
                  ? "인식된 번호를 확인·수정한 뒤 검색 버튼을 누르세요"
                  : "제품 포장의 바코드 아래 숫자를 입력하세요 (8~14자리)"}
              </p>
            </div>
          </div>
        </div>

        <div className="mx-4 md:mx-0 mt-4 flex justify-center">
          <button
            onClick={() => nav({ to: "/search", search: { q: "" } })}
            className="inline-flex items-center gap-2 px-4 rounded-md font-semibold"
            style={{
              height: 44,
              backgroundColor: "#FFFFFF",
              color: "#0F766E",
              border: "1px solid #99F6E4",
              fontSize: 15,
            }}
          >
            <Search size={18} />
            제품명으로 검색
          </button>
        </div>
      </div>
    </AppShell>
  );
}
