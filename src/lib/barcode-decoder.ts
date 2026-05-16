/**
 * 듀얼 엔진 바코드 디코더
 *
 * 우선순위:
 *  1. Native BarcodeDetector API (Chrome Android — HW 가속)
 *  2. ZBar WASM Polyfill (@undecaf/barcode-detector-polyfill)
 *  3. ZXing-JS (최후 폴백)
 *
 * 모든 엔진은 동일한 `BarcodeEngine` 인터페이스로 추상화되어
 * `useBarcodeScanner` 훅이 엔진에 독립적으로 동작합니다.
 */

// ── 지원 포맷 (한국 식품 바코드) ──
const SUPPORTED_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] as const;

type BarcodeDetectorSource = HTMLVideoElement | HTMLCanvasElement | ImageBitmap;

export interface DetectedBarcode {
  rawValue: string;
  format: string;
}

export interface BarcodeEngine {
  readonly name: "native" | "zbar-wasm" | "zxing";
  detect(source: BarcodeDetectorSource): Promise<DetectedBarcode[]>;
  dispose(): void;
}

interface BarcodeDetectorResultLike {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorLike {
  detect(source: BarcodeDetectorSource): Promise<BarcodeDetectorResultLike[]>;
}

interface BarcodeDetectorConstructorLike {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

function getNativeBarcodeDetector(): BarcodeDetectorConstructorLike | null {
  const ctor = (
    globalThis as typeof globalThis & {
      BarcodeDetector?: BarcodeDetectorConstructorLike;
    }
  ).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

function normalizeBarcodeResult(result: BarcodeDetectorResultLike): DetectedBarcode {
  return {
    rawValue: result.rawValue,
    format: result.format,
  };
}

// ── 1) Native BarcodeDetector ──

function isNativeBarcodeDetectorAvailable(): boolean {
  return getNativeBarcodeDetector() !== null;
}

async function createNativeEngine(): Promise<BarcodeEngine> {
  const NativeBD = getNativeBarcodeDetector();
  if (!NativeBD) throw new Error("Native BarcodeDetector: 사용할 수 없음");
  // 지원 포맷 교차 검증
  const supported: string[] = await NativeBD.getSupportedFormats();
  const formats = SUPPORTED_FORMATS.filter((f) => supported.includes(f));
  if (formats.length === 0) throw new Error("Native BarcodeDetector: 지원 포맷 없음");

  const detector = new NativeBD({ formats });

  return {
    name: "native",
    async detect(source) {
      try {
        const results = await detector.detect(source);
        return results.map(normalizeBarcodeResult);
      } catch {
        return [];
      }
    },
    dispose() {
      /* Native API는 dispose 불필요 */
    },
  };
}

// ── 2) ZBar WASM Polyfill ──

async function createZBarEngine(): Promise<BarcodeEngine> {
  const { BarcodeDetectorPolyfill } = await import("@undecaf/barcode-detector-polyfill");

  const detector = new BarcodeDetectorPolyfill({
    formats: SUPPORTED_FORMATS as unknown as string[],
  });

  return {
    name: "zbar-wasm",
    async detect(source) {
      try {
        const results = (await detector.detect(source)) as BarcodeDetectorResultLike[];
        return results.map(normalizeBarcodeResult);
      } catch {
        return [];
      }
    },
    dispose() {
      /* Polyfill 내부 WASM 리소스는 자동 관리 */
    },
  };
}

// ── 3) ZXing-JS 폴백 ──

async function createZXingEngine(): Promise<BarcodeEngine> {
  const { BrowserMultiFormatReader, HTMLCanvasElementLuminanceSource } =
    await import("@zxing/browser");
  const { DecodeHintType, BarcodeFormat, BinaryBitmap, HybridBinarizer, MultiFormatReader } =
    await import("@zxing/library");

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new MultiFormatReader();
  reader.setHints(hints);

  return {
    name: "zxing",
    async detect(source) {
      try {
        let canvas: HTMLCanvasElement;

        if (source instanceof HTMLCanvasElement) {
          canvas = source;
        } else if (source instanceof HTMLVideoElement) {
          canvas = document.createElement("canvas");
          canvas.width = source.videoWidth;
          canvas.height = source.videoHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(source, 0, 0);
        } else {
          // ImageBitmap
          canvas = document.createElement("canvas");
          canvas.width = (source as ImageBitmap).width;
          canvas.height = (source as ImageBitmap).height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(source as ImageBitmap, 0, 0);
        }

        const luminance = new HTMLCanvasElementLuminanceSource(canvas);
        const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
        const result = reader.decode(bitmap);
        const code = result.getText();

        if (code) {
          return [{ rawValue: code, format: "unknown" }];
        }
        return [];
      } catch {
        return [];
      }
    },
    dispose() {
      /* ZXing reader는 stateless */
    },
  };
}

// ── 팩토리: 최적 엔진 자동 선택 ──

export async function createBarcodeEngine(): Promise<BarcodeEngine> {
  // 1) Native BarcodeDetector (Chrome Android, macOS Chrome 등)
  if (isNativeBarcodeDetectorAvailable()) {
    try {
      const engine = await createNativeEngine();
      console.log("[BarcodeEngine] ✅ Native BarcodeDetector API 사용");
      return engine;
    } catch (e) {
      console.warn("[BarcodeEngine] Native 초기화 실패, ZBar로 폴백:", e);
    }
  }

  // 2) ZBar WASM Polyfill
  try {
    const engine = await createZBarEngine();
    console.log("[BarcodeEngine] ✅ ZBar WASM Polyfill 사용");
    return engine;
  } catch (e) {
    console.warn("[BarcodeEngine] ZBar WASM 초기화 실패, ZXing으로 폴백:", e);
  }

  // 3) ZXing-JS (최후 수단)
  try {
    const engine = await createZXingEngine();
    console.log("[BarcodeEngine] ⚠️ ZXing-JS 폴백 사용 (성능 제한)");
    return engine;
  } catch (e) {
    throw new Error(`바코드 엔진 초기화 실패: ${e}`);
  }
}

/**
 * 단일 이미지에서 바코드를 디코딩하는 헬퍼 (이미지 업로드용)
 * 여러 번 시도: 원본 → 전처리 적용
 */
export async function decodeFromImage(canvas: HTMLCanvasElement): Promise<DetectedBarcode[]> {
  const engine = await createBarcodeEngine();
  try {
    return await engine.detect(canvas);
  } finally {
    engine.dispose();
  }
}
