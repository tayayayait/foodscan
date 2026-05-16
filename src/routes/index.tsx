import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/HomePage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FoodScan - 스마트한 식품 안전 관리" },
      {
        name: "description",
        content: "바코드와 제품명 검색으로 영양성분, 알레르기, 회수 이력을 확인하세요.",
      },
    ],
  }),
  component: HomePage,
});
