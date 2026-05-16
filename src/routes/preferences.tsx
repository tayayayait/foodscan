import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import { getPrefs, setPrefs, DEFAULT_PREFS } from "@/lib/storage";
import {
  DIETARY_PREFERENCE_OPTIONS,
  FOOD_ALERT_OPTIONS,
  buildPreferenceSummary,
  normalizePreferences,
} from "@/lib/preferences";
import type { DietaryPreference, FoodAlertPreference, UserPreferences } from "@/lib/types";

export const Route = createFileRoute("/preferences")({
  head: () => ({
    meta: [
      { title: "개인 기준 - 식품 스캔" },
      { name: "description", content: "성분 알림과 식이 선호 설정" },
    ],
  }),
  component: PrefsPage,
});

function PrefsPage() {
  const [prefs, setPrefsState] = useState<UserPreferences>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  const summary = buildPreferenceSummary(prefs);

  useEffect(() => setPrefsState(getPrefs()), []);

  const updatePrefs = (updater: (current: UserPreferences) => UserPreferences) => {
    setPrefsState((current) => normalizePreferences(updater(current)));
    setSaved(false);
  };

  const toggleFoodAlert = (key: FoodAlertPreference) => {
    updatePrefs((current) => ({
      ...current,
      foodAlerts: current.foodAlerts.includes(key)
        ? current.foodAlerts.filter((item) => item !== key)
        : [...current.foodAlerts, key],
    }));
  };

  const toggleDietaryPreference = (key: DietaryPreference) => {
    updatePrefs((current) => ({
      ...current,
      dietaryPreferences: current.dietaryPreferences.includes(key)
        ? current.dietaryPreferences.filter((item) => item !== key)
        : [...current.dietaryPreferences, key],
    }));
  };

  const save = () => {
    setPrefs(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppShell title="개인 기준">
      <div className="space-y-6 pt-4">
        <section className="rounded-md border border-border bg-surface p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-bold">현재 개인 기준</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">{summary.description}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {summary.badges.length === 0 ? (
                <span className="rounded-[4px] bg-subtle px-2 py-1 text-[12px] font-semibold text-muted-foreground">
                  선택한 기준 없음
                </span>
              ) : (
                summary.badges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-[4px] bg-[#ECFDF5] px-2 py-1 text-[12px] font-bold text-[#047857]"
                  >
                    {badge}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        <PreferenceSection
          title="성분 알림"
          description="선택한 성분이 제품에 있으면 상세 화면에서 경고합니다."
        >
          {FOOD_ALERT_OPTIONS.map((option) => {
            const checked = prefs.foodAlerts.includes(option.key);
            return (
              <PreferenceRow
                key={option.key}
                label={option.label}
                description={option.desc}
                checked={checked}
                onCheckedChange={() => toggleFoodAlert(option.key)}
              />
            );
          })}
        </PreferenceSection>

        <PreferenceSection
          title="식이 선호"
          description="선택한 식이 선호와 맞지 않는 제품은 경고하고 추천에서 제외합니다."
        >
          {DIETARY_PREFERENCE_OPTIONS.map((option) => {
            const checked = prefs.dietaryPreferences.includes(option.key);
            return (
              <PreferenceRow
                key={option.key}
                label={option.label}
                description={option.desc}
                checked={checked}
                onCheckedChange={() => toggleDietaryPreference(option.key)}
              />
            );
          })}
        </PreferenceSection>

        <div className="sticky bottom-20 z-20 md:bottom-4">
          <button
            onClick={save}
            className="w-full rounded-md font-semibold text-white"
            style={{ height: 48, backgroundColor: "#0F766E", fontSize: 15 }}
          >
            {saved ? "저장되었습니다" : "개인 기준 저장"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function PreferenceSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[18px] font-bold">{title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        <div className="divide-y divide-border">{children}</div>
      </div>
    </section>
  );
}

function PreferenceRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <label className="flex min-h-[72px] cursor-pointer items-center justify-between gap-4 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-foreground">{label}</span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </label>
  );
}
