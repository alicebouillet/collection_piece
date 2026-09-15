"""
Reconnaissance de pièces : isolation du disque puis embedding CLIP.

Le modèle est chargé une seule fois, au premier appel, et gardé en mémoire.
"""

from functools import lru_cache
from io import BytesIO

import cv2
import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

MODEL_NAME = "openai/clip-vit-base-patch32"
EMBED_DIM = 512


@lru_cache(maxsize=1)
def _load_model():
    model = CLIPModel.from_pretrained(MODEL_NAME)
    model.eval()
    processor = CLIPProcessor.from_pretrained(MODEL_NAME)
    return model, processor


def isolate_coin(image: Image.Image, margin: float = 0.06) -> Image.Image:
    """
    Détecte le disque de la pièce et recadre dessus, sur fond noir.

    Le fond d'une photo prise à la main (table, main, tissu) est du bruit pur
    pour le modèle : le masquer améliore nettement la similarité. Si aucun
    cercle n'est trouvé, on renvoie un recadrage centré carré plutôt que
    d'échouer — une photo mal cadrée vaut mieux que pas de résultat.
    """
    rgb = np.array(image.convert("RGB"))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gray = cv2.medianBlur(gray, 5)

    h, w = gray.shape
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=min(h, w),
        param1=100,
        param2=40,
        minRadius=int(min(h, w) * 0.15),
        maxRadius=int(min(h, w) * 0.55),
    )

    if circles is None:
        side = min(h, w)
        top, left = (h - side) // 2, (w - side) // 2
        return Image.fromarray(rgb[top:top + side, left:left + side])

    x, y, r = np.round(circles[0][0]).astype(int)

    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(mask, (x, y), r, 255, -1)
    masked = cv2.bitwise_and(rgb, rgb, mask=mask)

    pad = int(r * (1 + margin))
    top, bottom = max(0, y - pad), min(h, y + pad)
    left, right = max(0, x - pad), min(w, x + pad)
    return Image.fromarray(masked[top:bottom, left:right])


def embed(image: Image.Image) -> list[float]:
    """Vecteur CLIP normalisé (norme 1) — comparable par cosinus."""
    model, processor = _load_model()
    inputs = processor(images=image, return_tensors="pt")

    with torch.no_grad():
        sortie = model.get_image_features(**inputs)

    # Selon la version de transformers, get_image_features renvoie le tenseur
    # projeté (512) ou un objet qui l'enveloppe. Dans les deux cas la
    # projection est déjà faite : on récupère le tenseur, sans le reprojeter.
    if torch.is_tensor(sortie):
        features = sortie
    else:
        features = getattr(sortie, "image_embeds", None)
        if features is None:
            features = sortie.pooler_output

    features = features / features.norm(dim=-1, keepdim=True)
    return features[0].tolist()

def embed_bytes(raw: bytes, *, isolate: bool = True) -> list[float]:
    image = Image.open(BytesIO(raw)).convert("RGB")
    if isolate:
        image = isolate_coin(image)
    return embed(image)
