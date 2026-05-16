import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scanSource = () => readFileSync(new URL("./scan.tsx", import.meta.url), "utf8");

describe("scan lookup inputs", () => {
  it("does not expose photo lookup controls", () => {
    const source = scanSource();

    expect(source).toContain("바코드 번호 입력");
    expect(source).not.toContain('key: "photo"');
    expect(source).not.toContain("바코드 사진으로 인식");
    expect(source).not.toContain("사진 분석");
    expect(source).not.toContain("ScanPhotoUploader");
  });

  it("keeps detected barcode editable until the user submits search", () => {
    const source = scanSource();

    expect(source).toContain("const handleDetectedBarcode");
    expect(source).toContain('setManualCode(code.replace(/\\D/g, "").slice(0, 14))');
    expect(source).toContain("useBarcodeScanner(videoRef, handleDetectedBarcode");
    expect(source).not.toContain('useBarcodeScanner(videoRef, (code) => nav({ to: "/product/$id"');
  });
});
