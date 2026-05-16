export type EnvLike = Record<string, string | undefined>;
export type SourceTag =
  | "verified"
  | "public_api"
  | "open_db"
  | "ai_estimated"
  | "user_submitted"
  | "shopping";
export type ProductStatus =
  | "verified"
  | "public_matched"
  | "open_db_matched"
  | "provisional"
  | "needs_review";
export type ReviewReason =
  | "ocr_low_confidence"
  | "user_submitted"
  | "ambiguous_match"
  | "unknown_additive"
  | "api_enrichment_failed";
export type ReviewStatus = "pending" | "in_review" | "approved" | "rejected";
export type ReviewQueueListStatus = ReviewStatus | "all";
export type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface Nutrition {
  energyKcal?: number;
  sugarsG?: number;
  sodiumMg?: number;
  saturatedFatG?: number;
  proteinG?: number;
  servingSize?: string;
}

export interface RecallInfo {
  reason: string;
  company: string;
  date: string;
  grade?: string;
}

export interface ShoppingOffer {
  minPrice?: number;
  maxPrice?: number;
  priceText?: string;
  mallName?: string;
  link?: string;
  productId?: string;
  productType?: string;
}

export interface Product {
  id: string;
  barcode?: string;
  reportNo?: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  submittedImageUrls?: {
    product?: string;
    nutrition?: string;
    ingredients?: string;
  };
  quantity?: string;
  ingredientsText?: string;
  ingredients: string[];
  allergens: string[];
  additives: string[];
  nutrition: Nutrition;
  sources: SourceTag[];
  status: ProductStatus;
  confidence: number;
  recall?: RecallInfo;
  shoppingOffer?: ShoppingOffer;
  updatedAt: string;
}

export interface OpenFoodFactsProduct {
  code?: string;
  product_name?: string;
  product_name_ko?: string;
  product_name_en?: string;
  brands?: string;
  categories?: string;
  image_front_url?: string;
  image_url?: string;
  quantity?: string;
  ingredients_text?: string;
  ingredients_text_ko?: string;
  ingredients_text_en?: string;
  allergens_tags?: string[];
  additives_tags?: string[];
  nutriments?: Record<string, number | string>;
  serving_size?: string;
}

export interface OpenFoodFactsSearchResponse {
  products?: OpenFoodFactsProduct[];
}

export interface OpenFoodFactsProductResponse {
  status?: number;
  product?: OpenFoodFactsProduct;
}

export interface SupabaseProductRow {
  id: string;
  barcode: string | null;
  report_no: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  submitted_image_urls: Product["submittedImageUrls"] | null;
  quantity: string | null;
  ingredients_text: string | null;
  ingredients: string[];
  allergens: string[];
  additives: string[];
  nutrition: Nutrition;
  sources: SourceTag[];
  status: ProductStatus;
  confidence: number;
  recall: RecallInfo | null;
  updated_at: string;
}

export interface ReviewQueueRow {
  id: string;
  product_id: string;
  product_snapshot: Product;
  raw_payload: JsonValue | null;
  reason: ReviewReason;
  status: ReviewStatus;
  confidence: number;
  risk_flags: string[];
  created_at: string;
  updated_at: string;
}

export interface ReviewQueueItem {
  id: string;
  productId: string;
  product: Product;
  rawPayload: JsonValue | null;
  reason: ReviewReason;
  reasonLabel: string;
  status: ReviewStatus;
  statusLabel: string;
  confidence: number;
  riskFlags: string[];
  riskLabels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SupabaseRestConfig {
  restUrl: string;
  apiKey: string;
}

export interface FoodSafetyResponse<T> {
  [serviceId: string]: {
    total_count?: string;
    row?: T[];
    RESULT?: { CODE?: string; MSG?: string };
  };
}

export interface ApiResult<T> {
  ok: boolean;
  rows: T[];
  code?: string;
  message?: string;
}

export interface C005Row {
  PRDLST_REPORT_NO?: string;
  PRDLST_NM?: string;
  BAR_CD?: string;
  POG_DAYCNT?: string;
  PRDLST_DCNM?: string;
  BSSH_NM?: string;
  INDUTY_NM?: string;
}

export interface I2570Row {
  PRDLST_REPORT_NO?: string;
  BRCD_NO?: string;
  PRDLST_NM?: string;
  PRDT_NM?: string;
  CMPNY_NM?: string;
  HTRK_PRDLST_NM?: string;
  HRNK_PRDLST_NM?: string;
}

export interface I1250Row {
  PRDLST_REPORT_NO?: string;
  PRDLST_NM?: string;
  BSSH_NM?: string;
  PRDLST_DCNM?: string;
  POG_DAYCNT?: string;
  PRMS_DT?: string;
}

export interface C002Row {
  PRDLST_REPORT_NO?: string;
  RAWMTRL_NM?: string;
  RAWMTRL_ORDNO?: string;
}

export interface C006Row {
  PRDLST_REPORT_NO?: string;
  RAWMTRL_NM?: string;
  RAWMTRL_ORDNO?: string;
}

export interface I0490Row {
  PRDTNM?: string;
  RTRVLPRVNS?: string;
  BSSHNM?: string;
  BRCDNO?: string;
  FRMLCUNIT?: string;
  IMG_FILE_PATH?: string;
  CRET_DTM?: string;
  PRDLST_REPORT_NO?: string;
  RTRVL_GRDCD_NM?: string;
}

export interface I2520Row {
  RAWMTRL_CD?: string;
  RAWMTRL_LCLAS_NM?: string;
  RAWMTRL_MLSFC_NM?: string;
  RPRSNT_RAWMTRL_NM?: string;
  RAWMTRL_NCKNM?: string;
  ENG_NM?: string;
  SCNM?: string;
  REGN_CD_NM?: string;
  PRCSS_PROCS_CD_NM?: string;
  RAWMTRL_STATS_CD_NM?: string;
  USE_YN?: string;
}

export interface I0950Row {
  PRDLST_CD?: string;
  PC_KOR_NM?: string;
  TESTITM_CD?: string;
  T_KOR_NM?: string;
  FNPRT_ITM_NM?: string;
  SPEC_VAL?: string;
  SPEC_VAL_SUMUP?: string;
  VALD_BEGN_DT?: string;
  VALD_END_DT?: string;
  SORC?: string;
  MXMM_VAL?: string;
  MIMM_VAL?: string;
  INJRY_YN?: string;
  UNIT_NM?: string;
}

export interface PublicDataResponse<T> {
  response?: {
    header?: { resultCode?: string; resultMsg?: string; type?: string };
    body?: { items?: T[] | { item?: T | T[] }; totalCount?: string | number };
  };
  header?: { resultCode?: string; resultMsg?: string };
  body?: { items?: T[] | { item?: T | T[] }; totalCount?: string | number };
}

export interface HaccpPackagingRow {
  rnum?: string;
  prdlstReportNo?: string;
  productGb?: string;
  prdlstNm?: string;
  rawmtrl?: string;
  allergy?: string;
  nutrient?: string;
  barcode?: string;
  prdkind?: string;
  prdkindstate?: string;
  manufacture?: string;
  seller?: string;
  capacity?: string;
  imgurl1?: string;
  imgurl2?: string;
}

export interface HaccpPackagingResponse<T> {
  header?: {
    resultCode?: string;
    resultMessage?: string;
  };
  body?: {
    numOfRows?: string;
    pageNo?: string;
    totalCount?: string;
    items?: Array<{ item?: T }> | { item?: T | T[] };
  };
}

export interface HaccpPackagingInfo {
  reportNo?: string;
  ingredientsText?: string;
  ingredients: string[];
  allergens: string[];
  imageUrl?: string;
  quantity?: string;
}

export interface IngredientInfo {
  name: string;
  code?: string;
  largeClass?: string;
  middleClass?: string;
  alias?: string;
  englishName?: string;
  scientificName?: string;
  partName?: string;
  condition?: string;
  usable?: boolean;
  source: "public_data" | "food_safety_code";
}

export interface AdditiveStandard {
  testItem?: string;
  detail?: string;
  standardValue?: string;
  summary?: string;
  unit?: string;
  harmful?: boolean;
}

export interface AdditiveInfo {
  name: string;
  code?: string;
  category?: string;
  standards: AdditiveStandard[];
  source: "food_safety_additive" | "ingredient_info";
}

export interface NutritionLookupResult {
  nutrition: Nutrition;
  matched: boolean;
  foodName?: string;
  manufacturer?: string;
  source: "local_nutrition_db" | "public_nutrition";
}

export interface NutritionProductRow {
  food_code: string;
  report_no: string | null;
  name: string;
  normalized_name: string;
  manufacturer: string | null;
  normalized_manufacturer: string | null;
  category: string | null;
  large_category: string | null;
  representative_food: string | null;
  small_category: string | null;
  basis_amount: string | null;
  serving_size: string | null;
  food_weight: string | null;
  energy_kcal: number | string | null;
  sugars_g: number | string | null;
  sodium_mg: number | string | null;
  saturated_fat_g: number | string | null;
  protein_g: number | string | null;
  source_name: string | null;
  data_basis_date: string | null;
}

export interface NaverShoppingItem {
  title?: string;
  link?: string;
  image?: string;
  lprice?: string;
  hprice?: string;
  mallName?: string;
  productId?: string;
  productType?: string;
  brand?: string;
  maker?: string;
  category1?: string;
  category2?: string;
  category3?: string;
  category4?: string;
}

export interface NaverShoppingResponse {
  items?: NaverShoppingItem[];
  errorMessage?: string;
  errorCode?: string;
}

export interface RecallLookupResult {
  recall: RecallInfo | null;
  error: boolean;
  message?: string;
}

export interface GeminiOcrResult {
  productName: string;
  brand: string;
  quantity: string;
  category: string;
  barcode: string;
  ingredientsText: string;
  ingredients: string[];
  allergens: string[];
  additives: string[];
  nutrition: Nutrition;
  confidence: number;
  warnings: string[];
}

export type ProductCandidateSource = "local" | "public_api" | "open_food_facts";

export interface ProductSelectionCandidate {
  source: ProductCandidateSource;
  product: Product;
}

export interface ProductCandidateSelection {
  selectedIndex: number;
  confidence: number;
  reason: string;
  warnings: string[];
}

export interface AlternativeFitDecision {
  productId: string;
  isSubstitute: boolean;
  fitScore: number;
  substituteGroup: string;
  reason: string;
}

export interface AlternativeFitJudgement {
  baseSubstituteGroup: string;
  decisions: AlternativeFitDecision[];
  warnings: string[];
}

export interface GeminiAlternativeRecommendation {
  productId: string;
  fitScore: number;
  substituteGroup: string;
  reason: string;
}

export interface GeminiAlternativeRecommendations {
  baseSubstituteGroup: string;
  recommendations: GeminiAlternativeRecommendation[];
  warnings: string[];
}

export interface GeminiAlternativeShoppingSearch {
  query: string;
  targetFood: string;
  reason: string;
  nutritionFocus: string[];
}

export interface GeminiAlternativeShoppingPlan {
  baseNutritionBurden: string;
  searches: GeminiAlternativeShoppingSearch[];
  warnings: string[];
}

export interface GeminiAlternativeShoppingRecommendation {
  productId: string;
  fitScore: number;
  reason: string;
  nutritionFocus: string[];
}

export interface GeminiAlternativeShoppingVerification {
  recommendations: GeminiAlternativeShoppingRecommendation[];
  warnings: string[];
}

export interface FoodPairingRecommendation {
  foods: string[];
  reason: string;
  nutritionFocus: string[];
  caution?: string;
  fitScore: number;
}

export interface FoodPairingJudgement {
  overallStrategy: string;
  pairings: FoodPairingRecommendation[];
  warnings: string[];
}

export interface ProductKoreanTranslation {
  name: string;
  category: string;
  ingredientsText: string;
  ingredients: string[];
  allergens: string[];
  warnings: string[];
}

export interface AdditiveTermExplanation {
  term: string;
  displayName: string;
  purposeLabel: string;
  consumerSummary: string;
  warnings: string[];
  source: "gemini_estimated";
}

export interface AdditiveTermExplanationResponse {
  explanations: AdditiveTermExplanation[];
  warnings: string[];
}

export interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}
