import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const edgeFunctionSource = readFileSync(
  fileURLToPath(new URL("../../supabase/functions/app-api/actions/ocr.ts", import.meta.url)),
  "utf8",
);

describe("Gemini OCR request payload", () => {
  it("uses Gemini REST structured output fields supported by generationConfig", () => {
    expect(edgeFunctionSource).toContain("responseMimeType");
    expect(edgeFunctionSource).toContain("responseSchema");
    expect(edgeFunctionSource).not.toContain("responseFormat");
  });
});
