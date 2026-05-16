import { GEMINI_ENDPOINT, HttpError } from "../_shared/runtime.ts";
import type {
  AdditiveTermExplanation,
  AdditiveTermExplanationResponse,
  GeminiGenerateResponse,
} from "../_shared/types.ts";
import { asStringArray, getGeminiApiKey, getGeminiModel, parseGeminiJson } from "./ocr.ts";

export const ADDITIVE_EXPLANATION_SCHEMA = {
  type: "object",
  properties: {
    explanations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: {
            type: "string",
            description: "Original input term copied exactly when possible.",
          },
          displayName: {
            type: "string",
            description: "Plain Korean additive or ingredient name for display.",
          },
          purposeLabel: {
            type: "string",
            description: "Short Korean purpose label. Example: 가루 뭉침 방지.",
          },
          consumerSummary: {
            type: "string",
            description: "One short Korean sentence explaining what it does in food.",
          },
          warnings: {
            type: "array",
            items: { type: "string" },
            description: "Uncertainty warnings, if any.",
          },
        },
        required: ["term", "displayName", "purposeLabel", "consumerSummary", "warnings"],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Overall uncertainty warnings, if any.",
    },
  },
  required: ["explanations", "warnings"],
};

export const additiveExplanationPrompt = `
Explain food additive codes or technical ingredient terms in plain-language Korean.
Return only JSON matching the schema.

Rules:
- Explain only the supplied terms. Do not add new terms.
- Keep term close to the original input so the client can match it.
- displayName should be a common Korean name when known; otherwise a cautious Korean transliteration.
- purposeLabel must be short and practical, such as "단맛 부여", "보존성 유지", "가루 뭉침 방지", or "질감 안정".
- consumerSummary must explain what the term usually does in food in one sentence.
- Do not assign safety, risk, or score.
- Do not say allowed, banned, safe, dangerous, toxic, carcinogenic, or disease-related claims.
- If uncertain, explain that the description is an AI-estimated plain-language explanation in warnings.
`;

const cleanString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const explanationKey = (term: string) =>
  term
    .replace(/^EN:/i, "")
    .replace(/[-_\s]/g, "")
    .trim()
    .toUpperCase();

export const assertAdditiveExplanationTerms = (value: unknown) => {
  if (!Array.isArray(value)) {
    throw new HttpError("terms is required");
  }

  const seen = new Set<string>();
  const terms: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const term = item.trim();
    const key = explanationKey(term);
    if (!term || !key || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }

  if (terms.length === 0) {
    throw new HttpError("terms must not be empty");
  }
  if (terms.length > 20) {
    throw new HttpError("terms exceeds maximum size");
  }

  return terms;
};

export function normalizeGeminiAdditiveExplanationResponse(
  value: unknown,
  requestedTerms: string[],
): AdditiveTermExplanationResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini additive explanation JSON is not an object");
  }

  const requested = new Set(requestedTerms.map(explanationKey));
  const obj = value as Record<string, unknown>;
  const rows = Array.isArray(obj.explanations) ? obj.explanations : [];
  const explanations: AdditiveTermExplanation[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const term = cleanString(item.term);
    const key = explanationKey(term);
    if (!term || !requested.has(key) || seen.has(key)) continue;

    const displayName = cleanString(item.displayName);
    const purposeLabel = cleanString(item.purposeLabel);
    const consumerSummary = cleanString(item.consumerSummary);
    if (!displayName || !purposeLabel || !consumerSummary) continue;

    seen.add(key);
    explanations.push({
      term,
      displayName,
      purposeLabel,
      consumerSummary,
      warnings: asStringArray(item.warnings)
        .map((warning) => warning.trim())
        .filter(Boolean),
      source: "gemini_estimated",
    });
  }

  return {
    explanations,
    warnings: asStringArray(obj.warnings)
      .map((warning) => warning.trim())
      .filter(Boolean),
  };
}

export const explainAdditiveTermsInternal = async (
  terms: string[],
): Promise<AdditiveTermExplanation[]> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new HttpError("GEMINI_API_KEY is not configured", 500, "NO_GEMINI_API_KEY");
  }

  const response = await fetch(
    `${GEMINI_ENDPOINT}/${encodeURIComponent(getGeminiModel())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: additiveExplanationPrompt }, { text: JSON.stringify({ terms }) }],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: ADDITIVE_EXPLANATION_SCHEMA,
        },
      }),
    },
  );

  const payload = (await response.json()) as GeminiGenerateResponse;
  if (!response.ok) {
    throw new HttpError(
      payload.error?.message || "Gemini additive explanation failed",
      response.status,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join("\n");

  if (!text) {
    throw new Error("Gemini additive explanation returned an empty response");
  }

  return normalizeGeminiAdditiveExplanationResponse(parseGeminiJson(text), terms).explanations;
};
