import { requestSupabase } from "../_shared/supabase-rest.ts";
import { firstNumber, firstString, normalizeComparable } from "../_shared/normalizers.ts";
import { fetchPublicDataApi } from "../_shared/public-data-api.ts";
import { PUBLIC_NUTRITION_URL } from "../_shared/runtime.ts";
import type {
  Nutrition,
  NutritionLookupResult,
  NutritionProductRow,
  Product,
} from "../_shared/types.ts";

export const normalizeNutritionRow = (row: Record<string, unknown>): Nutrition => ({
  energyKcal: firstNumber(row, ["enerc", "energyKcal", "NUTR_CONT1", "AMT_NUM1", "열량"]),
  sugarsG: firstNumber(row, ["sugar", "sugarsG", "NUTR_CONT5", "AMT_NUM7", "당류"]),
  sodiumMg: firstNumber(row, ["nat", "sodiumMg", "NUTR_CONT6", "AMT_NUM14", "나트륨"]),
  saturatedFatG: firstNumber(row, ["fasat", "saturatedFatG", "NUTR_CONT4", "AMT_NUM4", "포화지방"]),
  proteinG: firstNumber(row, ["prot", "proteinG", "NUTR_CONT3", "AMT_NUM3", "단백질"]),
  servingSize: firstString(row, [
    "servSize",
    "servingSize",
    "nutConSrtrQua",
    "1회제공량",
    "총내용량",
  ]),
});

export const normalizeNutritionKey = (value?: string) =>
  (value ?? "")
    .replace(/\uFEFF/g, "")
    .toLowerCase()
    .replace(/[\s()[\]{}·ㆍ,./\\_-]+/g, "")
    .replace(/주식회사/g, "주")
    .replace(/㈜/g, "주");

const uniqueValues = (values: string[]) => [...new Set(values.filter(Boolean))];

const manufacturerLookupTokens = (brand?: string) => {
  const normalizedBrand = normalizeNutritionKey(brand);
  if (!normalizedBrand) return [];

  const withoutCorporatePrefix = normalizedBrand.replace(/^주/, "");
  return uniqueValues([normalizedBrand, withoutCorporatePrefix]).filter(
    (token) => token.length >= 2,
  );
};

export const buildNutritionNameLookupKeys = (productName: string, brand?: string) => {
  const normalizedName = normalizeNutritionKey(productName);
  if (!normalizedName) return [];

  const strippedNames = manufacturerLookupTokens(brand)
    .filter((token) => normalizedName.startsWith(token))
    .map((token) => normalizedName.slice(token.length))
    .filter((name) => name.length >= 3);

  return uniqueValues([normalizedName, ...strippedNames]);
};

export const localNutritionRowToResult = (
  row: NutritionProductRow,
  matched: boolean,
): NutritionLookupResult | null => {
  const nutrition: Nutrition = {
    energyKcal: firstNumber({ value: row.energy_kcal }, ["value"]),
    sugarsG: firstNumber({ value: row.sugars_g }, ["value"]),
    sodiumMg: firstNumber({ value: row.sodium_mg }, ["value"]),
    saturatedFatG: firstNumber({ value: row.saturated_fat_g }, ["value"]),
    proteinG: firstNumber({ value: row.protein_g }, ["value"]),
    servingSize: row.serving_size ?? row.basis_amount ?? undefined,
  };

  if (!nutritionHasValues(nutrition)) return null;

  return {
    nutrition,
    matched,
    foodName: row.name,
    manufacturer: row.manufacturer ?? undefined,
    source: "local_nutrition_db",
  };
};

export const nutritionProductRowToProduct = (row: NutritionProductRow): Product => ({
  id: row.report_no || row.food_code,
  ...(row.report_no ? { reportNo: row.report_no } : {}),
  name: row.name,
  ...(row.manufacturer ? { brand: row.manufacturer } : {}),
  ...(row.category || row.small_category || row.representative_food || row.large_category
    ? {
        category:
          row.category ||
          row.small_category ||
          row.representative_food ||
          row.large_category ||
          undefined,
      }
    : {}),
  ...(row.food_weight || row.serving_size || row.basis_amount
    ? { quantity: row.food_weight || row.serving_size || row.basis_amount || undefined }
    : {}),
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: {
    energyKcal: firstNumber({ value: row.energy_kcal }, ["value"]),
    sugarsG: firstNumber({ value: row.sugars_g }, ["value"]),
    sodiumMg: firstNumber({ value: row.sodium_mg }, ["value"]),
    saturatedFatG: firstNumber({ value: row.saturated_fat_g }, ["value"]),
    proteinG: firstNumber({ value: row.protein_g }, ["value"]),
    servingSize: row.serving_size ?? row.basis_amount ?? undefined,
  },
  sources: ["public_api"],
  status: "public_matched",
  confidence: row.report_no ? 0.9 : 0.84,
  updatedAt: new Date().toISOString(),
});

export const nutritionHasValues = (nutrition: Nutrition) =>
  Object.values(nutrition).some((value) => value !== undefined && value !== "");

export const nutritionNeedsEnrichment = (nutrition: Nutrition) =>
  nutrition.energyKcal === undefined ||
  nutrition.sugarsG === undefined ||
  nutrition.sodiumMg === undefined ||
  nutrition.saturatedFatG === undefined ||
  nutrition.proteinG === undefined;

export const scoreNutritionRow = (
  row: Record<string, unknown>,
  target: { productName: string; brand?: string },
) => {
  const rowName = normalizeComparable(firstString(row, ["foodNm", "FOOD_NM", "PRDLST_NM"]));
  const targetName = normalizeComparable(target.productName);
  const rowMaker = normalizeComparable(firstString(row, ["mfrNm", "MFR_NM", "BSSH_NM", "imptNm"]));
  const targetBrand = normalizeComparable(target.brand);

  let score = 0;
  if (rowName && targetName && rowName === targetName) score += 5;
  else if (
    rowName &&
    targetName &&
    (rowName.includes(targetName) || targetName.includes(rowName))
  ) {
    score += 3;
  }
  if (
    rowMaker &&
    targetBrand &&
    (rowMaker.includes(targetBrand) || targetBrand.includes(rowMaker))
  ) {
    score += 2;
  }
  return score;
};

export const scoreLocalNutritionRow = (
  row: NutritionProductRow,
  target: {
    productName: string;
    brand?: string;
    reportNo?: string;
    nutrition?: Nutrition;
    flavorText?: string;
  },
) => {
  const targetName = normalizeNutritionKey(target.productName);
  const targetBrand = normalizeNutritionKey(target.brand);
  let score = 0;

  if (target.reportNo && row.report_no === target.reportNo) score += 10;
  if (row.normalized_name && targetName && row.normalized_name === targetName) score += 5;
  else if (
    row.normalized_name &&
    targetName &&
    (row.normalized_name.includes(targetName) || targetName.includes(row.normalized_name))
  ) {
    score += 3;
  }
  if (
    row.normalized_manufacturer &&
    targetBrand &&
    (row.normalized_manufacturer.includes(targetBrand) ||
      targetBrand.includes(row.normalized_manufacturer))
  ) {
    score += 2;
  }
  score += scoreNutritionSimilarity(row, target.nutrition);
  score += scoreFlavorHint(row, target.flavorText);
  return score;
};

const scoreNutritionSimilarity = (row: NutritionProductRow, nutrition?: Nutrition) => {
  if (!nutrition) return 0;

  const pairs: Array<[number | null | undefined, number | undefined]> = [
    [row.energy_kcal, nutrition.energyKcal],
    [row.sugars_g, nutrition.sugarsG],
    [row.protein_g, nutrition.proteinG],
  ];

  return pairs.reduce((score, [rowValue, targetValue]) => {
    if (rowValue === null || rowValue === undefined || targetValue === undefined) return score;
    const delta = Math.abs(rowValue - targetValue);
    const tolerance = Math.max(0.2, Math.abs(targetValue) * 0.02);
    return score + (delta <= tolerance ? 2 : 0);
  }, 0);
};

const FLAVOR_HINTS = [
  { hints: ["redpepperpaste", "gochujang"], rowTerms: ["고추장"] },
  { hints: ["chipotle"], rowTerms: ["치폴레"] },
  { hints: ["barbecue", "bbq", "rib"], rowTerms: ["바베큐", "폭립"] },
  { hints: ["soysaucechicken"], rowTerms: ["간장치킨"] },
  { hints: ["onioncreamcheese"], rowTerms: ["양파크림치즈"] },
];

const scoreFlavorHint = (row: NutritionProductRow, flavorText?: string) => {
  const targetFlavor = normalizeNutritionKey(flavorText);
  if (!targetFlavor) return 0;

  const rowName = row.normalized_name || normalizeNutritionKey(row.name);
  return FLAVOR_HINTS.some(
    ({ hints, rowTerms }) =>
      hints.some((hint) => targetFlavor.includes(hint)) &&
      rowTerms.some((term) => rowName.includes(term)),
  )
    ? 4
    : 0;
};

export const localNutritionSelect =
  "food_code,report_no,name,normalized_name,manufacturer,normalized_manufacturer,category,large_category,representative_food,small_category,basis_amount,serving_size,food_weight,energy_kcal,sugars_g,sodium_mg,saturated_fat_g,protein_g,source_name,data_basis_date";

export const lookupNutritionProductRows = async (
  params: Record<string, string>,
  limit = 20,
): Promise<NutritionProductRow[]> =>
  (await requestSupabase<NutritionProductRow[]>("nutrition_products", {
    method: "GET",
    params: {
      select: localNutritionSelect,
      limit: String(Math.min(Math.max(limit, 1), 50)),
      ...params,
    },
  })) ?? [];

export const lookupNutritionLocalInternal = async (
  productName: string,
  brand?: string,
  reportNo?: string,
  nutrition?: Nutrition,
  flavorText?: string,
): Promise<NutritionLookupResult | null> => {
  const rows: NutritionProductRow[] = [];
  const nameLookupKeys = buildNutritionNameLookupKeys(productName, brand);

  if (reportNo) {
    rows.push(...(await lookupNutritionProductRows({ report_no: `eq.${reportNo}` })));
  }
  for (const nameLookupKey of nameLookupKeys) {
    if (rows.length > 0) break;
    rows.push(
      ...(await lookupNutritionProductRows({ normalized_name: `eq.${nameLookupKey}` })),
    );
  }
  for (const nameLookupKey of nameLookupKeys) {
    if (rows.length > 0 || nameLookupKey.length < 3) continue;
    rows.push(
      ...(await lookupNutritionProductRows({ normalized_name: `ilike.*${nameLookupKey}*` })),
    );
  }
  if (rows.length === 0) return null;

  const bestRow = [...rows].sort(
    (a, b) =>
      scoreLocalNutritionRow(b, { productName, brand, reportNo, nutrition, flavorText }) -
      scoreLocalNutritionRow(a, { productName, brand, reportNo, nutrition, flavorText }),
  )[0];
  const score = scoreLocalNutritionRow(bestRow, {
    productName,
    brand,
    reportNo,
    nutrition,
    flavorText,
  });
  return localNutritionRowToResult(bestRow, score > 0);
};

export const lookupNutritionStandardInternal = async (
  productName: string,
  brand?: string,
  reportNo?: string,
  currentNutrition?: Nutrition,
  flavorText?: string,
): Promise<NutritionLookupResult | null> => {
  const localNutrition = await lookupNutritionLocalInternal(
    productName,
    brand,
    reportNo,
    currentNutrition,
    flavorText,
  );
  if (localNutrition) return localNutrition;

  const primaryParams = reportNo
    ? { pageNo: 1, numOfRows: 10, itemMnftrRptNo: reportNo }
    : { pageNo: 1, numOfRows: 10, foodNm: productName };
  let result = await fetchPublicDataApi<Record<string, unknown>>(
    PUBLIC_NUTRITION_URL,
    primaryParams,
  );

  if (reportNo && (!result.ok || result.rows.length === 0)) {
    result = await fetchPublicDataApi<Record<string, unknown>>(PUBLIC_NUTRITION_URL, {
      pageNo: 1,
      numOfRows: 10,
      foodNm: productName,
    });
  }

  if (!result.ok || result.rows.length === 0) return null;

  const bestRow = [...result.rows].sort(
    (a, b) =>
      scoreNutritionRow(b, { productName, brand }) - scoreNutritionRow(a, { productName, brand }),
  )[0];
  const nutrition = normalizeNutritionRow(bestRow);
  if (!nutritionHasValues(nutrition)) return null;

  return {
    nutrition,
    matched: scoreNutritionRow(bestRow, { productName, brand }) > 0,
    foodName: firstString(bestRow, ["foodNm", "FOOD_NM", "PRDLST_NM"]),
    manufacturer: firstString(bestRow, ["mfrNm", "MFR_NM", "BSSH_NM", "imptNm"]),
    source: "public_nutrition",
  };
};

export const mergeNutrition = (base: Nutrition, incoming: Nutrition): Nutrition => ({
  energyKcal: base.energyKcal ?? incoming.energyKcal,
  sugarsG: base.sugarsG ?? incoming.sugarsG,
  sodiumMg: base.sodiumMg ?? incoming.sodiumMg,
  saturatedFatG: base.saturatedFatG ?? incoming.saturatedFatG,
  proteinG: base.proteinG ?? incoming.proteinG,
  servingSize: base.servingSize ?? incoming.servingSize,
});

export const mergeNutritionPreferIncoming = (base: Nutrition, incoming: Nutrition): Nutrition => ({
  energyKcal: incoming.energyKcal ?? base.energyKcal,
  sugarsG: incoming.sugarsG ?? base.sugarsG,
  sodiumMg: incoming.sodiumMg ?? base.sodiumMg,
  saturatedFatG: incoming.saturatedFatG ?? base.saturatedFatG,
  proteinG: incoming.proteinG ?? base.proteinG,
  servingSize: incoming.servingSize ?? base.servingSize,
});
