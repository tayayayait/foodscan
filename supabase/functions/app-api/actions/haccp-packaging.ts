import { splitIngredients } from "../_shared/normalizers.ts";
import { fetchHaccpPackagingApi } from "../_shared/haccp-api.ts";
import type {
  HaccpPackagingInfo,
  HaccpPackagingResponse,
  HaccpPackagingRow,
} from "../_shared/types.ts";

const splitAllergens = (raw?: string) =>
  (raw ?? "")
    .split(/[,;·]/)
    .map((item) => item.trim())
    .filter(Boolean);

export const normalizeHaccpPackagingItems = <T>(
  body?: Pick<NonNullable<HaccpPackagingResponse<T>["body"]>, "items">,
): T[] => {
  const items = body?.items;
  if (!items) return [];
  if (Array.isArray(items)) {
    return items.map((entry) => entry.item).filter((item): item is T => Boolean(item));
  }
  if (Array.isArray(items.item)) return items.item;
  return items.item ? [items.item] : [];
};

export const haccpPackagingFromRow = (row: HaccpPackagingRow): HaccpPackagingInfo => ({
  reportNo: row.prdlstReportNo?.trim() || undefined,
  ingredientsText: row.rawmtrl?.trim() || undefined,
  ingredients: row.rawmtrl ? splitIngredients(row.rawmtrl) : [],
  allergens: splitAllergens(row.allergy),
  imageUrl: row.imgurl1?.trim() || row.imgurl2?.trim() || undefined,
  quantity: row.capacity?.trim() || undefined,
});

export const lookupHaccpPackagingInternal = async (
  reportNo: string,
): Promise<HaccpPackagingInfo | null> => {
  const result = await fetchHaccpPackagingApi<HaccpPackagingRow>({
    prdlstReportNo: reportNo,
    pageNo: 1,
    numOfRows: 5,
  });
  if (!result.ok || result.rows.length === 0) return null;

  const matching =
    result.rows.find((row) => row.prdlstReportNo?.trim() === reportNo.trim()) ?? result.rows[0];
  return haccpPackagingFromRow(matching);
};

export const lookupHaccpPackagingByBarcodeInternal = async (
  barcode: string,
): Promise<HaccpPackagingInfo | null> => {
  const result = await fetchHaccpPackagingApi<HaccpPackagingRow>({
    barcode,
    pageNo: 1,
    numOfRows: 5,
  });
  if (!result.ok || result.rows.length === 0) return null;

  const matching =
    result.rows.find((row) => row.barcode?.trim() === barcode.trim()) ?? result.rows[0];
  return haccpPackagingFromRow(matching);
};
