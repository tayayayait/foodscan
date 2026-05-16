import { createFileRoute } from "@tanstack/react-router";
import { AppHomePage } from "@/components/HomePage";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "식품 스캔" },
      {
        name: "description",
        content: "바코드와 제품명으로 식품을 빠르게 분석하세요.",
      },
    ],
  }),
  component: AppHomePage,
});
