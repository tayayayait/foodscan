import { fetchFoodSafetyApi } from "../_shared/food-safety-api.ts";
import { normalizeBarcode, normalizeComparable } from "../_shared/normalizers.ts";
import type { I0490Row, RecallInfo, RecallLookupResult } from "../_shared/types.ts";

export const rowMatchesRecallTarget = (
  row: I0490Row,
  target: { productName: string; brand?: string; barcode?: string; reportNo?: string },
) => {
  if (target.reportNo && row.PRDLST_REPORT_NO === target.reportNo) return true;

  const targetBarcode = normalizeBarcode(target.barcode);
  if (targetBarcode && normalizeBarcode(row.BRCDNO).includes(targetBarcode)) return true;

  const rowName = normalizeComparable(row.PRDTNM);
  const targetName = normalizeComparable(target.productName);
  if (!rowName || !targetName) return false;

  const nameMatches = rowName.includes(targetName) || targetName.includes(rowName);
  if (!nameMatches) return false;

  if (!target.brand) return true;
  const rowBrand = normalizeComparable(row.BSSHNM);
  const targetBrand = normalizeComparable(target.brand);
  return !rowBrand || rowBrand.includes(targetBrand) || targetBrand.includes(rowBrand);
};

export const toRecallInfo = (row: I0490Row): RecallInfo => ({
  reason: row.RTRVLPRVNS || "사유 미기재",
  company: row.BSSHNM || "",
  date: row.CRET_DTM || "",
  grade: row.RTRVL_GRDCD_NM,
});

export const lookupI0490Internal = async (target: {
  productName: string;
  brand?: string;
  barcode?: string;
  reportNo?: string;
}): Promise<RecallLookupResult> => {
  const params = target.reportNo ? { PRDLST_REPORT_NO: target.reportNo } : {};
  const result = await fetchFoodSafetyApi<I0490Row>("I0490", 1, 1000, params);

  if (!result.ok) {
    return {
      recall: null,
      error: true,
      message: result.message ?? result.code ?? "Recall lookup failed",
    };
  }

  const match = result.rows.find((row) => rowMatchesRecallTarget(row, target));
  return {
    recall: match ? toRecallInfo(match) : null,
    error: false,
  };
};
