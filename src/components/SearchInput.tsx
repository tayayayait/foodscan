import { Clock, Search, X } from "lucide-react";
import { useState, useEffect } from "react";

interface Props {
  value?: string;
  defaultValue?: string;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  suggestions?: string[];
}

export function SearchInput({
  value,
  defaultValue,
  onSubmit,
  placeholder = "제품명, 제조사, 바코드 검색",
  autoFocus,
  suggestions = [],
}: Props) {
  const [internal, setInternal] = useState(defaultValue || "");
  const [focused, setFocused] = useState(false);
  const v = value !== undefined ? value : internal;
  const visibleSuggestions = suggestions
    .filter((item) => item.trim().length > 0 && item !== v.trim())
    .slice(0, 5);

  useEffect(() => {
    if (defaultValue !== undefined) setInternal(defaultValue);
  }, [defaultValue]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(v.trim());
      }}
      className="relative"
    >
      <Search
        size={20}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: "#64748B" }}
      />
      <input
        type="search"
        value={v}
        onChange={(e) => setInternal(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label="검색"
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        className="w-full bg-surface text-foreground placeholder:text-[#94A3B8]"
        style={{
          height: 48,
          borderRadius: 8,
          border: "1px solid #CBD5E1",
          paddingLeft: 44,
          paddingRight: v ? 48 : 14,
          fontSize: 16,
        }}
      />
      {v && (
        <button
          type="button"
          aria-label="입력 지우기"
          onClick={() => {
            setInternal("");
            onSubmit?.("");
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-[#64748B]"
        >
          <X size={18} />
        </button>
      )}
      {focused && visibleSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-[54px] z-30 overflow-hidden rounded-md border border-border bg-surface shadow-modal">
          <ul className="py-1">
            {visibleSuggestions.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setInternal(item);
                    onSubmit?.(item);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] text-foreground hover:bg-subtle"
                >
                  <Clock size={15} style={{ color: "#64748B" }} />
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
