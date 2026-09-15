#!/usr/bin/env python3
"""
Récupère les images des pièces de 2 euros depuis le site de la BCE.

  pip install requests beautifulsoup4

  python scrape_ecb.py --inspect 2015   # dump la structure HTML d'une page
  python scrape_ecb.py --comm           # toutes les commémoratives 2004 -> aujourd'hui
  python scrape_ecb.py --national       # les faces nationales courantes
  python scrape_ecb.py --comm --national

Sortie :
  data/images/<slug>.jpg
  data/catalog.json
"""

import argparse
import json
import re
import time
import unicodedata
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://www.ecb.europa.eu"
COMM_URL = BASE + "/euro/coins/comm/html/comm_{year}.en.html"
NATIONAL_URL = BASE + "/euro/coins/2euro/html/index.en.html"

OUT = Path("data")
IMG_DIR = OUT / "images"

HEADERS = {"User-Agent": "coin-collection-perso/1.0 (projet personnel)"}
DELAY = 1.0  # politesse : 1 requête/seconde


# --------------------------------------------------------------------------
# utilitaires
# --------------------------------------------------------------------------

def slugify(*parts: str) -> str:
    raw = "_".join(p for p in parts if p)
    raw = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode()
    raw = re.sub(r"[^a-zA-Z0-9]+", "_", raw).strip("_").lower()
    return re.sub(r"_+", "_", raw)[:80]


def get(url: str) -> BeautifulSoup:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    time.sleep(DELAY)
    return BeautifulSoup(r.text, "html.parser")


def download(url: str, dest: Path) -> bool:
    if dest.exists():
        return True
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"    ! échec {url} : {e}")
        return False
    dest.write_bytes(r.content)
    time.sleep(DELAY)
    return True


def is_coin_image(src: str) -> bool:
    """Filtre les logos, icônes, pixels de tracking."""
    if not src or src.startswith("data:"):
        return False
    if not re.search(r"\.(jpe?g|png)(\?|$)", src, re.I):
        return False
    if "/euro/coins/" not in src:
        return False
    if any(x in src.lower() for x in ("logo", "icon", "socialmedia", "shared/img/ui")):
        return False
    return True


def context_text(img) -> str:
    """Remonte dans le DOM jusqu'à trouver un bloc avec du texte exploitable."""
    node = img
    for _ in range(5):
        node = node.parent
        if node is None:
            break
        txt = " ".join(node.get_text(" ", strip=True).split())
        if 3 < len(txt) < 600:
            return txt
    return (img.get("alt") or "").strip()


# --------------------------------------------------------------------------
# mode inspection : à lancer EN PREMIER pour vérifier la structure réelle
# --------------------------------------------------------------------------

def inspect(year: int) -> None:
    soup = get(COMM_URL.format(year=year))
    main = soup.find("main") or soup.find(id="main-wrapper") or soup
    imgs = [i for i in main.find_all("img") if is_coin_image(i.get("src", ""))]
    print(f"{len(imgs)} images candidates sur comm_{year}\n")
    for img in imgs[:5]:
        print("src   :", img.get("src"))
        print("alt   :", img.get("alt"))
        print("parent:", img.parent.name, img.parent.get("class"))
        print("texte :", context_text(img)[:200])
        print("-" * 60)


# --------------------------------------------------------------------------
# scraping
# --------------------------------------------------------------------------

def scrape_comm(year: int) -> list[dict]:
    url = COMM_URL.format(year=year)
    try:
        soup = get(url)
    except requests.HTTPError:
        print(f"  comm_{year} : page absente")
        return []

    main = soup.find("main") or soup.find(id="main-wrapper") or soup
    imgs = [i for i in main.find_all("img") if is_coin_image(i.get("src", ""))]
    print(f"  comm_{year} : {len(imgs)} images")

    coins, seen = [], set()
    for img in imgs:
        src = urljoin(url, img["src"].split("?")[0])
        if src in seen:
            continue
        seen.add(src)

        desc = context_text(img)
        # le nom de fichier BCE commence souvent par le code pays : be_2015_xxx.jpg
        fname = Path(src).stem
        code = fname.split("_")[0].lower()
        country = code if len(code) == 2 else ""

        slug = slugify(str(year), fname)
        dest = IMG_DIR / f"{slug}.jpg"
        if not download(src, dest):
            continue

        coins.append({
            "id": slug,
            "type": "commemorative",
            "annee": year,
            "pays_code": country,
            "theme": desc,
            "image": str(dest.relative_to(OUT)),
            "source": src,
        })
    return coins


def scrape_national() -> list[dict]:
    soup = get(NATIONAL_URL)
    main = soup.find("main") or soup.find(id="main-wrapper") or soup
    imgs = [i for i in main.find_all("img") if is_coin_image(i.get("src", ""))]
    print(f"  faces nationales : {len(imgs)} images")

    coins, seen = [], set()
    for img in imgs:
        src = urljoin(NATIONAL_URL, img["src"].split("?")[0])
        if src in seen:
            continue
        seen.add(src)

        desc = context_text(img)
        fname = Path(src).stem
        slug = slugify("courante", fname)
        dest = IMG_DIR / f"{slug}.jpg"
        if not download(src, dest):
            continue

        coins.append({
            "id": slug,
            "type": "courante",
            "annee": None,
            "pays_code": fname.split("_")[0].lower(),
            "theme": desc,
            "image": str(dest.relative_to(OUT)),
            "source": src,
        })
    return coins


# --------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inspect", type=int, metavar="ANNEE")
    ap.add_argument("--comm", action="store_true")
    ap.add_argument("--national", action="store_true")
    ap.add_argument("--from-year", type=int, default=2004)
    args = ap.parse_args()

    if args.inspect:
        inspect(args.inspect)
        return

    if not (args.comm or args.national):
        ap.error("précise --comm et/ou --national (ou --inspect ANNEE)")

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    catalog: list[dict] = []

    if args.national:
        print("Faces nationales courantes")
        catalog += scrape_national()

    if args.comm:
        print("Commémoratives")
        for year in range(args.from_year, date.today().year + 1):
            catalog += scrape_comm(year)

    path = OUT / "catalog.json"
    path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{len(catalog)} pièces -> {path}")


if __name__ == "__main__":
    main()
