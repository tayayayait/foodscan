import { beforeEach, describe, expect, it, vi } from "vitest";
import { classifyAdditive } from "./additive-dictionary";
import {
  additiveExplanationKey,
  applyGeminiAdditiveExplanation,
  explainAdditiveTermsWithGemini,
  termsNeedingGeminiExplanation,
} from "./additive-explanations";

const { callAppEdgeFunctionMock } = vi.hoisted(() => ({
  callAppEdgeFunctionMock: vi.fn(),
}));

vi.mock("./edge-function-client", () => ({
  callAppEdgeFunction: callAppEdgeFunctionMock,
}));

describe("Gemini additive explanations", () => {
  beforeEach(() => {
    callAppEdgeFunctionMock.mockReset();
  });

  it("requests Gemini explanations only for additives not covered by the dictionary", async () => {
    callAppEdgeFunctionMock.mockResolvedValue([
      {
        term: "E472E",
        displayName: "지방산글리세린에스테르",
        purposeLabel: "물과 기름이 섞이도록 도움",
        consumerSummary: "식품의 질감을 균일하게 유지하는 유화제입니다.",
        warnings: ["AI 추정 설명"],
      },
    ]);

    expect(termsNeedingGeminiExplanation(["E319", "E472E", "custom additive"])).toEqual([
      "E472E",
      "custom additive",
    ]);

    const explanations = await explainAdditiveTermsWithGemini(["E319", "E472E"]);

    expect(callAppEdgeFunctionMock).toHaveBeenCalledWith("explainAdditiveTerms", {
      terms: ["E472E"],
    });
    expect(explanations.get(additiveExplanationKey("E472E"))).toMatchObject({
      source: "gemini_estimated",
      displayName: "지방산글리세린에스테르",
      purposeLabel: "물과 기름이 섞이도록 도움",
    });
  });

  it("uses Gemini text for display without changing risk scoring metadata", () => {
    const classified = classifyAdditive("E472E");
    const explanations = new Map([
      [
        additiveExplanationKey("E472E"),
        {
          term: "E472E",
          displayName: "지방산글리세린에스테르",
          purposeLabel: "유화 안정",
          consumerSummary: "식품의 질감을 균일하게 유지하는 유화제입니다.",
          source: "gemini_estimated" as const,
          warnings: [],
        },
      ],
    ]);

    expect(applyGeminiAdditiveExplanation(classified, explanations)).toMatchObject({
      displayName: "지방산글리세린에스테르",
      purposeLabel: "유화 안정",
      consumerSummary: "식품의 질감을 균일하게 유지하는 유화제입니다.",
      explanationSource: "gemini_estimated",
      riskLevel: "unknown",
      reviewRequired: true,
    });
  });

  it("does not override official dictionary explanations", () => {
    const classified = classifyAdditive("E319");
    const explanations = new Map([
      [
        additiveExplanationKey("E319"),
        {
          term: "E319",
          displayName: "AI가 쓴 이름",
          purposeLabel: "AI 목적",
          consumerSummary: "AI 설명",
          source: "gemini_estimated" as const,
          warnings: [],
        },
      ],
    ]);

    expect(applyGeminiAdditiveExplanation(classified, explanations)).toMatchObject({
      displayName: "TBHQ(터셔리부틸히드로퀴논)",
      explanationSource: "dictionary",
      riskLevel: "limited_risk",
    });
  });
});
