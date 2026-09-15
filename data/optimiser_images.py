#!/usr/bin/env python3
"""
Génère les images destinées au site à partir des originaux de la BCE.

    pip install pillow
    python optimiser_images.py

Lit  data/images/          (originaux, non versionnés)
Écrit frontend/public/coins/ (versionnés, servis par GitHub Pages)

Les originaux font 540x540 pour environ 170 ko. L'album les affiche sous
100 px et CLIP travaille en 224 px : 400 px suffisent largement, pour un
poids divisé par quatre ou cinq.
"""

from pathlib import Path

from PIL import Image

RACINE = Path(__file__).resolve().parent.parent
SOURCE = RACINE / "data" / "images"
CIBLE = RACINE / "frontend" / "public" / "coins"

TAILLE_MAX = 400
QUALITE = 80


def poids(dossier: Path) -> float:
    return sum(f.stat().st_size for f in dossier.glob("*")) / 1024 / 1024


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Dossier introuvable : {SOURCE}")

    CIBLE.mkdir(parents=True, exist_ok=True)
    for ancien in CIBLE.glob("*.jpg"):
        ancien.unlink()

    fichiers = sorted(SOURCE.glob("*.jpg")) + sorted(SOURCE.glob("*.png"))
    print(f"{len(fichiers)} images à traiter")

    for n, chemin in enumerate(fichiers, 1):
        with Image.open(chemin) as image:
            image = image.convert("RGB")
            image.thumbnail((TAILLE_MAX, TAILLE_MAX), Image.LANCZOS)
            image.save(
                CIBLE / f"{chemin.stem}.jpg",
                "JPEG",
                quality=QUALITE,
                optimize=True,
                progressive=True,
            )
        if n % 100 == 0 or n == len(fichiers):
            print(f"  {n} / {len(fichiers)}")

    print(f"\nAvant : {poids(SOURCE):.1f} Mo")
    print(f"Après : {poids(CIBLE):.1f} Mo")


if __name__ == "__main__":
    main()
