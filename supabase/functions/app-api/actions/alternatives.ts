import { lookupI0490Internal } from "./recall.ts";
import {
  lookupNutritionProductRows,
  normalizeNutritionKey,
  nutritionProductRowToProduct,
} from "./nutrition.ts";
import type { NutritionProductRow, Product } from "../_shared/types.ts";

export const nutritionRowKey = (row: NutritionProductRow) => row.report_no || row.food_code;

const sameComparableContext = (baseValue?: string | null, candidateValue?: string | null) => {
  const base = normalizeNutritionKey(baseValue ?? "");
  const candidate = normalizeNutritionKey(candidateValue ?? "");
  if (!base || !candidate) return true;
  return base === candidate || base.includes(candidate) || candidate.includes(base);
};

const minimumProductLineLength = (value: string) => (/[가-힣]/u.test(value) ? 3 : 4);

const hasSubstantialNameContainment = (baseName: string, candidateName: string) => {
  const shorter = baseName.length <= candidateName.length ? baseName : candidateName;
  const longer = baseName.length <= candidateName.length ? candidateName : baseName;
  return shorter.length >= minimumProductLineLength(shorter) && longer.includes(shorter);
};

const rowCategory = (row: NutritionProductRow) =>
  row.category || row.small_category || row.representative_food || row.large_category;

export const isSameNutritionRow = (row: NutritionProductRow, product: Product) => {
  if (product.reportNo && row.report_no === product.reportNo) return true;
  if (row.food_code === product.id || row.report_no === product.id) return true;

  const rowName = row.normalized_name || normalizeNutritionKey(row.name);
  const productName = normalizeNutritionKey(product.name);
  const rowBrand = row.normalized_manufacturer || normalizeNutritionKey(row.manufacturer ?? "");
  const productBrand = normalizeNutritionKey(product.brand);
  if (!rowName || !productName) return false;
  if (rowName === productName) {
    return !productBrand || !rowBrand || rowBrand === productBrand;
  }
  if (!hasSubstantialNameContainment(rowName, productName)) return false;
  return (
    sameComparableContext(rowBrand, productBrand) &&
    sameComparableContext(rowCategory(row), product.category)
  );
};

export const categorySearchParams = (product: Product, baseRow?: NutritionProductRow) => {
  const productCategory = product.category?.trim();
  const baseCategory = baseRow?.category?.trim();
  const baseCategoryMatchesProduct =
    !productCategory ||
    !baseCategory ||
    normalizeNutritionKey(productCategory) === normalizeNutritionKey(baseCategory);
  const params = [
    { field: "category", value: productCategory },
    { field: "small_category", value: productCategory },
    { field: "small_category", value: baseRow?.small_category },
    { field: "representative_food", value: baseRow?.representative_food },
    { field: "category", value: baseCategoryMatchesProduct ? baseCategory : undefined },
    { field: "large_category", value: baseRow?.large_category },
  ];
  const seen = new Set<string>();
  return params.filter((param): param is { field: string; value: string } => {
    if (!param.value) return false;
    const key = `${param.field}:${param.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const attachRecallInfo = async (product: Product): Promise<Product> => {
  const recall = await lookupI0490Internal({
    productName: product.name,
    brand: product.brand,
    barcode: product.barcode,
    reportNo: product.reportNo,
  });
  return recall.recall ? { ...product, recall: recall.recall } : product;
};

export const searchAlternativeCandidatesInternal = async (
  product: Product,
  requestedLimit = 20,
): Promise<Product[]> => {
  const limit = Math.min(Math.max(Math.trunc(requestedLimit), 1), 50);
  const rows: NutritionProductRow[] = [];
  const seen = new Set<string>();

  const addRows = async (params: Record<string, string>) => {
    const incomingRows = await lookupNutritionProductRows(params, limit);
    for (const row of incomingRows) {
      const key = nutritionRowKey(row);
      if (seen.has(key) || isSameNutritionRow(row, product)) continue;
      seen.add(key);
      rows.push(row);
    }
  };

  const baseRows = product.reportNo
    ? await lookupNutritionProductRows({ report_no: `eq.${product.reportNo}` }, 1)
    : [];
  const baseRow = baseRows[0];

  for (const param of categorySearchParams(product, baseRow)) {
    if (rows.length >= limit) break;
    await addRows({ [param.field]: `eq.${param.value}` });
  }

  const normalizedName = normalizeNutritionKey(product.name);
  if (rows.length < limit && normalizedName.length >= 3) {
    await addRows({ normalized_name: `ilike.*${normalizedName}*` });
  }

  const candidates = rows.slice(0, limit).map(nutritionProductRowToProduct);
  const recallCheckLimit = Math.min(candidates.length, 12);
  const checkedCandidates = await Promise.all(
    candidates.slice(0, recallCheckLimit).map(attachRecallInfo),
  );
  return [...checkedCandidates, ...candidates.slice(recallCheckLimit)];
};
