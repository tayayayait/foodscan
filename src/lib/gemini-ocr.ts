import { callAppEdgeFunction } from "./edge-function-client";
import type { Nutrition } from "./types";

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

export type OcrDecision = "auto" | "confirm" | "review" | "retake";

export interface OcrInput {
  imageBase64: string;
  mimeType: string;
}

export const analyzeFoodImage = (input: OcrInput) =>
  callAppEdgeFunction<GeminiOcrResult>("analyzeFoodImage", input);

export const getOcrDecision = (confidence: number): OcrDecision => {
  if (confidence >= 0.9) return "auto";
  if (confidence >= 0.7) return "confirm";
  if (confidence >= 0.5) return "review";
  return "retake";
};
