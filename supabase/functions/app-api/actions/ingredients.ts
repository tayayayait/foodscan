import { PUBLIC_INGREDIENT_URL } from "../_shared/runtime.ts";
import { fetchFoodSafetyApi } from "../_shared/food-safety-api.ts";
import { fetchPublicDataApi } from "../_shared/public-data-api.ts";
import { firstString, normalizeComparable, uniqueStrings } from "../_shared/normalizers.ts";
import type { AdditiveInfo, I0950Row, I2520Row, IngredientInfo } from "../_shared/types.ts";

export const ingredientFromPublicDataRow = (row: Record<string, unknown>): IngredientInfo => ({
  name: firstString(row, ["RPRSNT_RAWMTRL_NM", "rprsntRawmtrlNm"]) ?? "",
  largeClass: firstString(row, ["LCLAS_NM", "RAWMTRL_LCLAS_NM"]),
  middleClass: firstString(row, ["MLSFC_NM", "RAWMTRL_MLSFC_NM"]),
  alias: firstString(row, ["RAWMTRL_NCKNM"]),
  englishName: firstString(row, ["ENG_NM"]),
  scientificName: firstString(row, ["SCNM"]),
  partName: firstString(row, ["REGN_CD_NM"]),
  condition: firstString(row, ["USE_CND_NM", "RAWMTRL_STATS_CD_NM"]),
  source: "public_data",
});

export const ingredientFromFoodSafetyCodeRow = (row: I2520Row): IngredientInfo => ({
  name: row.RPRSNT_RAWMTRL_NM ?? "",
  code: row.RAWMTRL_CD,
  largeClass: row.RAWMTRL_LCLAS_NM,
  middleClass: row.RAWMTRL_MLSFC_NM,
  alias: row.RAWMTRL_NCKNM,
  englishName: row.ENG_NM,
  scientificName: row.SCNM,
  partName: row.REGN_CD_NM,
  condition: row.RAWMTRL_STATS_CD_NM,
  usable: row.USE_YN ? row.USE_YN === "Y" : undefined,
  source: "food_safety_code",
});

export const scoreIngredientInfo = (info: IngredientInfo, query: string) => {
  if (info.name.trim() === query.trim()) return 5;
  const target = normalizeComparable(query);
  const name = normalizeComparable(info.name);
  const alias = normalizeComparable(info.alias);
  if (name === target) return 4;
  if (name.includes(target) || target.includes(name)) return 3;
  if (alias && (alias.includes(target) || target.includes(alias))) return 2;
  return 0;
};

export const lookupIngredientInfoInternal = async (
  ingredientName: string,
): Promise<IngredientInfo | null> => {
  const [publicResult, codeResult] = await Promise.all([
    fetchPublicDataApi<Record<string, unknown>>(PUBLIC_INGREDIENT_URL, {
      pageNo: 1,
      numOfRows: 10,
      rprsnt_rawmtrl_nm: ingredientName,
    }),
    fetchFoodSafetyApi<I2520Row>("I2520", 1, 10, { RPRSNT_RAWMTRL_NM: ingredientName }),
  ]);

  const publicInfos = publicResult.ok ? publicResult.rows.map(ingredientFromPublicDataRow) : [];
  const codeInfos = codeResult.ok ? codeResult.rows.map(ingredientFromFoodSafetyCodeRow) : [];
  const allInfos = [...codeInfos, ...publicInfos].filter((info) => info.name);
  if (allInfos.length === 0) return null;

  return allInfos.sort(
    (a, b) => scoreIngredientInfo(b, ingredientName) - scoreIngredientInfo(a, ingredientName),
  )[0];
};

export const isAdditiveIngredient = (info: IngredientInfo) => {
  const category = `${info.largeClass ?? ""} ${info.middleClass ?? ""}`;
  return category.includes("식품첨가물");
};

export const lookupAdditiveInfoInternal = async (
  additiveName: string,
): Promise<AdditiveInfo | null> => {
  const ingredientInfo = await lookupIngredientInfoInternal(additiveName);
  if (!ingredientInfo || !isAdditiveIngredient(ingredientInfo)) return null;

  if (!ingredientInfo.code) {
    return {
      name: ingredientInfo.name,
      category: ingredientInfo.middleClass ?? ingredientInfo.largeClass,
      standards: [],
      source: "ingredient_info",
    };
  }

  const result = await fetchFoodSafetyApi<I0950Row>("I0950", 1, 100, {
    PRDLST_CD: ingredientInfo.code,
  });
  if (!result.ok || result.rows.length === 0) {
    return {
      name: ingredientInfo.name,
      code: ingredientInfo.code,
      category: ingredientInfo.middleClass ?? ingredientInfo.largeClass,
      standards: [],
      source: "ingredient_info",
    };
  }

  const firstRow = result.rows[0];
  return {
    name: firstRow.PC_KOR_NM ?? ingredientInfo.name,
    code: firstRow.PRDLST_CD ?? ingredientInfo.code,
    category: ingredientInfo.middleClass ?? ingredientInfo.largeClass,
    standards: result.rows.slice(0, 20).map((row) => ({
      testItem: row.T_KOR_NM,
      detail: row.FNPRT_ITM_NM,
      standardValue: row.SPEC_VAL,
      summary: row.SPEC_VAL_SUMUP,
      unit: row.UNIT_NM,
      harmful: row.INJRY_YN === "Y",
    })),
    source: "food_safety_additive",
  };
};

export const detectAdditivesFromIngredients = async (ingredients: string[]) => {
  const limited = ingredients.slice(0, 20);
  const results = [];
  for (const name of limited) {
    results.push(await lookupAdditiveInfoInternal(name));
  }
  return uniqueStrings(
    results.filter((info): info is AdditiveInfo => Boolean(info)).map((info) => info.name),
  );
};
