#!/usr/bin/env python3
"""Import MFDS processed-food nutrition XLSX data into Supabase.

The source workbook is large, so this script reads the XLSX zip/XML structure
directly with Python stdlib instead of loading the full workbook into memory.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zipfile


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

TABLE = "nutrition_products"
EXCEL_EPOCH = dt.date(1899, 12, 30)

SOURCE_TO_DB = {
    "식품코드": "food_code",
    "식품명": "name",
    "식품소분류명": "small_category",
    "영양성분함량기준량": "basis_amount",
    "에너지(kcal)": "energy_kcal",
    "당류(g)": "sugars_g",
    "나트륨(mg)": "sodium_mg",
    "포화지방산(g)": "saturated_fat_g",
    "단백질(g)": "protein_g",
    "출처명": "source_name",
    "1회 섭취참고량": "serving_size",
    "식품중량": "food_weight",
    "품목제조보고번호": "report_no",
    "제조사명": "manufacturer",
    "데이터생성일자": "data_created_date",
    "데이터기준일자": "data_basis_date",
}

OPTIONAL_SOURCE_TO_DB = {
    "식품대분류명": "large_category",
    "대표식품명": "representative_food",
}

CSV_COLUMNS = [
    "food_code",
    "report_no",
    "name",
    "normalized_name",
    "manufacturer",
    "normalized_manufacturer",
    "category",
    "large_category",
    "representative_food",
    "small_category",
    "basis_amount",
    "serving_size",
    "food_weight",
    "energy_kcal",
    "sugars_g",
    "sodium_mg",
    "saturated_fat_g",
    "protein_g",
    "source_name",
    "data_created_date",
    "data_basis_date",
]

NUMBER_COLUMNS = {
    "energy_kcal",
    "sugars_g",
    "sodium_mg",
    "saturated_fat_g",
    "protein_g",
}

DATE_COLUMNS = {"data_created_date", "data_basis_date"}


def clean_text(value: object) -> str:
    return str(value or "").replace("\ufeff", "").strip()


def normalize(value: object) -> str:
    text = clean_text(value).lower()
    text = re.sub(r"[\s()\[\]{}·ㆍ,./\\_-]+", "", text)
    text = text.replace("주식회사", "주").replace("㈜", "주")
    return text


def parse_number(value: object) -> float | None:
    text = clean_text(value)
    if not text or text in {"-", "해당없음"}:
        return None
    text = text.replace(",", "")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    return float(match.group(0))


def parse_date(value: object) -> str | None:
    text = clean_text(value)
    if not text or text in {"-", "해당없음"}:
        return None
    if re.fullmatch(r"\d+(?:\.0)?", text):
        return (EXCEL_EPOCH + dt.timedelta(days=int(float(text)))).isoformat()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d"):
        try:
            return dt.datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def col_to_idx(cell_ref: str) -> int:
    number = 0
    for char in cell_ref:
        if not char.isalpha():
            break
        number = number * 26 + (ord(char.upper()) - 64)
    return number - 1


def load_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []

    values: list[str] = []
    with zf.open("xl/sharedStrings.xml") as handle:
        for _, elem in ET.iterparse(handle, events=("end",)):
            if elem.tag.endswith("}si"):
                values.append("".join(t.text or "" for t in elem.iter() if t.tag.endswith("}t")))
                elem.clear()
    return values


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    raw = ""
    inline = None
    for child in cell:
        if child.tag.endswith("}v"):
            raw = child.text or ""
            break
        if child.tag.endswith("}is"):
            inline = "".join(t.text or "" for t in child.iter() if t.tag.endswith("}t"))
            break
    if inline is not None:
        return clean_text(inline)
    if cell.attrib.get("t") == "s" and raw:
        return clean_text(shared_strings[int(raw)])
    return clean_text(raw)


def iter_sheet_rows(xlsx_path: Path):
    with zipfile.ZipFile(xlsx_path) as zf:
        shared_strings = load_shared_strings(zf)
        with zf.open("xl/worksheets/sheet1.xml") as handle:
            for _, row_elem in ET.iterparse(handle, events=("end",)):
                if not row_elem.tag.endswith("}row"):
                    continue
                row: dict[int, str] = {}
                for cell in row_elem:
                    if not cell.tag.endswith("}c"):
                        continue
                    row[col_to_idx(cell.attrib.get("r", ""))] = cell_value(cell, shared_strings)
                row_elem.clear()
                yield row


def transform_row(source: dict[str, str]) -> dict[str, object] | None:
    row: dict[str, object] = {}
    for source_name, db_name in {**SOURCE_TO_DB, **OPTIONAL_SOURCE_TO_DB}.items():
        value = source.get(source_name, "")
        if db_name in NUMBER_COLUMNS:
            row[db_name] = parse_number(value)
        elif db_name in DATE_COLUMNS:
            row[db_name] = parse_date(value)
        else:
            row[db_name] = clean_text(value) or None

    if not row.get("food_code") or not row.get("name"):
        return None

    row["category"] = row.get("small_category")
    row["normalized_name"] = normalize(row["name"])
    row["normalized_manufacturer"] = normalize(row.get("manufacturer")) or None
    return {key: row.get(key) for key in CSV_COLUMNS}


def iter_nutrition_rows(xlsx_path: Path, limit: int | None = None):
    row_iter = iter_sheet_rows(xlsx_path)
    header_cells = next(row_iter)
    headers = {idx: clean_text(value) for idx, value in header_cells.items()}
    missing = [name for name in SOURCE_TO_DB if name not in headers.values()]
    if missing:
        raise RuntimeError(f"Missing required columns: {', '.join(missing)}")

    source_headers = {**SOURCE_TO_DB, **OPTIONAL_SOURCE_TO_DB}
    idx_to_header = {idx: header for idx, header in headers.items() if header in source_headers}
    emitted = 0
    for cells in row_iter:
        source = {header: cells.get(idx, "") for idx, header in idx_to_header.items()}
        row = transform_row(source)
        if not row:
            continue
        yield row
        emitted += 1
        if limit is not None and emitted >= limit:
            break


def read_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def supabase_config(env_path: Path) -> tuple[str, str]:
    merged = {**read_env_file(env_path), **os.environ}
    supabase_url = merged.get("SUPABASE_URL") or merged.get("VITE_SUPABASE_URL")
    rest_url = merged.get("SUPABASE_REST_URL") or merged.get("VITE_SUPABASE_REST_URL")
    if not rest_url and supabase_url:
        rest_url = f"{supabase_url.rstrip('/')}/rest/v1"
    api_key = (
        merged.get("SUPABASE_SERVICE_ROLE_KEY")
        or merged.get("SUPABASE_ANON_KEY")
        or merged.get("VITE_SUPABASE_ANON_KEY")
    )
    if not rest_url or not api_key:
        raise RuntimeError("SUPABASE_REST_URL/SUPABASE_URL and Supabase API key are required")
    return rest_url.rstrip("/"), api_key


def post_batch(rest_url: str, api_key: str, rows: list[dict[str, object]]) -> None:
    url = f"{rest_url}/{TABLE}?on_conflict=food_code"
    data = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            if response.status not in {200, 201, 204}:
                raise RuntimeError(f"Supabase returned HTTP {response.status}")
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase import failed: HTTP {error.code} {body}") from error


def write_csv(path: Path, rows) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
            count += 1
    return count


def upload_supabase(rows, env_path: Path, batch_size: int) -> int:
    rest_url, api_key = supabase_config(env_path)
    batch: list[dict[str, object]] = []
    count = 0
    for row in rows:
        batch.append(row)
        if len(batch) >= batch_size:
            post_batch(rest_url, api_key, batch)
            count += len(batch)
            print(f"uploaded {count}", flush=True)
            batch.clear()
    if batch:
        post_batch(rest_url, api_key, batch)
        count += len(batch)
        print(f"uploaded {count}", flush=True)
    return count


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "xlsx",
        type=Path,
        nargs="?",
        help="Source XLSX. Defaults to public/20260402_*.xlsx",
    )
    parser.add_argument("--csv", type=Path, help="Write normalized rows to CSV instead of Supabase")
    parser.add_argument("--supabase", action="store_true", help="Upsert rows into Supabase REST")
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true", help="Print five normalized rows only")
    args = parser.parse_args()

    xlsx_path = args.xlsx
    if xlsx_path is None:
        matches = sorted(Path("public").glob("20260402_*.xlsx"))
        if not matches:
            raise FileNotFoundError("public/20260402_*.xlsx")
        xlsx_path = matches[0]

    if not xlsx_path.exists():
        raise FileNotFoundError(xlsx_path)

    rows = iter_nutrition_rows(xlsx_path, args.limit)
    if args.dry_run:
        sample = []
        for _, row in zip(range(5), rows):
            sample.append(row)
        print(json.dumps(sample, ensure_ascii=False, indent=2))
        return 0

    if args.csv:
        count = write_csv(args.csv, rows)
    elif args.supabase:
        count = upload_supabase(rows, args.env_file, args.batch_size)
    else:
        parser.error("Specify --csv, --supabase, or --dry-run")

    print(f"processed {count} rows")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
