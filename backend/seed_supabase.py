#!/usr/bin/env python3
"""
Charge data/catalog.json dans Supabase : insertion des types puis calcul
des embeddings CLIP à partir des images locales.

    python seed_supabase.py               # tout
    python seed_supabase.py --embeddings  # seulement les vecteurs manquants

Utilise la clé SERVICE_ROLE (écriture sur coin_types, bloquée par RLS
pour la clé anon). Ne jamais exposer cette clé côté frontend.
"""

import argparse
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image
from supabase import create_client

import recognition

load_dotenv()

DATA = Path(__file__).resolve().parent.parent / "data"
CATALOG = DATA / "catalog.json"
BATCH = 50

# Libellés FR, pour ne pas afficher un code ISO à l'utilisateur.
PAYS = {
    "at": "Autriche", "be": "Belgique", "cy": "Chypre", "de": "Allemagne",
    "ee": "Estonie", "es": "Espagne", "fi": "Finlande", "fr": "France",
    "gr": "Grèce", "hr": "Croatie", "ie": "Irlande", "it": "Italie",
    "lt": "Lituanie", "lu": "Luxembourg", "lv": "Lettonie", "mc": "Monaco",
    "mt": "Malte", "nl": "Pays-Bas", "pt": "Portugal", "si": "Slovénie",
    "sk": "Slovaquie", "sm": "Saint-Marin", "va": "Vatican", "ad": "Andorre",
    "bg": "Bulgarie",
}


def client():
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


def insert_types(sb) -> None:
    coins = json.loads(CATALOG.read_text(encoding="utf-8"))
    rows = [
        {
            "id": c["id"],
            "type": c["type"],
            "pays_code": c.get("pays_code") or "",
            "pays": PAYS.get(c.get("pays_code", ""), c.get("pays_code") or "Inconnu"),
            "annee": c.get("annee"),
            "theme": c.get("theme"),
            "image_url": c["image"],
            "source_url": c.get("source"),
        }
        for c in coins
    ]

    for i in range(0, len(rows), BATCH):
        sb.table("coin_types").upsert(rows[i:i + BATCH]).execute()
        print(f"  types {i + 1}-{min(i + BATCH, len(rows))} / {len(rows)}")


def compute_embeddings(sb) -> None:
    missing = (
        sb.table("coin_types")
        .select("id, image_url")
        .is_("embedding", "null")
        .execute()
        .data
    )
    print(f"  {len(missing)} embeddings à calculer")

    for n, row in enumerate(missing, 1):
        path = DATA / row["image_url"]
        if not path.exists():
            print(f"  ! image absente : {path}")
            continue
        # Les images du catalogue sont déjà détourées sur fond blanc :
        # inutile de passer par la détection de cercle.
        vector = recognition.embed(Image.open(path).convert("RGB"))
        sb.table("coin_types").update({"embedding": vector}).eq("id", row["id"]).execute()
        if n % 25 == 0 or n == len(missing):
            print(f"  {n} / {len(missing)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--types", action="store_true", help="insérer les types seulement")
    ap.add_argument("--embeddings", action="store_true", help="calculer les vecteurs seulement")
    args = ap.parse_args()

    do_all = not (args.types or args.embeddings)
    sb = client()

    if do_all or args.types:
        print("Insertion des types")
        insert_types(sb)

    if do_all or args.embeddings:
        print("Calcul des embeddings")
        compute_embeddings(sb)

    print("Terminé. Pense à recréer l'index ivfflat une fois les vecteurs chargés.")


if __name__ == "__main__":
    main()
