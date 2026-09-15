#!/usr/bin/env python3
"""
Récupère les images des pièces de 2 euros depuis le site de la BCE.

  pip install requests beautifulsoup4

  python scrape_ecb.py --inspect 2015        # vérifier la structure
  python scrape_ecb.py --inspect courantes   # idem sur les faces nationales
  python scrape_ecb.py --comm           # commémoratives 2004 -> aujourd'hui
  python scrape_ecb.py --courantes      # faces nationales des 8 valeurs
  python scrape_ecb.py --comm --courantes

Sortie :
  data/images/<slug>.jpg
  data/catalog.json

Structure des pages commémoratives (vérifiée sur comm_2015) :

    <img src="comm_2015/comm_2015_lithuania.jpg">   <- src RELATIF
    <h3>Lithuania</h3>
    <p><strong>Feature:</strong> The Lithuanian language</p>
    <p><strong>Description:</strong> ...</p>

Les émissions communes font exception : une dizaine d'images consécutives
partagent un seul <h3> « Euro area countries ». Le pays est alors tiré du nom
de fichier (joint_comm_2015_Austria.jpg).
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
# Une page par valeur faciale. La clé est la valeur en centimes.
COURANTES_URLS = {
    1:   BASE + "/euro/coins/1cent/html/index.en.html",
    2:   BASE + "/euro/coins/2cents/html/index.en.html",
    5:   BASE + "/euro/coins/5cents/html/index.en.html",
    10:  BASE + "/euro/coins/10cents/html/index.en.html",
    20:  BASE + "/euro/coins/20cents/html/index.en.html",
    50:  BASE + "/euro/coins/50cents/html/index.en.html",
    100: BASE + "/euro/coins/1euro/html/index.en.html",
    200: BASE + "/euro/coins/2euro/html/index.en.html",
}

LIBELLES = {
    1: "1 centime", 2: "2 centimes", 5: "5 centimes", 10: "10 centimes",
    20: "20 centimes", 50: "50 centimes", 100: "1 euro", 200: "2 euros",
}

OUT = Path(__file__).resolve().parent
IMG_DIR = OUT / "images"

HEADERS = {"User-Agent": "coin-collection-perso/1.0 (projet personnel)"}
DELAY = 1.0

# Nom anglais -> code ISO. Les <h3> des pages BCE sont en anglais.
CODES = {
    "andorra": "ad", "austria": "at", "belgium": "be", "bulgaria": "bg",
    "croatia": "hr", "cyprus": "cy", "estonia": "ee", "finland": "fi",
    "france": "fr", "germany": "de", "greece": "gr", "ireland": "ie",
    "italy": "it", "latvia": "lv", "lithuania": "lt", "luxembourg": "lu",
    "malta": "mt", "monaco": "mc", "netherlands": "nl", "nederland": "nl",
    "portugal": "pt", "san marino": "sm", "slovakia": "sk", "slovenia": "si",
    "spain": "es", "vatican city": "va", "vatican": "va",
    "marino": "sm", "holland": "nl", "hellenic republic": "gr",
    "deutschland": "de", "espana": "es", "italia": "it"

}


def slugify(*parts: str) -> str:
    raw = "_".join(p for p in parts if p)
    raw = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode()
    raw = re.sub(r"[^a-zA-Z0-9]+", "_", raw).strip("_").lower()
    return re.sub(r"_+", "_", raw)[:80]


def code_pays(nom: str) -> str:
    """
    Tolère les noms de fichiers irréguliers : chiffres collés (Austria1),
    article initial (The Netherlands), troncature (Marino pour San Marino).
    """
    texte = unicodedata.normalize("NFKD", nom).encode("ascii", "ignore").decode()
    texte = re.sub(r"[^a-zA-Z ]", " ", texte).lower()
    texte = re.sub(r"\s+", " ", texte).strip()
    texte = re.sub(r"^the ", "", texte)

    if texte in CODES:
        return CODES[texte]

    # Sinon, on cherche un nom de pays connu à l'intérieur de la chaîne.
    for connu, code in sorted(CODES.items(), key=lambda kv: -len(kv[0])):
        if connu in texte:
            return code
    return ""


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


def url_image(img, page_url: str) -> str | None:
    """
    Résout le src en URL absolue PUIS filtre. L'ordre compte : les src des
    pages BCE sont relatifs à la page, donc filtrer sur le src brut ne
    reconnaît aucune image.
    """
    src = img.get("src") or img.get("data-src") or ""
    if not src or src.startswith("data:"):
        return None

    absolu = urljoin(page_url, src.split("?")[0])

    if not re.search(r"\.(jpe?g|png)$", absolu, re.I):
        return None
    if "/euro/coins/" not in absolu:
        return None
    if any(x in absolu.lower() for x in ("logo", "icon", "socialmedia", "/shared/img/ui")):
        return None
    return absolu


def texte_apres(titre, prefixe: str) -> str:
    """Cherche, entre ce <h3> et le suivant, le paragraphe 'Feature:' ou équivalent."""
    for suivant in titre.find_all_next():
        if suivant.name in ("h2", "h3"):
            break
        if suivant.name in ("p", "div", "li"):
            texte = " ".join(suivant.get_text(" ", strip=True).split())
            if texte.lower().startswith(prefixe.lower()):
                valeur = texte.split(":", 1)[-1]
                # Sur certaines années, Feature et Description partagent un
                # même paragraphe : on coupe avant la description.
                valeur = re.split(r"\s*Description\s*:", valeur, maxsplit=1)[0]
                return valeur.strip()
    return ""


def blocs(soup: BeautifulSoup, page_url: str) -> list[dict]:
    """
    Parcourt la page dans l'ordre et regroupe chaque série d'images avec le
    titre qui la suit.
    """
    racine = soup.find("main") or soup.find(id="main-wrapper") or soup
    resultats, tampon = [], []

    for element in racine.find_all(["img", "h3"]):
        if element.name == "img":
            url = url_image(element, page_url)
            if url:
                tampon.append(url)
        else:
            if tampon:
                resultats.append({
                    "images": tampon,
                    "pays": element.get_text(" ", strip=True),
                    "theme": texte_apres(element, "Feature"),
                })
                tampon = []

    return resultats


# --------------------------------------------------------------------- inspect

def inspect(cible: str) -> None:
    url = COURANTES_URLS[200] if cible == "courantes" else COMM_URL.format(year=cible)
    soup = get(url)
    racine = soup.find("main") or soup.find(id="main-wrapper") or soup

    toutes = racine.find_all("img")
    retenues = [u for i in toutes if (u := url_image(i, url))]
    print(f"{len(toutes)} balises img au total, {len(retenues)} retenues comme pièces\n")

    if not retenues and toutes:
        print("Aucune retenue. Voici les src bruts des 5 premières :")
        for i in toutes[:5]:
            print("  ", i.get("src"), "| data-src:", i.get("data-src"))
        print()

    for b in blocs(soup, url)[:4]:
        print("pays  :", b["pays"])
        print("thème :", b["theme"][:120])
        print("images:", len(b["images"]))
        for u in b["images"][:3]:
            print("   ", u)
        print("-" * 60)


# -------------------------------------------------------------------- scraping

def scrape_comm(year: int) -> list[dict]:
    url = COMM_URL.format(year=year)
    try:
        soup = get(url)
    except requests.HTTPError:
        print(f"  comm_{year} : page absente")
        return []

    pieces, vues = [], set()

    for bloc in blocs(soup, url):
        commune = len(bloc["images"]) > 1  # émission commune à plusieurs pays

        for image in bloc["images"]:
            if image in vues:
                continue
            vues.add(image)

            nom_fichier = Path(image).stem
            if commune:
                # joint_comm_2015_Austria -> Austria
                brut = nom_fichier.split("_")[-1].replace("-", " ")
                pays, code = brut, code_pays(brut)
                if not code:
                    # Le nom de fichier ne porte pas de pays : on retombe sur
                    # le titre de la section.
                    pays, code = bloc["pays"], code_pays(bloc["pays"])
            else:
                pays, code = bloc["pays"], code_pays(bloc["pays"])

            slug = slugify(str(year), nom_fichier)
            dest = IMG_DIR / f"{slug}.jpg"
            if not download(image, dest):
                continue

            pieces.append({
                "id": slug,
                "valeur": 200,   # seule la pièce de 2 euros est commémorable
                "type": "commemorative",
                "annee": year,
                "pays_code": code,
                "pays_source": pays,
                "theme": bloc["theme"],
                "version_face": None,
                "image": f"images/{dest.name}",
                "source": image,
            })

    manquants = sum(1 for p in pieces if not p["pays_code"])
    print(f"  comm_{year} : {len(pieces)} pièces" +
          (f" ({manquants} sans code pays)" if manquants else ""))
    return pieces


def scrape_courantes() -> list[dict]:
    """
    Faces nationales des huit valeurs. Quand plusieurs images se partagent un
    même pays, ce sont des versions successives de la face (refontes belges,
    espagnoles, vaticanes) : on les garde comme des types distincts.
    """
    pieces, vues = [], set()

    for valeur, url in COURANTES_URLS.items():
        try:
            soup = get(url)
        except requests.HTTPError:
            print(f"  {LIBELLES[valeur]} : page absente")
            continue

        compte = 0
        for bloc in blocs(soup, url):
            for rang, image in enumerate(bloc["images"], 1):
                if image in vues:
                    continue
                # Le filtre porte sur le nom de fichier, pas sur le chemin :
                # les faces nationales vivent sous /coins/common/shared/img/.
                if "common" in Path(image).stem.lower():
                    continue
                vues.add(image)

                versions = len(bloc["images"])
                version = f"version {rang}" if versions > 1 else None

                slug = slugify("courante", str(valeur), Path(image).stem)
                dest = IMG_DIR / f"{slug}.jpg"
                if not download(image, dest):
                    continue

                pieces.append({
                    "id": slug,
                    "valeur": valeur,
                    "type": "courante",
                    "annee": None,
                    "pays_code": code_pays(bloc["pays"]),
                    "pays_source": bloc["pays"],
                    "theme": None,
                    "version_face": version,
                    "image": f"images/{dest.name}",
                    "source": image,
                })
                compte += 1

        print(f"  {LIBELLES[valeur]} : {compte} faces")

    return pieces


# ------------------------------------------------------------------------ main

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inspect", metavar="ANNEE|courantes")
    ap.add_argument("--comm", action="store_true")
    ap.add_argument("--courantes", action="store_true",
                    help="faces nationales des huit valeurs")
    ap.add_argument("--from-year", type=int, default=2004)
    args = ap.parse_args()

    if args.inspect:
        inspect(args.inspect)
        return

    if not (args.comm or args.courantes):
        ap.error("précise --comm et/ou --national (ou --inspect ANNEE)")

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    catalogue: list[dict] = []

    if args.courantes:
        print("Faces nationales courantes")
        catalogue += scrape_courantes()

    if args.comm:
        print("Commémoratives")
        for year in range(args.from_year, date.today().year + 1):
            catalogue += scrape_comm(year)

    chemin = OUT / "catalog.json"
    chemin.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2), encoding="utf-8")

    sans_code = [p["pays_source"] for p in catalogue if not p["pays_code"]]
    print(f"\n{len(catalogue)} pièces -> {chemin}")
    if sans_code:
        print(f"{len(sans_code)} sans code pays, à compléter dans CODES : "
              f"{sorted(set(sans_code))[:10]}")


if __name__ == "__main__":
    main()
