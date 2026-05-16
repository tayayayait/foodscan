import { useEffect, useRef, useState, useCallback, type RefObject } from "react";
import type { BarcodeEngine } from "@/lib/barcode-decoder";

/**
 * SSR 안전 — barcode-decoder / barcode-crop는 브라우저 전용이므로
 * 모든 import를 useEffect 내 dynamic import로 수행합니다.
 * (Cloudflare Workers / TanStack Start SSR 환경 호환)
 */

export type ScanStatus = "idle" | "requesting" | "scanning" | "found" | "denied" | "unsupported";

export interface UseBarcodeScanner {
  status: ScanStatus;
  error: string | null;
  /** 스캔 시작 이후 경과 초 */
  scanDuration: number;
  /** 현재 사용 중인 엔진 이름 */
  engineName: string | null;
  /** 토치(플래시) 지원 여부 */
  torchSupported: boolean;
  /** 토치 ON/OFF 상태 */
  torchOn: boolean;
  /** 토치 토글 */
  toggleTorch: () => void;
  restart: () => void;
  stop: () => void;
}

interface ScannerOptions {
  enabled?: boolean;
  /** 스캔 시도 간격 (ms) — 기본 250ms */
  scanInterval?: number;
  /** 가이드 박스 크기 (CSS px) */
  guideBox?: { width: number; height: number };
  /** 컨테이너 크기 (CSS px) — 동적으로 전달 */
  containerSize?: { width: number; height: number };
}

/** 카메라 제약조건 — 후면카메라, FHD 해상도 */
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1920, min: 1280 },
  height: { ideal: 1080, min: 720 },
};

/** 카메라 폴백 제약조건 (FHD 미지원 기기) */
const FALLBACK_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: "environment",
};

type TorchMediaTrackConstraintSet = MediaTrackConstraintSet & {
  torch?: boolean;
};

type TorchMediaTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
};

/**
 * 바코드 스캐너 커스텀 훅 v2
 *
 * - 듀얼 엔진: Native BarcodeDetector → ZBar WASM → ZXing 자동 선택
 * - ROI 크롭: 가이드 박스 영역만 디코더에 전달 (19배 데이터 축소)
 * - 토치/플래시: 어두운 환경 대응
 * - SSR 안전: 모든 브라우저 전용 모듈은 dynamic import
 */
export function useBarcodeScanner(
  videoRef: RefObject<HTMLVideoElement | null>,
  onDetect: (code: string) => void,
  options: ScannerOptions = {},
): UseBarcodeScanner {
  const {
    enabled = true,
    scanInterval = 250,
    guideBox = { width: 280, height: 120 },
    containerSize,
  } = options;

  const [status, setStatus] = useState<ScanStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scanDuration, setScanDuration] = useState(0);
  const [engineName, setEngineName] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const activeRef = useRef(true);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  // 정리용 refs
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<BarcodeEngine | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── 스캔 경과 시간 타이머 ──
  useEffect(() => {
    if (status !== "scanning") {
      setScanDuration(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setScanDuration(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // ── 토치 토글 ──
  const toggleTorch = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    track
      .applyConstraints({ advanced: [{ torch: next } as TorchMediaTrackConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => {
        /* torch 지원 안됨 */
      });
  }, [torchOn]);

  // ── 메인 스캐닝 로직 ──
  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    // SSR 가드: 서버 환경이면 아무것도 하지 않음
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setError("이 브라우저에서 카메라를 지원하지 않습니다");
      return;
    }

    activeRef.current = true;
    setStatus("requesting");
    setError(null);
    setEngineName(null);

    let cancelled = false;

    /**
     * 스캔 루프 팩토리 — engine과 cropCanvas를 클로저로 캡처
     * 중복 코드를 제거하기 위해 함수로 추출
     */
    const createScanLoop = (
      engine: BarcodeEngine,
      cropCanvas: HTMLCanvasElement,
      calcCropRegion: typeof import("@/lib/barcode-crop").calculateCropRegion,
      cropFrame: typeof import("@/lib/barcode-crop").cropVideoFrame,
    ) => {
      const runScan = async () => {
        if (!activeRef.current || cancelled) return;

        const v = videoRef.current;
        if (!v || v.readyState < 2) {
          scanTimerRef.current = setTimeout(runScan, scanInterval);
          return;
        }

        try {
          const cw = containerSize?.width || v.clientWidth || 375;
          const ch = containerSize?.height || v.clientHeight || 320;

          const region = calcCropRegion(
            v.videoWidth,
            v.videoHeight,
            cw,
            ch,
            guideBox.width,
            guideBox.height,
          );

          cropFrame(v, region, cropCanvas);

          const results = await engine.detect(cropCanvas);

          if (results.length > 0 && activeRef.current && !cancelled) {
            const code = results[0].rawValue;
            if (code) {
              activeRef.current = false;
              setStatus("found");
              try {
                if ("vibrate" in navigator) navigator.vibrate([50, 30, 50]);
              } catch {
                /* ignore */
              }
              onDetectRef.current(code);
              return;
            }
          }
        } catch {
          /* 프레임 디코딩 실패 — 다음 프레임 계속 */
        }

        if (activeRef.current && !cancelled) {
          scanTimerRef.current = setTimeout(runScan, scanInterval);
        }
      };
      return runScan;
    };

    (async () => {
      try {
        // ── Dynamic import (SSR 안전) ──
        const [{ createBarcodeEngine }, { calculateCropRegion, cropVideoFrame }] =
          await Promise.all([import("@/lib/barcode-decoder"), import("@/lib/barcode-crop")]);

        if (cancelled) return;

        // ── 1) 바코드 엔진 초기화 ──
        const engine = await createBarcodeEngine();
        if (cancelled) {
          engine.dispose();
          return;
        }
        engineRef.current = engine;
        setEngineName(engine.name);

        // ── 2) 카메라 스트림 획득 ──
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: VIDEO_CONSTRAINTS,
            audio: false,
          });
        } catch (camErr) {
          // FHD 미지원 시 폴백
          if ((camErr as Error).name === "OverconstrainedError") {
            stream = await navigator.mediaDevices.getUserMedia({
              video: FALLBACK_CONSTRAINTS,
              audio: false,
            });
          } else {
            throw camErr;
          }
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          engine.dispose();
          return;
        }
        streamRef.current = stream;

        // 비디오 엘리먼트에 연결
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        // ── 3) 토치 지원 확인 ──
        const track = stream.getVideoTracks()[0];
        if (track) {
          try {
            const caps = track.getCapabilities?.() as TorchMediaTrackCapabilities | undefined;
            if (caps?.torch) {
              setTorchSupported(true);
            }
          } catch {
            /* getCapabilities 미지원 */
          }
        }

        if (cancelled) return;
        setStatus("scanning");

        // ── 4) 크롭 캔버스 생성 (재사용) ──
        if (!cropCanvasRef.current) {
          cropCanvasRef.current = document.createElement("canvas");
        }

        // ── 5) 스캔 루프 시작 ──
        const runScan = createScanLoop(
          engine,
          cropCanvasRef.current,
          calculateCropRegion,
          cropVideoFrame,
        );
        runScan();
      } catch (e) {
        if (cancelled) return;
        const err = e as Error;
        if (err.name === "NotAllowedError" || err.name === "SecurityError") {
          setStatus("denied");
          setError("카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.");
        } else if (err.name === "NotFoundError") {
          setStatus("unsupported");
          setError("카메라를 찾을 수 없습니다.");
        } else if (err.name === "NotReadableError") {
          setStatus("unsupported");
          setError("카메라가 다른 앱에서 사용 중입니다.");
        } else {
          setStatus("unsupported");
          setError(err.message || "카메라를 시작할 수 없습니다");
        }
      }
    })();

    return () => {
      cancelled = true;
      activeRef.current = false;

      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      engineRef.current?.dispose();
      engineRef.current = null;

      setTorchOn(false);
      setTorchSupported(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, restartKey]);

  const restart = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    engineRef.current?.dispose();
    engineRef.current = null;
    setRestartKey((k) => k + 1);
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    engineRef.current?.dispose();
    engineRef.current = null;
    setStatus("idle");
  }, []);

  return {
    status,
    error,
    scanDuration,
    engineName,
    torchSupported,
    torchOn,
    toggleTorch,
    restart,
    stop,
  };
}
