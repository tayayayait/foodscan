import { beforeEach, describe, expect, it, vi } from "vitest";
import { lookupC005Internal } from "./product-lookup.ts";
import { fetchFoodSafetyApi } from "../_shared/food-safety-api.ts";

vi.mock("../_shared/food-safety-api.ts", () => ({
  fetchFoodSafetyApi: vi.fn(),
}));

const mockedFetchFoodSafetyApi = vi.mocked(fetchFoodSafetyApi);

describe("C005 product lookup", () => {
  beforeEach(() => {
    mockedFetchFoodSafetyApi.mockReset();
  });

  it("selects the barcode candidate with the most detailed C002 ingredients", async () => {
    mockedFetchFoodSafetyApi.mockImplementation(async (serviceId, _startIdx, _endIdx, params) => {
      if (serviceId === "C005") {
        return {
          ok: true,
          rows: [
            {
              BAR_CD: "8801043014809",
              PRDLST_REPORT_NO: "197201540011",
              PRDLST_NM: "신라면",
              BSSH_NM: "(주)농심",
              PRDLST_DCNM: "유탕면",
              POG_DAYCNT: "제조일로부터 6개월",
            },
            {
              BAR_CD: "8801043014809",
              PRDLST_REPORT_NO: "19760342001155",
              PRDLST_NM: "신(辛)라면",
              BSSH_NM: "(주)농심",
              PRDLST_DCNM: "유탕면",
              POG_DAYCNT: "제조일로부터 6개월까지",
            },
          ],
          code: "INFO-000",
        };
      }

      if (serviceId === "C002" && params.PRDLST_REPORT_NO === "197201540011") {
        return {
          ok: true,
          rows: [
            {
              PRDLST_REPORT_NO: "197201540011",
              RAWMTRL_ORDNO: "1,54,53",
              RAWMTRL_NM: "면류, 과채가공품, 복합조미식품",
            },
          ],
          code: "INFO-000",
        };
      }

      if (serviceId === "C002" && params.PRDLST_REPORT_NO === "19760342001155") {
        return {
          ok: true,
          rows: [
            {
              PRDLST_REPORT_NO: "19760342001155",
              RAWMTRL_ORDNO: "94,95,96,97,98,99,100,101",
              RAWMTRL_NM:
                "소맥분, 팜유, 감자전분, 초산전분, 정제소금, 난각칼슘, 면류첨가알칼리제, 복합조미식품",
            },
          ],
          code: "INFO-000",
        };
      }

      return { ok: true, rows: [], code: "INFO-200" };
    });

    const product = await lookupC005Internal("8801043014809");

    expect(product?.reportNo).toBe("19760342001155");
    expect(product?.ingredients).toContain("초산전분");
    expect(product?.ingredients).toContain("면류첨가알칼리제");
  });

  it("uses C006 ingredients for livestock processed C005 products", async () => {
    mockedFetchFoodSafetyApi.mockImplementation(async (serviceId, _startIdx, _endIdx, params) => {
      if (serviceId === "C005") {
        return {
          ok: true,
          rows: [
            {
              BAR_CD: "88002798",
              PRDLST_REPORT_NO: "1984044800212",
              PRDLST_NM: "빙그레 바나나맛 우유",
              BSSH_NM: "(주)빙그레",
              PRDLST_DCNM: "가공유",
              POG_DAYCNT: "제조일로부터 21일",
              INDUTY_NM: "축산물가공업-유가공업",
            },
          ],
          code: "INFO-000",
        };
      }

      if (serviceId === "C002") {
        return { ok: true, rows: [], code: "INFO-200" };
      }

      if (serviceId === "C006" && params.PRDLST_REPORT_NO === "1984044800212") {
        return {
          ok: true,
          rows: [
            {
              PRDLST_REPORT_NO: "1984044800212",
              RAWMTRL_ORDNO: "14,13,12,11,10,9,8",
              RAWMTRL_NM: "정제수, 카로틴, 향료, 향료, 바나나농축과즙, 설탕, 원유",
            },
          ],
          code: "INFO-000",
        };
      }

      return { ok: true, rows: [], code: "INFO-200" };
    });

    const product = await lookupC005Internal("88002798");

    expect(product?.reportNo).toBe("1984044800212");
    expect(product?.ingredientsText).toBe("정제수, 카로틴, 향료, 향료, 바나나농축과즙, 설탕, 원유");
    expect(product?.ingredients).toContain("카로틴");
    expect(product?.ingredients).toContain("향료");
  });
});
