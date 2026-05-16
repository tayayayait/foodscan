import { type ChangeEvent, useState } from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";

export interface UploadedImage {
  id: string;
  file?: File;
  dataUrl: string;
  base64: string;
  mimeType: string;
}

interface ImageUploaderProps {
  label: string;
  required?: boolean;
  multiple?: boolean;
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxFiles?: number;
  capture?: "user" | "environment";
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const readImage = (file: File) =>
  new Promise<UploadedImage>((resolve, reject) => {
    if (!ACCEPTED_TYPES.has(file.type)) {
      reject(new Error("jpg, png, webp 파일만 업로드할 수 있습니다"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("이미지는 10MB 이하만 업로드할 수 있습니다"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      resolve({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        file,
        dataUrl,
        base64: dataUrl.replace(/^data:[^,]+,/, ""),
        mimeType: file.type,
      });
    };
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다"));
    reader.readAsDataURL(file);
  });

export function ImageUploader({
  label,
  required,
  multiple = false,
  value,
  onChange,
  maxFiles = multiple ? 3 : 1,
  capture,
}: ImageUploaderProps) {
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = input.files;
    if (!files || files.length === 0) return;
    setError(null);
    try {
      const nextImages = await Promise.all(Array.from(files).map(readImage));
      const merged = multiple ? [...value, ...nextImages] : nextImages;
      onChange(merged.slice(0, maxFiles));
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 업로드 실패");
    } finally {
      input.value = "";
    }
  };

  const removeImage = (id: string) => {
    onChange(value.filter((image) => image.id !== id));
  };

  return (
    <div>
      <div className="text-[13px] font-semibold mb-1.5">
        {label}
        {required && <span style={{ color: "#DC2626" }}> *</span>}
      </div>
      <div className="relative">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture={capture}
          multiple={multiple}
          aria-label={label}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          onChange={handleFiles}
        />
        <div
          aria-hidden="true"
          className="w-full rounded-md border border-dashed border-border-strong bg-surface px-4 text-left transition-colors hover:bg-subtle peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring"
          style={{ minHeight: 92 }}
        >
          <span className="flex items-center gap-3" style={{ minHeight: 92 }}>
            <span
              className="flex h-11 w-11 items-center justify-center rounded-md"
              style={{ backgroundColor: "#CCFBF1", color: "#0F766E" }}
            >
              <Upload size={20} />
            </span>
            <span>
              <span className="block text-[14px] font-semibold text-foreground">이미지 선택</span>
              <span className="block text-[12px] text-muted-foreground">
                jpg, png, webp · 최대 10MB
              </span>
            </span>
          </span>
        </div>
      </div>

      {value.length > 0 && (
        <ul className="mt-2 grid grid-cols-3 gap-2">
          {value.map((image) => (
            <li
              key={image.id}
              className="relative overflow-hidden rounded-md border border-border bg-subtle"
              style={{ aspectRatio: "1 / 1" }}
            >
              <img
                src={image.dataUrl}
                alt={`${label} 미리보기`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                aria-label="이미지 삭제"
                onClick={() => removeImage(image.id)}
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-foreground shadow-card"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.length === 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <ImageIcon size={14} />
          <span>선택된 이미지 없음</span>
        </div>
      )}

      {error && (
        <p className="mt-1 text-[12px]" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}
