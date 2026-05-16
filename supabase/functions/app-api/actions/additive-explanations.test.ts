import { describe, expect, it } from "vitest";
import {
  additiveExplanationPrompt,
  normalizeGeminiAdditiveExplanationResponse,
} from "./additive-explanations.ts";

describe("Gemini additive explanations", () => {
  it("normalizes Gemini explanations to requested terms and drops incomplete rows", () => {
    const explanations = normalizeGeminiAdditiveExplanationResponse(
      {
        explanations: [
          {
            term: " E472E ",
            displayName: " 지방산글리세린에스테르 ",
            purposeLabel: " 물과 기름이 섞이도록 도움 ",
            consumerSummary: " 식품의 질감을 균일하게 유지하는 유화제입니다. ",
            warnings: [" AI 추정 설명 ", ""],
          },
          {
            term: "unknown",
            displayName: "요청하지 않은 항목",
            purposeLabel: "제외",
            consumerSummary: "제외",
            warnings: [],
          },
          {
            term: "xanthan gum",
            displayName: "",
            purposeLabel: "점도 조절",
            consumerSummary: "불완전 항목",
            warnings: [],
          },
        ],
        warnings: ["전문용어 해석은 표시용입니다."],
      },
      ["E472E", "xanthan gum"],
    );

    expect(explanations).toEqual({
      explanations: [
        {
          term: "E472E",
          displayName: "지방산글리세린에스테르",
          purposeLabel: "물과 기름이 섞이도록 도움",
          consumerSummary: "식품의 질감을 균일하게 유지하는 유화제입니다.",
          warnings: ["AI 추정 설명"],
          source: "gemini_estimated",
        },
      ],
      warnings: ["전문용어 해석은 표시용입니다."],
    });
  });

  it("instructs Gemini not to create safety or scoring judgements", () => {
    expect(additiveExplanationPrompt).toContain("Do not assign safety, risk, or score");
    expect(additiveExplanationPrompt).toContain("plain-language Korean");
  });
});
