import { classifyAdditive, type ClassifiedAdditive } from "./additive-dictionary";
import { callAppEdgeFunction } from "./edge-function-client";

export interface GeminiAdditiveExplanation {
  term: string;
  displayName: string;
  purposeLabel: string;
  consumerSummary: string;
  warnings: string[];
  source: "gemini_estimated";
}

export const additiveExplanationKey = (term: string) =>
  term
    .replace(/^EN:/i, "")
    .replace(/[-_\s]/g, "")
    .trim()
    .toUpperCase();

const cleanText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeGeminiExplanations = (
  value: unknown,
  requestedTerms: string[],
): Map<string, GeminiAdditiveExplanation> => {
  const requested = new Set(requestedTerms.map(additiveExplanationKey));
  const rows = Array.isArray(value) ? value : [];
  const normalized = new Map<string, GeminiAdditiveExplanation>();

  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const obj = row as Record<string, unknown>;
    const term = cleanText(obj.term);
    const key = additiveExplanationKey(term);
    if (!term || !requested.has(key) || normalized.has(key)) continue;

    const displayName = cleanText(obj.displayName);
    const purposeLabel = cleanText(obj.purposeLabel);
    const consumerSummary = cleanText(obj.consumerSummary);
    if (!displayName || !purposeLabel || !consumerSummary) continue;

    normalized.set(key, {
      term,
      displayName,
      purposeLabel,
      consumerSummary,
      warnings: Array.isArray(obj.warnings)
        ? obj.warnings
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
      source: "gemini_estimated",
    });
  }

  return normalized;
};

export const termsNeedingGeminiExplanation = (additives: string[]) => {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const additive of additives) {
    const classified = classifyAdditive(additive);
    if (classified.explanationSource === "dictionary") continue;

    const key = additiveExplanationKey(additive);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    terms.push(additive);
  }

  return terms;
};

export const explainAdditiveTermsWithGemini = async (additives: string[]) => {
  const terms = termsNeedingGeminiExplanation(additives);
  if (terms.length === 0) return new Map<string, GeminiAdditiveExplanation>();

  try {
    const explanations = await callAppEdgeFunction<GeminiAdditiveExplanation[]>(
      "explainAdditiveTerms",
      { terms },
    );
    return normalizeGeminiExplanations(explanations, terms);
  } catch {
    return new Map<string, GeminiAdditiveExplanation>();
  }
};

export const applyGeminiAdditiveExplanation = (
  additive: ClassifiedAdditive,
  explanations: Map<string, GeminiAdditiveExplanation>,
): ClassifiedAdditive => {
  if (additive.explanationSource === "dictionary") return additive;

  const explanation = explanations.get(additiveExplanationKey(additive.name));
  if (!explanation) return additive;

  return {
    ...additive,
    displayName: explanation.displayName,
    purposeLabel: explanation.purposeLabel,
    consumerSummary: explanation.consumerSummary,
    explanationSource: explanation.source,
  };
};
