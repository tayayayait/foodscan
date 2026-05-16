import type { Product, UserPreferences } from "./types";
import type { GeminiOcrResult } from "./gemini-ocr";
import { queueAccountSnapshotSync } from "./account-sync";
import { buildLocalDataExport, type LocalDataExport } from "./local-data-portability";
import { normalizePreferences } from "./preferences";
import {
  isSavedProduct,
  removeSavedProduct,
  savedProductItems,
  type SavedProductItem,
  toggleSavedProduct,
  upsertSavedProduct,
} from "./saved-products";

const RECENT_KEY = "kfs:recent";
const PREFS_KEY = "kfs:prefs";
const PROVISIONAL_KEY = "kfs:provisional";
const OCR_DRAFT_KEY = "kfs:ocr-drafts";
const RECENT_SEARCH_KEY = "kfs:recent-searches";
const SAVED_PRODUCTS_KEY = "kfs:saved-products";

export interface OcrDraft {
  id: string;
  imageUrl: string;
  result: GeminiOcrResult;
  createdAt: string;
}

const isBrowser = typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function remove(key: string) {
  if (!isBrowser) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function queueCurrentAccountSync() {
  if (!isBrowser) return;
  queueAccountSnapshotSync(exportLocalDataSnapshot());
}

export function getRecent(): Product[] {
  return read<Product[]>(RECENT_KEY, []);
}

export function pushRecent(p: Product) {
  const list = getRecent().filter((x) => x.id !== p.id);
  list.unshift(p);
  write(RECENT_KEY, list.slice(0, 10));
  queueCurrentAccountSync();
}

export const DEFAULT_PREFS: UserPreferences = {
  foodAlerts: [],
  dietaryPreferences: [],
};

export function getPrefs(): UserPreferences {
  return normalizePreferences(read<UserPreferences>(PREFS_KEY, DEFAULT_PREFS));
}

export function setPrefs(p: UserPreferences) {
  write(PREFS_KEY, normalizePreferences(p));
  queueCurrentAccountSync();
}

export function getProvisional(): Product[] {
  return read<Product[]>(PROVISIONAL_KEY, []);
}

export function pushProvisional(p: Product) {
  const list = getProvisional().filter((x) => x.id !== p.id);
  list.unshift(p);
  write(PROVISIONAL_KEY, list.slice(0, 50));
  queueCurrentAccountSync();
}

export function getProductById(id: string): Product | null {
  return (
    getSavedProducts().find((p) => p.id === id) ||
    getRecent().find((p) => p.id === id) ||
    getProvisional().find((p) => p.id === id) ||
    null
  );
}

export function getSavedProductRecords(): SavedProductItem[] {
  return read<SavedProductItem[]>(SAVED_PRODUCTS_KEY, []);
}

export function getSavedProducts(): Product[] {
  return savedProductItems(getSavedProductRecords());
}

export function isProductSaved(productId: string): boolean {
  return isSavedProduct(getSavedProductRecords(), productId);
}

export function saveProduct(product: Product) {
  write(SAVED_PRODUCTS_KEY, upsertSavedProduct(getSavedProductRecords(), product));
  queueCurrentAccountSync();
}

export function unsaveProduct(productId: string) {
  write(SAVED_PRODUCTS_KEY, removeSavedProduct(getSavedProductRecords(), productId));
  queueCurrentAccountSync();
}

export function toggleSavedProductRecord(product: Product) {
  const next = toggleSavedProduct(getSavedProductRecords(), product);
  write(SAVED_PRODUCTS_KEY, next);
  queueCurrentAccountSync();
  return isSavedProduct(next, product.id);
}

export function getRecentSearches(): string[] {
  return read<string[]>(RECENT_SEARCH_KEY, []);
}

export function hasStoredPrefs(): boolean {
  return isBrowser && localStorage.getItem(PREFS_KEY) !== null;
}

export function exportLocalDataSnapshot(): LocalDataExport {
  return buildLocalDataExport({
    recent: getRecent(),
    savedProducts: getSavedProductRecords(),
    provisional: getProvisional(),
    preferences: hasStoredPrefs() ? getPrefs() : null,
    ocrDrafts: getOcrDrafts(),
    recentSearches: getRecentSearches(),
  });
}

export function importLocalDataSnapshot(snapshot: LocalDataExport) {
  const normalized = buildLocalDataExport(snapshot.data, snapshot.exportedAt);
  write(RECENT_KEY, normalized.data.recent);
  write(SAVED_PRODUCTS_KEY, normalized.data.savedProducts);
  write(PROVISIONAL_KEY, normalized.data.provisional);
  write(OCR_DRAFT_KEY, normalized.data.ocrDrafts);
  write(RECENT_SEARCH_KEY, normalized.data.recentSearches);
  if (normalized.data.preferences) {
    write(PREFS_KEY, normalized.data.preferences);
  } else {
    remove(PREFS_KEY);
  }
  queueCurrentAccountSync();
}

export function pushRecentSearch(query: string) {
  const normalized = query.trim();
  if (!normalized) return;
  const list = getRecentSearches().filter((item) => item !== normalized);
  list.unshift(normalized);
  write(RECENT_SEARCH_KEY, list.slice(0, 5));
  queueCurrentAccountSync();
}

export function saveOcrDraft(result: GeminiOcrResult, imageUrl: string) {
  const id = `ocr-${Date.now()}`;
  const drafts = read<OcrDraft[]>(OCR_DRAFT_KEY, []).filter((draft) => draft.id !== id);
  const draft: OcrDraft = {
    id,
    result,
    imageUrl,
    createdAt: new Date().toISOString(),
  };
  write(OCR_DRAFT_KEY, [draft, ...drafts].slice(0, 5));
  queueCurrentAccountSync();
  return draft;
}

export function getOcrDrafts(): OcrDraft[] {
  return read<OcrDraft[]>(OCR_DRAFT_KEY, []);
}

export function getOcrDraft(id: string): OcrDraft | null {
  return getOcrDrafts().find((draft) => draft.id === id) ?? null;
}
