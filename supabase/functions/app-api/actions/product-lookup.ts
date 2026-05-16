import {
  createPublicProduct,
  normalizePackageQuantity,
  pickCategory,
  splitIngredients,
} from "../_shared/normalizers.ts";
import { fetchFoodSafetyApi } from "../_shared/food-safety-api.ts";
import type {
  C002Row,
  C005Row,
  C006Row,
  I1250Row,
  I2570Row,
  Product,
  SourceTag,
} from "../_shared/types.ts";

type IngredientLookupResult = { ingredientsText: string; ingredients: string[] };

const emptyIngredientLookup = (): IngredientLookupResult => ({
  ingredientsText: "",
  ingredients: [],
});

const isLivestockProduct = (row: C005Row) => row.INDUTY_NM?.includes("축산물") ?? false;

export const lookupC005Internal = async (barcode: string): Promise<Product | null> => {
  const result = await fetchFoodSafetyApi<C005Row>("C005", 1, 5, { BAR_CD: barcode });
  if (!result.ok || result.rows.length === 0) return null;

  const candidates = [];
  for (const [index, row] of result.rows.entries()) {
    const ingredientInfo = await lookupC005IngredientInfo(row);
    candidates.push({ row, ingredientInfo, index });
  }

  const selected = candidates.sort(
    (a, b) =>
      b.ingredientInfo.ingredients.length - a.ingredientInfo.ingredients.length ||
      b.ingredientInfo.ingredientsText.length - a.ingredientInfo.ingredientsText.length ||
      a.index - b.index,
  )[0];

  const row = selected.row;
  return {
    ...createPublicProduct({
      id: barcode,
      barcode: row.BAR_CD || barcode,
      reportNo: row.PRDLST_REPORT_NO,
      name: row.PRDLST_NM,
      brand: row.BSSH_NM,
      category: row.PRDLST_DCNM,
      quantity: row.POG_DAYCNT,
      confidence: 0.92,
    }),
    ingredientsText: selected.ingredientInfo.ingredientsText || undefined,
    ingredients: selected.ingredientInfo.ingredients,
  };
};

export const lookupI2570Internal = async (barcode: string): Promise<Product | null> => {
  const result = await fetchFoodSafetyApi<I2570Row>("I2570", 1, 5, { BRCD_NO: barcode });
  if (!result.ok || result.rows.length === 0) return null;

  const row = result.rows[0];
  return createPublicProduct({
    id: barcode,
    barcode: row.BRCD_NO || barcode,
    reportNo: row.PRDLST_REPORT_NO,
    name: row.PRDT_NM,
    brand: row.CMPNY_NM,
    category: pickCategory(row.PRDLST_NM, row.HRNK_PRDLST_NM, row.HTRK_PRDLST_NM),
    confidence: 0.9,
  });
};

const lookupIngredientsByService = async <T extends C002Row | C006Row>(
  serviceId: "C002" | "C006",
  reportNo: string,
): Promise<IngredientLookupResult> => {
  const result = await fetchFoodSafetyApi<T>(serviceId, 1, 100, {
    PRDLST_REPORT_NO: reportNo,
  });
  if (!result.ok || result.rows.length === 0) {
    return emptyIngredientLookup();
  }

  const sortedRows = [...result.rows].sort(
    (a, b) =>
      Number.parseInt(a.RAWMTRL_ORDNO || "0", 10) - Number.parseInt(b.RAWMTRL_ORDNO || "0", 10),
  );
  const ingredientsText = sortedRows
    .map((row) => row.RAWMTRL_NM?.trim())
    .filter((value): value is string => Boolean(value))
    .join(", ");

  return {
    ingredientsText,
    ingredients: splitIngredients(ingredientsText),
  };
};

export const lookupC002Internal = async (reportNo: string): Promise<IngredientLookupResult> =>
  lookupIngredientsByService<C002Row>("C002", reportNo);

export const lookupC006Internal = async (reportNo: string): Promise<IngredientLookupResult> =>
  lookupIngredientsByService<C006Row>("C006", reportNo);

const lookupC005IngredientInfo = async (row: C005Row): Promise<IngredientLookupResult> => {
  if (!row.PRDLST_REPORT_NO) return emptyIngredientLookup();

  const primary = isLivestockProduct(row)
    ? await lookupC006Internal(row.PRDLST_REPORT_NO)
    : await lookupC002Internal(row.PRDLST_REPORT_NO);
  if (primary.ingredients.length > 0) return primary;

  return isLivestockProduct(row)
    ? lookupC002Internal(row.PRDLST_REPORT_NO)
    : lookupC006Internal(row.PRDLST_REPORT_NO);
};

export const searchI1250Internal = async (productName: string, limit = 10): Promise<Product[]> => {
  const result = await fetchFoodSafetyApi<I1250Row>("I1250", 1, limit, {
    PRDLST_NM: productName,
  });
  if (!result.ok || result.rows.length === 0) return [];

  return Promise.all(
    result.rows.map(async (row) => {
      const ingredientInfo = row.PRDLST_REPORT_NO
        ? await lookupC002Internal(row.PRDLST_REPORT_NO)
        : { ingredientsText: "", ingredients: [] };
      const id = row.PRDLST_REPORT_NO || `i1250-${row.PRDLST_NM}`;

      return {
        id,
        reportNo: row.PRDLST_REPORT_NO,
        name: row.PRDLST_NM ?? "이름 정보 없음",
        brand: row.BSSH_NM,
        category: row.PRDLST_DCNM,
        quantity: normalizePackageQuantity(row.POG_DAYCNT),
        ingredientsText: ingredientInfo.ingredientsText,
        ingredients: ingredientInfo.ingredients,
        allergens: [],
        additives: [],
        nutrition: {},
        sources: ["public_api"] as SourceTag[],
        status: "public_matched" as const,
        confidence: 0.84,
        updatedAt: new Date().toISOString(),
      };
    }),
  );
};
