import type { Product } from "./types";

export interface SavedProductItem {
  product: Product;
  savedAt: string;
}

const MAX_SAVED_PRODUCTS = 50;

export function isSavedProduct(items: SavedProductItem[], productId: string) {
  return items.some((item) => item.product.id === productId);
}

export function upsertSavedProduct(
  items: SavedProductItem[],
  product: Product,
  savedAt = new Date().toISOString(),
): SavedProductItem[] {
  const next = items.filter((item) => item.product.id !== product.id);
  next.unshift({ product, savedAt });
  return next.slice(0, MAX_SAVED_PRODUCTS);
}

export function removeSavedProduct(items: SavedProductItem[], productId: string) {
  return items.filter((item) => item.product.id !== productId);
}

export function toggleSavedProduct(
  items: SavedProductItem[],
  product: Product,
  savedAt = new Date().toISOString(),
) {
  return isSavedProduct(items, product.id)
    ? removeSavedProduct(items, product.id)
    : upsertSavedProduct(items, product, savedAt);
}

export function savedProductItems(items: SavedProductItem[]) {
  return items.map((item) => item.product);
}
