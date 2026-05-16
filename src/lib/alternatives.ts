import {
  recommendAlternativeProducts,
  recommendAlternativeShoppingSearches,
  searchOpenFoodFacts,
  searchAlternativeCandidates,
  searchNaverShopping,
  verifyAlternativeShoppingResults,
} from "./public-api";
import { computeScore, type ScoreResult } from "./score";
import { DEFAULT_PREFS } from "./storage";
import { isProductCompatibleWithPreferences } from "./preferences";
import type {
  GeminiAlternativeRecommendations,
  GeminiAlternativeShoppingPlan,
  GeminiAlternativeShoppingRecommendation,
  GeminiAlternativeShoppingSearch,
  GeminiAlternativeShoppingVerification,
  Product,
  SourceTag,
  UserPreferences,
} from "./types";

export interface AlternativeRecommendation {
  product: Product;
  score: number | null;
  grade: NonNullable<ScoreResult["grade"]> | null;
  scoreDelta: number | null;
  reasons: string[];
  kind: "scored" | "shopping";
}

const MIN_SCORE_DELTA = 5;
const MIN_RECOMMENDATION_SCORE = 70;
const MIN_ALTERNATIVE_FIT_SCORE = 70;
const SCORE_SOURCE_TAGS = new Set<SourceTag>(["verified", "public_api", "open_db"]);
const productKey = (product: Product) => product.barcode || product.id;

interface GeminiRecommendationContext {
  fitScoreByProductId: Map<string, number>;
  rankByProductId: Map<string, number>;
  reasonByProductId: Map<string, string>;
}

function comparableText(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function sameComparableContext(baseValue: string | undefined, candidateValue: string | undefined) {
  const base = comparableText(baseValue);
  const candidate = comparableText(candidateValue);
  if (!base || !candidate) return true;
  return base === candidate || base.includes(candidate) || candidate.includes(base);
}

function minimumProductLineLength(value: string) {
  return /[가-힣]/u.test(value) ? 3 : 4;
}

function hasSubstantialNameContainment(baseName: string, candidateName: string) {
  const shorter = baseName.length <= candidateName.length ? baseName : candidateName;
  const longer = baseName.length <= candidateName.length ? candidateName : baseName;
  return shorter.length >= minimumProductLineLength(shorter) && longer.includes(shorter);
}

function dedupeKey(product: Product) {
  if (product.barcode) return `barcode:${product.barcode}`;
  return `name:${comparableText(product.name)}:${comparableText(product.brand)}`;
}

function isLikelySameProduct(baseProduct: Product, candidate: Product) {
  if (productKey(candidate) === productKey(baseProduct)) return true;
  if (baseProduct.reportNo && candidate.reportNo && baseProduct.reportNo === candidate.reportNo) {
    return true;
  }

  const baseName = comparableText(baseProduct.name);
  const candidateName = comparableText(candidate.name);
  if (!baseName || !candidateName) return false;
  if (baseName === candidateName) return true;
  if (!hasSubstantialNameContainment(baseName, candidateName)) return false;

  return (
    sameComparableContext(baseProduct.brand, candidate.brand) &&
    sameComparableContext(baseProduct.category, candidate.category)
  );
}

export function dedupeAlternativeCandidates(candidates: Product[]): Product[] {
  const seen = new Set<string>();
  const deduped: Product[] = [];
  for (const candidate of candidates) {
    const keys = [
      candidate.barcode ? `barcode:${candidate.barcode}` : "",
      `name:${comparableText(candidate.name)}:${comparableText(candidate.brand)}`,
    ].filter(Boolean);
    if (keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    deduped.push(candidate);
  }
  return deduped;
}

function geminiRecommendationContext(
  judgement: GeminiAlternativeRecommendations,
): GeminiRecommendationContext {
  const fitScoreByProductId = new Map<string, number>();
  const rankByProductId = new Map<string, number>();
  const reasonByProductId = new Map<string, string>();

  judgement.recommendations.forEach((recommendation, index) => {
    fitScoreByProductId.set(recommendation.productId, recommendation.fitScore);
    rankByProductId.set(recommendation.productId, index);
    if (recommendation.reason) {
      reasonByProductId.set(recommendation.productId, recommendation.reason);
    }
  });

  return { fitScoreByProductId, rankByProductId, reasonByProductId };
}

function rankCandidatesByGeminiRecommendations(
  candidates: Product[],
  context: GeminiRecommendationContext,
  minFitScore = MIN_ALTERNATIVE_FIT_SCORE,
) {
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  return [...context.rankByProductId.entries()]
    .filter(([productId]) => (context.fitScoreByProductId.get(productId) ?? 0) >= minFitScore)
    .sort((a, b) => a[1] - b[1])
    .map(([productId]) => candidatesById.get(productId))
    .filter((candidate): candidate is Product => Boolean(candidate));
}

function sameCategoryPool(baseProduct: Product, candidates: Product[]) {
  const sameCategory = baseProduct.category
    ? candidates.filter((candidate) => candidate.category === baseProduct.category)
    : candidates;
  return sameCategory.length > 0 ? sameCategory : candidates;
}

function hasRequiredScore(score: ScoreResult): score is ScoreResult & {
  score: number;
  grade: NonNullable<ScoreResult["grade"]>;
} {
  return score.computable && score.score !== null && score.grade !== null;
}

function hasRecommendationScoreSource(product: Product) {
  return product.sources.some((source) => SCORE_SOURCE_TAGS.has(source));
}

function isBGradeOrBetter(score: ScoreResult & { score: number }) {
  return score.score >= MIN_RECOMMENDATION_SCORE;
}

function countNutritionImprovement(
  baseProduct: Product,
  candidate: Product,
  key: "energyKcal" | "sugarsG" | "sodiumMg" | "saturatedFatG",
) {
  return baseProduct.nutrition[key] !== undefined &&
    candidate.nutrition[key] !== undefined &&
    candidate.nutrition[key] < baseProduct.nutrition[key]
    ? 1
    : 0;
}

function riskImprovementCount(baseProduct: Product, candidate: Product) {
  const additiveImprovement = candidate.additives.length < baseProduct.additives.length ? 1 : 0;
  return (
    additiveImprovement +
    countNutritionImprovement(baseProduct, candidate, "energyKcal") +
    countNutritionImprovement(baseProduct, candidate, "sugarsG") +
    countNutritionImprovement(baseProduct, candidate, "sodiumMg") +
    countNutritionImprovement(baseProduct, candidate, "saturatedFatG")
  );
}

function hasPurchaseInfo(product: Product) {
  return Boolean(
    product.shoppingOffer?.link ||
    product.shoppingOffer?.mallName ||
    product.shoppingOffer?.priceText ||
    product.shoppingOffer?.minPrice !== undefined,
  );
}

function recommendationReasons(
  baseProduct: Product,
  candidate: Product,
  baseScore: ScoreResult,
  candidateScore: ScoreResult & { score: number },
) {
  const reasons: string[] = [];
  if (!hasRequiredScore(baseScore)) {
    reasons.push("점수 산출 가능");
  } else if (candidateScore.score - baseScore.score >= MIN_SCORE_DELTA) {
    reasons.push("점수 개선");
  }

  if (candidate.additives.length < baseProduct.additives.length) {
    reasons.push("첨가물 부담 감소");
  }
  if (
    baseProduct.nutrition.sugarsG !== undefined &&
    candidate.nutrition.sugarsG !== undefined &&
    candidate.nutrition.sugarsG < baseProduct.nutrition.sugarsG
  ) {
    reasons.push("당류 낮음");
  }
  if (
    baseProduct.nutrition.sodiumMg !== undefined &&
    candidate.nutrition.sodiumMg !== undefined &&
    candidate.nutrition.sodiumMg < baseProduct.nutrition.sodiumMg
  ) {
    reasons.push("나트륨 낮음");
  }
  if (
    baseProduct.nutrition.saturatedFatG !== undefined &&
    candidate.nutrition.saturatedFatG !== undefined &&
    candidate.nutrition.saturatedFatG < baseProduct.nutrition.saturatedFatG
  ) {
    reasons.push("포화지방 낮음");
  }
  if (hasPurchaseInfo(candidate)) {
    reasons.push("국내 구매 가능");
  }

  return reasons.length > 0 ? reasons : ["동일군 고득점"];
}

function meetsAlternativeCriteria(
  baseProduct: Product,
  candidate: Product,
  baseScore: ScoreResult,
  candidateScore: ScoreResult & { score: number },
) {
  if (!hasRecommendationScoreSource(candidate)) return false;
  if (!isBGradeOrBetter(candidateScore)) return false;
  if (!hasRequiredScore(baseScore)) return true;
  if (candidateScore.score - baseScore.score < MIN_SCORE_DELTA) return false;
  return riskImprovementCount(baseProduct, candidate) > 0;
}

function purchaseTieBreakValue(product: Product) {
  return hasPurchaseInfo(product) ? 1 : 0;
}

function offerRank(product: Product) {
  return product.shoppingOffer?.minPrice ?? Number.POSITIVE_INFINITY;
}

function isOrderedSubsequence(needle: string, haystack: string) {
  let needleIndex = 0;
  for (const char of haystack) {
    if (char === needle[needleIndex]) {
      needleIndex += 1;
      if (needleIndex === needle.length) return true;
    }
  }
  return false;
}

function shoppingNameMatchScore(candidateName: string, shoppingName: string) {
  if (shoppingName === candidateName) return 4;
  if (
    shoppingName.length >= 4 &&
    (shoppingName.includes(candidateName) || candidateName.includes(shoppingName))
  ) {
    return 3;
  }
  if (
    candidateName.length >= 5 &&
    shoppingName.length >= candidateName.length &&
    isOrderedSubsequence(candidateName, shoppingName)
  ) {
    return 2;
  }
  return 0;
}

function bestShoppingMatch(candidate: Product, shoppingCandidates: Product[]) {
  const candidateName = comparableText(candidate.name);
  const candidateBrand = comparableText(candidate.brand);
  if (candidateName.length < 4) return undefined;

  return shoppingCandidates
    .filter((shoppingCandidate) => shoppingCandidate.sources.includes("shopping"))
    .filter((shoppingCandidate) => hasPurchaseInfo(shoppingCandidate))
    .map((shoppingCandidate) => {
      const shoppingName = comparableText(shoppingCandidate.name);
      const shoppingBrand = comparableText(shoppingCandidate.brand);
      const nameScore = shoppingNameMatchScore(candidateName, shoppingName);
      if (nameScore === 0) return null;

      const brandBonus =
        candidateBrand &&
        shoppingBrand &&
        (shoppingBrand.includes(candidateBrand) || candidateBrand.includes(shoppingBrand))
          ? 2
          : 0;
      const categoryBonus =
        candidate.category && candidate.category === shoppingCandidate.category ? 1 : 0;
      return {
        product: shoppingCandidate,
        score: nameScore + brandBonus + categoryBonus,
      };
    })
    .filter((entry): entry is { product: Product; score: number } => entry !== null)
    .sort((a, b) => {
      const matchGap = b.score - a.score;
      if (matchGap !== 0) return matchGap;
      return offerRank(a.product) - offerRank(b.product);
    })[0]?.product;
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function alternativeShoppingQueries(product: Product) {
  return uniqueValues([product.brand ? `${product.brand} ${product.name}` : "", product.name]);
}

async function getGeminiRecommendedCandidates(product: Product, candidates: Product[]) {
  if (candidates.length === 0) return { candidates, context: undefined };

  try {
    const judgement = await recommendAlternativeProducts(product, candidates);
    const context = geminiRecommendationContext(judgement);
    return {
      candidates: rankCandidatesByGeminiRecommendations(candidates, context),
      context,
    };
  } catch {
    return { candidates: [], context: undefined };
  }
}

async function findCandidateShoppingMatch(product: Product) {
  for (const query of alternativeShoppingQueries(product)) {
    try {
      const shoppingCandidates = await searchNaverShopping(query);
      const match = bestShoppingMatch(product, shoppingCandidates);
      if (match) return match;
    } catch {
      // Candidate-level shopping thumbnails are optional.
    }
  }
  return undefined;
}

async function enrichRecommendationShoppingImages(
  recommendations: AlternativeRecommendation[],
): Promise<AlternativeRecommendation[]> {
  return Promise.all(
    recommendations.map(async (recommendation) => {
      if (recommendation.product.imageUrl && recommendation.product.shoppingOffer) {
        return recommendation;
      }

      const shoppingMatch = await findCandidateShoppingMatch(recommendation.product);
      if (!shoppingMatch?.imageUrl && !shoppingMatch?.shoppingOffer) return recommendation;

      const product: Product = {
        ...recommendation.product,
        imageUrl: recommendation.product.imageUrl ?? shoppingMatch.imageUrl,
        shoppingOffer: recommendation.product.shoppingOffer ?? shoppingMatch.shoppingOffer,
        sources: recommendation.product.sources.includes("shopping")
          ? recommendation.product.sources
          : [...recommendation.product.sources, "shopping" as SourceTag],
      };
      const reasons =
        product.shoppingOffer && !recommendation.reasons.includes("국내 구매 가능")
          ? [...recommendation.reasons, "국내 구매 가능"]
          : recommendation.reasons;

      return { ...recommendation, product, reasons };
    }),
  );
}

function rankShoppingCandidatesByGeminiVerification(
  candidates: Product[],
  verification: GeminiAlternativeShoppingVerification,
  minFitScore = MIN_ALTERNATIVE_FIT_SCORE,
) {
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const recommendationById = new Map(
    verification.recommendations.map((recommendation) => [
      recommendation.productId,
      recommendation,
    ]),
  );
  const ranked = verification.recommendations
    .filter((recommendation) => recommendation.fitScore >= minFitScore)
    .map((recommendation) => candidatesById.get(recommendation.productId))
    .filter((candidate): candidate is Product => Boolean(candidate));

  return ranked.map((candidate) => ({
    candidate,
    recommendation: recommendationById.get(candidate.id),
  }));
}

function bestOpenFoodFactsMatch(shoppingProduct: Product, openDbProducts: Product[]) {
  const shoppingName = comparableText(shoppingProduct.name);
  const shoppingBrand = comparableText(shoppingProduct.brand);
  if (shoppingName.length < 4) return undefined;

  return openDbProducts
    .filter((candidate) => candidate.sources.some((source) => source === "open_db"))
    .map((candidate) => {
      const candidateName = comparableText(candidate.name);
      if (candidateName.length < 4) return null;
      const nameScore = shoppingNameMatchScore(candidateName, shoppingName);
      if (nameScore === 0) return null;
      const candidateBrand = comparableText(candidate.brand);
      const brandBonus =
        candidateBrand &&
        shoppingBrand &&
        (shoppingBrand.includes(candidateBrand) || candidateBrand.includes(shoppingBrand))
          ? 2
          : 0;
      return { product: candidate, score: nameScore + brandBonus };
    })
    .filter((entry): entry is { product: Product; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score)[0]?.product;
}

async function enrichShoppingProductWithOpenFoodFacts(product: Product) {
  try {
    const openDbProducts = await searchOpenFoodFacts(product.name);
    const match = bestOpenFoodFactsMatch(product, openDbProducts);
    if (!match) return product;

    return {
      ...product,
      barcode: product.barcode ?? match.barcode,
      ingredientsText: product.ingredientsText ?? match.ingredientsText,
      ingredients: product.ingredients.length > 0 ? product.ingredients : match.ingredients,
      allergens: product.allergens.length > 0 ? product.allergens : match.allergens,
      additives: product.additives.length > 0 ? product.additives : match.additives,
      nutrition: match.nutrition,
      sources: uniqueValues([...product.sources, ...match.sources]) as SourceTag[],
      status: match.status,
      confidence: Math.max(product.confidence, match.confidence),
      updatedAt: product.updatedAt,
    } satisfies Product;
  } catch {
    return product;
  }
}

function buildShoppingRecommendation(
  baseProduct: Product,
  product: Product,
  search: GeminiAlternativeShoppingSearch,
  verification?: GeminiAlternativeShoppingRecommendation,
  baseNutritionBurden = "",
): AlternativeRecommendation | null {
  const score = computeScore(product, DEFAULT_PREFS);
  if (hasRequiredScore(score) && hasRecommendationScoreSource(product)) {
    const baseScore = computeScore(baseProduct, DEFAULT_PREFS);
    if (!meetsAlternativeCriteria(baseProduct, product, baseScore, score)) return null;
    return {
      product,
      score: score.score,
      grade: score.grade,
      scoreDelta: hasRequiredScore(baseScore) ? score.score - baseScore.score : null,
      reasons: uniqueValues([
        verification?.reason ?? "",
        ...(verification?.nutritionFocus ?? []),
        search.targetFood,
        ...search.nutritionFocus,
        search.reason,
        baseNutritionBurden,
        ...recommendationReasons(baseProduct, product, baseScore, score),
      ]),
      kind: "scored",
    };
  }

  return {
    product,
    score: null,
    grade: null,
    scoreDelta: null,
    reasons: uniqueValues([
      verification?.reason ?? "",
      ...(verification?.nutritionFocus ?? []),
      search.targetFood,
      ...search.nutritionFocus,
      search.reason,
      baseNutritionBurden,
    ]),
    kind: "shopping",
  };
}

async function getGeminiShoppingRecommendations(
  product: Product,
): Promise<AlternativeRecommendation[]> {
  let plan: GeminiAlternativeShoppingPlan;
  try {
    plan = await recommendAlternativeShoppingSearches(product);
  } catch {
    return [];
  }

  const recommendations: AlternativeRecommendation[] = [];
  const seen = new Set<string>();

  for (const search of plan.searches) {
    let shoppingCandidates: Product[];
    try {
      shoppingCandidates = await searchNaverShopping(search.query);
    } catch {
      continue;
    }

    const eligibleCandidates = shoppingCandidates.filter((candidate) => hasPurchaseInfo(candidate));

    if (eligibleCandidates.length === 0) continue;

    let verification: GeminiAlternativeShoppingVerification;
    try {
      verification = await verifyAlternativeShoppingResults(product, search, eligibleCandidates);
    } catch {
      continue;
    }

    const verifiedCandidates = rankShoppingCandidatesByGeminiVerification(
      eligibleCandidates,
      verification,
    );

    for (const { candidate, recommendation } of verifiedCandidates) {
      if (isLikelySameProduct(product, candidate)) continue;
      if (seen.has(dedupeKey(candidate))) continue;
      const enrichedProduct = await enrichShoppingProductWithOpenFoodFacts(candidate);
      const builtRecommendation = buildShoppingRecommendation(
        product,
        enrichedProduct,
        search,
        recommendation,
        plan.baseNutritionBurden,
      );
      if (!builtRecommendation) continue;

      seen.add(dedupeKey(candidate));
      recommendations.push(builtRecommendation);
      break;
    }

    if (recommendations.length >= 3) break;
  }

  return recommendations;
}

export function buildAlternativeRecommendations(
  baseProduct: Product,
  candidates: Product[],
  limit = 3,
  prefs: UserPreferences = DEFAULT_PREFS,
  gemini?: GeminiRecommendationContext,
): AlternativeRecommendation[] {
  const baseScore = computeScore(baseProduct, DEFAULT_PREFS);
  const dedupedCandidates = dedupeAlternativeCandidates(candidates);
  const candidatePool = gemini
    ? dedupedCandidates.filter((candidate) => gemini.rankByProductId.has(candidate.id))
    : sameCategoryPool(baseProduct, dedupedCandidates);
  const pool = candidatePool.filter((candidate) =>
    isProductCompatibleWithPreferences(candidate, prefs),
  );

  const scoredRecommendations = pool
    .filter((candidate) => !isLikelySameProduct(baseProduct, candidate))
    .filter((candidate) => !candidate.recall)
    .map((candidate) => {
      const score = computeScore(candidate, DEFAULT_PREFS);
      return { candidate, score };
    })
    .filter(
      (
        entry,
      ): entry is {
        candidate: Product;
        score: ScoreResult & { score: number; grade: NonNullable<ScoreResult["grade"]> };
      } => hasRequiredScore(entry.score),
    )
    .filter(({ candidate, score }) =>
      meetsAlternativeCriteria(baseProduct, candidate, baseScore, score),
    )
    .sort((a, b) => {
      if (gemini) {
        const rankGap =
          (gemini.rankByProductId.get(a.candidate.id) ?? Number.POSITIVE_INFINITY) -
          (gemini.rankByProductId.get(b.candidate.id) ?? Number.POSITIVE_INFINITY);
        if (rankGap !== 0) return rankGap;

        const fitGap =
          (gemini.fitScoreByProductId.get(b.candidate.id) ?? 0) -
          (gemini.fitScoreByProductId.get(a.candidate.id) ?? 0);
        if (fitGap !== 0) return fitGap;
      }

      const scoreGap = b.score.score - a.score.score;
      if (scoreGap !== 0) return scoreGap;
      const improvementGap =
        riskImprovementCount(baseProduct, b.candidate) -
        riskImprovementCount(baseProduct, a.candidate);
      if (improvementGap !== 0) return improvementGap;
      const purchaseGap = purchaseTieBreakValue(b.candidate) - purchaseTieBreakValue(a.candidate);
      if (purchaseGap !== 0) return purchaseGap;
      return b.candidate.confidence - a.candidate.confidence;
    })
    .slice(0, limit)
    .map(({ candidate, score }) => ({
      product: candidate,
      score: score.score,
      grade: score.grade,
      scoreDelta: hasRequiredScore(baseScore) ? score.score - baseScore.score : null,
      reasons: uniqueValues([
        gemini?.reasonByProductId.get(candidate.id) ?? "",
        ...recommendationReasons(baseProduct, candidate, baseScore, score),
      ]),
      kind: "scored",
    }));

  return scoredRecommendations;
}

export function rankAlternativeProducts(
  baseProduct: Product,
  candidates: Product[],
  limit = 3,
): Product[] {
  const baseKey = productKey(baseProduct);
  const pool = sameCategoryPool(baseProduct, dedupeAlternativeCandidates(candidates));

  return pool
    .filter((candidate) => productKey(candidate) !== baseKey)
    .filter((candidate) => !isLikelySameProduct(baseProduct, candidate))
    .sort((a, b) => {
      const aScore = computeScore(a, DEFAULT_PREFS);
      const bScore = computeScore(b, DEFAULT_PREFS);
      const scoreGap = (bScore.score ?? -1) - (aScore.score ?? -1);
      if (scoreGap !== 0) return scoreGap;
      return b.confidence - a.confidence;
    })
    .slice(0, limit);
}

export async function getAlternativeRecommendations(
  product: Product,
  prefs: UserPreferences = DEFAULT_PREFS,
): Promise<AlternativeRecommendation[]> {
  const [localResult] = await Promise.allSettled([searchAlternativeCandidates(product)]);
  const scoredCandidates = localResult.status === "fulfilled" ? localResult.value : [];

  const geminiResult = await getGeminiRecommendedCandidates(product, scoredCandidates);
  const recommendations = buildAlternativeRecommendations(
    product,
    geminiResult.candidates,
    3,
    prefs,
    geminiResult.context,
  );
  if (recommendations.length > 0) {
    return enrichRecommendationShoppingImages(recommendations);
  }
  return getGeminiShoppingRecommendations(product);
}

export async function getAlternativeProducts(
  product: Product,
  prefs: UserPreferences = DEFAULT_PREFS,
): Promise<Product[]> {
  const recommendations = await getAlternativeRecommendations(product, prefs);
  return recommendations.map((recommendation) => recommendation.product);
}
