import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectAdditivesFromIngredients } from "./ingredients.ts";
import { fetchFoodSafetyApi } from "../_shared/food-safety-api.ts";
import { fetchPublicDataApi } from "../_shared/public-data-api.ts";

vi.mock("../_shared/food-safety-api.ts", () => ({
  fetchFoodSafetyApi: vi.fn(),
}));

vi.mock("../_shared/public-data-api.ts", () => ({
  fetchPublicDataApi: vi.fn(),
}));

const mockedFetchFoodSafetyApi = vi.mocked(fetchFoodSafetyApi);
const mockedFetchPublicDataApi = vi.mocked(fetchPublicDataApi);

describe("ingredient additive detection", () => {
  beforeEach(() => {
    mockedFetchFoodSafetyApi.mockReset();
    mockedFetchPublicDataApi.mockReset();
  });

  it("checks ingredients sequentially so the food safety key does not reject concurrent requests", async () => {
    let activeFoodSafetyRequest = false;
    mockedFetchPublicDataApi.mockResolvedValue({ ok: true, rows: [], code: "INFO-200" });
    mockedFetchFoodSafetyApi.mockImplementation(async (serviceId, _startIdx, _endIdx, params) => {
      if (activeFoodSafetyRequest) {
        return {
          ok: false,
          rows: [],
          code: "INVALID_RESPONSE",
          message: "현재 접속 중인 인증키입니다.",
        };
      }

      activeFoodSafetyRequest = true;
      await new Promise((resolve) => setTimeout(resolve, 0));
      activeFoodSafetyRequest = false;

      if (serviceId === "I2520") {
        const name = params.RPRSNT_RAWMTRL_NM;
        return {
          ok: true,
          rows: [
            {
              RAWMTRL_CD: name === "초산전분" ? "B1000246000000" : "B2000916000000",
              RPRSNT_RAWMTRL_NM: name,
              RAWMTRL_LCLAS_NM: "식품첨가물(B코드)",
              RAWMTRL_MLSFC_NM: "식품첨가물",
              USE_YN: "Y",
            },
          ],
          code: "INFO-000",
        };
      }

      return { ok: true, rows: [], code: "INFO-200" };
    });

    await expect(detectAdditivesFromIngredients(["초산전분", "면류첨가알칼리제"])).resolves.toEqual(
      ["초산전분", "면류첨가알칼리제"],
    );
  });

  it("does not turn a generic additive label into a concrete additive candidate", async () => {
    mockedFetchPublicDataApi.mockResolvedValue({ ok: true, rows: [], code: "INFO-200" });
    mockedFetchFoodSafetyApi.mockImplementation(async (serviceId) => {
      if (serviceId === "I2520") {
        return {
          ok: true,
          rows: [
            {
              RAWMTRL_CD: "B3000101000000",
              RPRSNT_RAWMTRL_NM: "식품첨가물(살균소독제)",
              RAWMTRL_LCLAS_NM: "식품첨가물(B코드)",
              RAWMTRL_MLSFC_NM: "살균소독제",
              USE_YN: "N",
            },
            {
              RAWMTRL_CD: "P0204229000000",
              RPRSNT_RAWMTRL_NM: "식품첨가물",
              RAWMTRL_LCLAS_NM: "식품유형",
              RAWMTRL_MLSFC_NM: "가공식품",
              USE_YN: "Y",
            },
          ],
          code: "INFO-000",
        };
      }

      return { ok: true, rows: [], code: "INFO-200" };
    });

    await expect(detectAdditivesFromIngredients(["식품첨가물"])).resolves.toEqual([]);
  });
});
