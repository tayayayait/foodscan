import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { reviewReasonForProduct } from "@/lib/review-policy";
import { evaluateFoodSubmissionDraft } from "@/lib/submission-quality";
import { getOcrDraft, pushProvisional } from "@/lib/storage";
import { enqueueProductReview, upsertProductToSupabase } from "@/lib/supabase-api";
import type { Product } from "@/lib/types";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
  validateSearch: z.object({
    barcode: z.string().optional(),
    draft: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "제품 등록 — 식품 스캔" },
      { name: "description", content: "미식별 제품을 직접 등록합니다." },
    ],
  }),
  component: RegisterPage,
});

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="text-[13px] font-semibold mb-1.5">
        {label}
        {required && <span style={{ color: "#DC2626" }}> *</span>}
      </div>
      {children}
      {hint && (
        <p className="mt-1 text-[12px]" style={{ color: "#64748B" }}>
          {hint}
        </p>
      )}
    </label>
  );
}

const inputCls = "w-full bg-surface text-foreground placeholder:text-[#94A3B8] px-3.5";
const inputStyle = {
  height: 48,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  fontSize: 16,
};

const dataUrlToUploadedImage = (id: string, dataUrl: string): UploadedImage => ({
  id,
  dataUrl,
  base64: dataUrl.replace(/^data:[^,]+,/, ""),
  mimeType: dataUrl.match(/^data:([^;]+);/)?.[1] ?? "image/jpeg",
});

const splitIngredients = (raw: string) =>
  raw
    .split(/[,;()·]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);

const splitList = (raw: string) =>
  raw
    .split(/[,;·\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);

const parseOptionalNumber = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const nutritionFields: {
  key: keyof Product["nutrition"];
  label: string;
  unit: string;
  step: string;
}[] = [
  { key: "energyKcal", label: "열량", unit: "kcal", step: "1" },
  { key: "sugarsG", label: "당류", unit: "g", step: "0.1" },
  { key: "sodiumMg", label: "나트륨", unit: "mg", step: "1" },
  { key: "saturatedFatG", label: "포화지방", unit: "g", step: "0.1" },
  { key: "proteinG", label: "단백질", unit: "g", step: "0.1" },
];

function RegisterPage() {
  const { barcode, draft } = Route.useSearch();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [code, setCode] = useState(barcode || "");
  const [quantity, setQuantity] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [nutrition, setNutrition] = useState<Product["nutrition"]>({});
  const [allergens, setAllergens] = useState<string[]>([]);
  const [additives, setAdditives] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(0.5);
  const [sources, setSources] = useState<Product["sources"]>(["user_submitted"]);
  const [productImages, setProductImages] = useState<UploadedImage[]>([]);
  const [nutritionImages, setNutritionImages] = useState<UploadedImage[]>([]);
  const [ingredientImages, setIngredientImages] = useState<UploadedImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const ingredients = splitIngredients(ingredientsText);
  const submissionQuality = evaluateFoodSubmissionDraft({
    name,
    barcode: code,
    brand,
    quantity,
    productImageCount: productImages.length,
    nutritionImageCount: nutritionImages.length,
    ingredientImageCount: ingredientImages.length,
    nutrition,
    ingredientsText,
    ingredients,
  });
  const qualityIssues = [...submissionQuality.blockingIssues, ...submissionQuality.reviewIssues];
  const qualityTone =
    submissionQuality.blockingIssues.length > 0
      ? { bg: "#FEF2F2", fg: "#991B1B", border: "#FECACA", Icon: AlertTriangle }
      : submissionQuality.reviewIssues.length > 0
        ? { bg: "#FFEDD5", fg: "#9A3412", border: "#FDBA74", Icon: Info }
        : { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0", Icon: CheckCircle2 };
  const QualityIcon = qualityTone.Icon;

  useEffect(() => {
    if (!draft) return;
    const savedDraft = getOcrDraft(draft);
    if (!savedDraft) return;

    const result = savedDraft.result;
    setName(result.productName);
    setBrand(result.brand);
    setCode(result.barcode || barcode || "");
    setQuantity(result.quantity);
    setIngredientsText(result.ingredientsText);
    setNutrition(result.nutrition);
    setAllergens(result.allergens);
    setAdditives(result.additives);
    setConfidence(result.confidence);
    setSources(["ai_estimated", "user_submitted"]);
    setProductImages([dataUrlToUploadedImage(savedDraft.id, savedDraft.imageUrl)]);
  }, [barcode, draft]);

  const setNutritionField = (key: keyof Product["nutrition"], value: string) => {
    setNutrition((current) => {
      const next = { ...current };
      const parsed = parseOptionalNumber(value);
      if (parsed === undefined) delete next[key];
      else next[key] = parsed;
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2 || name.trim().length > 80)
      errs.name = "제품명은 2-80자로 입력해주세요";
    if (code && !/^\d{8,14}$/.test(code)) errs.code = "바코드는 8-14자리 숫자여야 합니다";
    if (productImages.length === 0) errs.productImage = "제품 사진은 필수입니다";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const id = code || `prov-${Date.now()}`;
    const finalConfidence = sources.includes("ai_estimated")
      ? Math.min(confidence, submissionQuality.confidence)
      : submissionQuality.confidence;
    const product: Product = {
      id,
      barcode: code || undefined,
      name: name.trim(),
      brand: brand.trim() || undefined,
      quantity: quantity.trim() || undefined,
      imageUrl: productImages[0]?.dataUrl,
      submittedImageUrls: {
        product: productImages[0]?.dataUrl,
        nutrition: nutritionImages[0]?.dataUrl,
        ingredients: ingredientImages[0]?.dataUrl,
      },
      ingredientsText: ingredientsText.trim() || undefined,
      ingredients,
      allergens,
      additives,
      nutrition,
      sources,
      status: submissionQuality.status,
      confidence: finalConfidence,
      updatedAt: new Date().toISOString(),
    };
    pushProvisional(product);
    setSubmitting(true);
    try {
      await upsertProductToSupabase(product);
      const reason = reviewReasonForProduct(product);
      const queued = reason
        ? await enqueueProductReview(product, reason, {
            draftId: draft ?? null,
            submittedImageUrls: product.submittedImageUrls,
          })
        : false;
      if (reason && !queued) {
        toast.info("로컬에 임시 저장되었습니다. 검수 큐 동기화는 나중에 다시 시도하세요");
      } else {
        toast.success(
          reason ? "제품 정보가 검수 큐에 등록되었습니다" : "제품 정보가 저장되었습니다",
        );
      }
    } catch {
      toast.info("로컬에 임시 저장되었습니다. 서버 동기화는 나중에 다시 시도하세요");
    } finally {
      setSubmitting(false);
    }
    nav({ to: "/product/$id", params: { id } });
  };

  return (
    <AppShell title="제품 등록" back={() => history.back()}>
      <div className="pt-4">
        <div
          className="rounded-md p-3 mb-4 text-[13px]"
          style={{ backgroundColor: "#FFEDD5", color: "#9A3412" }}
        >
          검수 전까지 사용자 제보 정보로 표시됩니다
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <ImageUploader
              label="제품 사진"
              required
              value={productImages}
              onChange={setProductImages}
              capture="environment"
            />
            {errors.productImage && (
              <p className="mt-1 text-[12px]" style={{ color: "#DC2626" }}>
                {errors.productImage}
              </p>
            )}
          </div>
          <div
            className="rounded-md border p-3"
            style={{
              backgroundColor: qualityTone.bg,
              borderColor: qualityTone.border,
              color: qualityTone.fg,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <QualityIcon size={18} />
                <span className="text-[14px] font-bold">제보 품질</span>
              </div>
              <span className="text-[13px] font-bold">{submissionQuality.score}/100</span>
            </div>
            <div className="mt-2 grid gap-1.5 text-[12px]">
              {qualityIssues.length === 0 ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>점수 산출에 필요한 기본 근거가 확보되었습니다</span>
                </div>
              ) : (
                qualityIssues.map((issue) => (
                  <div key={issue.code} className="flex items-start gap-1.5">
                    {issue.blocking ? <AlertTriangle size={14} /> : <Info size={14} />}
                    <span>
                      <strong>{issue.label}</strong> · {issue.description}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <Field label="제품명" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className={inputCls}
              style={inputStyle}
              placeholder="예: 신라면"
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="mt-1 text-[12px]" style={{ color: "#DC2626" }}>
                {errors.name}
              </p>
            )}
          </Field>
          <Field label="제조사">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              maxLength={60}
              className={inputCls}
              style={inputStyle}
              placeholder="예: 농심"
            />
          </Field>
          <Field label="바코드" hint="8-14자리 숫자">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              className={`${inputCls} tabular`}
              style={inputStyle}
              placeholder="예: 8801234567890"
              aria-invalid={!!errors.code}
            />
            {errors.code && (
              <p className="mt-1 text-[12px]" style={{ color: "#DC2626" }}>
                {errors.code}
              </p>
            )}
          </Field>
          <Field label="용량">
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputCls}
              style={inputStyle}
              placeholder="예: 86g"
            />
          </Field>
          <Field label="원재료">
            <textarea
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              className={`${inputCls} py-3`}
              style={{ ...inputStyle, height: 112, resize: "vertical" }}
              placeholder="예: 밀가루, 정제염, 설탕"
            />
          </Field>
          <ImageUploader
            label="영양성분표 사진"
            value={nutritionImages}
            onChange={setNutritionImages}
            capture="environment"
          />
          <ImageUploader
            label="원재료 사진"
            value={ingredientImages}
            onChange={setIngredientImages}
            capture="environment"
          />
          <section className="rounded-md border border-border bg-surface p-3">
            <h2 className="mb-3 text-[15px] font-bold">영양성분</h2>
            <div className="grid grid-cols-2 gap-3">
              {nutritionFields.map((field) => (
                <Field key={field.key} label={`${field.label} (${field.unit})`}>
                  <input
                    value={nutrition[field.key] ?? ""}
                    onChange={(e) => setNutritionField(field.key, e.target.value)}
                    inputMode="decimal"
                    type="number"
                    min="0"
                    step={field.step}
                    className={`${inputCls} tabular`}
                    style={inputStyle}
                    placeholder="100g 기준"
                  />
                </Field>
              ))}
            </div>
          </section>
          <Field label="알레르기 표시" hint="쉼표로 구분">
            <input
              value={allergens.join(", ")}
              onChange={(e) => setAllergens(splitList(e.target.value))}
              className={inputCls}
              style={inputStyle}
              placeholder="예: 밀, 우유"
            />
          </Field>
          <Field label="첨가물" hint="E번호 또는 명칭을 쉼표로 구분">
            <input
              value={additives.join(", ")}
              onChange={(e) => setAdditives(splitList(e.target.value))}
              className={inputCls}
              style={inputStyle}
              placeholder="예: E330, 구연산"
            />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full font-semibold text-white rounded-md mt-2"
            style={{ height: 48, backgroundColor: "#0F766E", fontSize: 15 }}
          >
            {submitting ? "등록 중" : "제품 등록"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
