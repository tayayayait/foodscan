import { describe, expect, it } from "vitest";
import {
  classifyAdditive,
  classifyAdditives,
  findAdditiveRiskProfile,
  getUnknownAdditives,
} from "./additive-dictionary";

describe("additive dictionary", () => {
  it("classifies known E-number ranges and extracts unknown additives", () => {
    expect(classifyAdditive("E330").category).toBe("acidity_regulator");
    expect(getUnknownAdditives(["E330", "custom additive"])).toEqual(["custom additive"]);
  });

  it("returns risk metadata for low-risk acidity regulators", () => {
    const additive = classifyAdditive("E330");

    expect(additive).toMatchObject({
      category: "acidity_regulator",
      riskLevel: "risk_free",
      riskLabel: "위험도 낮음",
      severity: "good",
      scorePenalty: 0,
      reviewRequired: false,
    });
  });

  it("returns consumer-friendly names and purposes for E319 and E551", () => {
    const tbhq = classifyAdditive("E319");
    const siliconDioxide = classifyAdditive("E 551");

    expect(tbhq).toMatchObject({
      code: "E319",
      displayName: "TBHQ(터셔리부틸히드로퀴논)",
      purposeLabel: "기름 산패 방지",
      explanationSource: "dictionary",
      category: "antioxidant",
      categoryLabel: "산화방지제",
      riskLevel: "limited_risk",
      reviewRequired: false,
    });
    expect(tbhq.consumerSummary).toContain("산화방지제");

    expect(siliconDioxide).toMatchObject({
      code: "E551",
      displayName: "이산화규소",
      purposeLabel: "가루 뭉침 방지",
      explanationSource: "dictionary",
      category: "anticaking_agent",
      categoryLabel: "고결방지제",
      riskLevel: "risk_free",
      reviewRequired: false,
    });
    expect(getUnknownAdditives(["E319", "E 551"])).toEqual([]);
  });

  it("classifies guar gum as a known stabilizer instead of an unknown additive", () => {
    const additive = classifyAdditive("구아검");

    expect(additive).toMatchObject({
      code: "E412",
      displayName: "구아검",
      purposeLabel: "점도 조절·안정화",
      explanationSource: "dictionary",
      category: "stabilizer",
      categoryLabel: "증점제/안정제",
      riskLevel: "risk_free",
      riskLabel: "위험도 낮음",
      scorePenalty: 0,
      reviewRequired: false,
      evidenceLevel: "safety_evaluated",
    });
    expect(additive.riskBasis).toContain("JECFA");
    expect(getUnknownAdditives(["구아검", "E412", "GUAR GUM"])).toEqual([]);
  });

  it("returns consumer-friendly names for common additive code families", () => {
    expect(classifyAdditive("E102")).toMatchObject({
      code: "E102",
      displayName: "타르트라진",
      purposeLabel: "색 부여",
      riskLevel: "moderate_risk",
    });
    expect(classifyAdditive("SODIUMBENZOATE")).toMatchObject({
      code: "E211",
      displayName: "안식향산나트륨",
      purposeLabel: "보존성 유지",
      riskLevel: "moderate_risk",
    });
    expect(classifyAdditive("E621")).toMatchObject({
      code: "E621",
      displayName: "글루탐산나트륨(MSG)",
      purposeLabel: "감칠맛 보강",
      riskLevel: "limited_risk",
    });
    expect(classifyAdditive("aspartame")).toMatchObject({
      code: "E951",
      displayName: "아스파탐",
      purposeLabel: "단맛 부여",
      riskLevel: "moderate_risk",
    });
  });

  it("marks E171 as high risk with a score cap basis", () => {
    const additive = classifyAdditive("E171");

    expect(additive).toMatchObject({
      code: "E171",
      displayName: "이산화티타늄",
      category: "colorant",
      riskLevel: "high_risk",
      severity: "danger",
      scorePenalty: 18,
      scoreCap: 49,
      reviewRequired: false,
    });
    expect(additive.riskBasis).toContain("EFSA 2021");
    expect(additive.sourceUrls).toContain(
      "https://www.efsa.europa.eu/en/news/titanium-dioxide-e171-no-longer-considered-safe-when-used-food-additive",
    );
  });

  it("classifies artificial flavor aliases as limited risk with evidence metadata", () => {
    const additive = classifyAdditive(
      "합성착향료(2,6-Dimethyl-3-[(2-methyl-3-furyl)thio]-4-heptanone)",
    );

    expect(additive).toMatchObject({
      category: "flavor",
      riskLevel: "limited_risk",
      scorePenalty: 4,
      reviewRequired: false,
      evidenceLevel: "regulatory_condition",
      explanationSource: "dictionary",
    });
    expect(additive.sourceUrls).toContain("https://www.fao.org/gsfaonline/");
  });

  it("keeps generic mixture labels out of confirmed risk scoring", () => {
    const additive = classifyAdditive("혼합제제");

    expect(additive).toMatchObject({
      category: "unknown",
      riskLevel: "unknown",
      scorePenalty: 0,
      reviewRequired: true,
      evidenceLevel: "unmatched",
    });
    expect(additive.riskBasis).toContain("구체 첨가물명이 아닙니다");
  });

  it("exposes source-backed profiles for Supabase seeding", () => {
    const profile = findAdditiveRiskProfile("아질산나트륨");

    expect(profile).toMatchObject({
      canonicalName: "아질산나트륨",
      eNumber: "E250",
      riskLevel: "high_risk",
      scorePenalty: 18,
    });
    expect(profile?.sourceUrls.length).toBeGreaterThan(0);
  });

  it("marks uncategorized additives for review without score penalty", () => {
    const additive = classifyAdditive("custom additive");

    expect(additive).toMatchObject({
      category: "unknown",
      explanationSource: "fallback",
      riskLevel: "unknown",
      severity: "info",
      scorePenalty: 0,
      reviewRequired: true,
    });
  });

  it("keeps grouped additive metadata available to the UI", () => {
    const grouped = classifyAdditives(["E330", "E171", "custom additive"]);

    expect(grouped.get("acidity_regulator")?.[0].riskLevel).toBe("risk_free");
    expect(grouped.get("colorant")?.[0].riskLabel).toBe("고위험/제한 사용");
    expect(grouped.get("unknown")?.[0].reviewRequired).toBe(true);
  });
});
