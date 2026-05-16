/**
 * 바코드 유틸리티 — EAN-13/EAN-8/UPC-A 체크섬 검증
 */

/** EAN-13 체크섬 검증 */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const d = code.split("").map(Number);
  const sum = d.slice(0, 12).reduce((s, v, i) => s + v * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === d[12];
}

/** EAN-8 체크섬 검증 */
export function isValidEan8(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  const d = code.split("").map(Number);
  const sum = d.slice(0, 7).reduce((s, v, i) => s + v * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === d[7];
}

/** UPC-A 체크섬 검증 */
export function isValidUpcA(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  const d = code.split("").map(Number);
  const sum = d.slice(0, 11).reduce((s, v, i) => s + v * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === d[11];
}

/** 바코드 유효성 검사 (EAN-13, EAN-8, UPC-A 또는 숫자 8~14자리) */
export function isValidBarcode(code: string): boolean {
  if (isValidEan13(code) || isValidEan8(code) || isValidUpcA(code)) return true;
  // 체크섬 미검증이지만 숫자 8~14자리면 허용 (CODE-128 등)
  return /^\d{8,14}$/.test(code);
}

/** 바코드 형식 이름 반환 */
export function getBarcodeFormatName(code: string): string | null {
  if (isValidEan13(code)) return "EAN-13";
  if (isValidEan8(code)) return "EAN-8";
  if (isValidUpcA(code)) return "UPC-A";
  if (/^\d{8,14}$/.test(code)) return "CODE";
  return null;
}
