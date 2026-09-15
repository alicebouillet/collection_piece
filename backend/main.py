"""
API de reconnaissance de pièces.

    uvicorn main:app --reload
"""

import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client

import recognition

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_ANON_KEY"]
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
MAX_UPLOAD_BYTES = 8 * 1024 * 1024

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Collection 2 euros")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/identify")
async def identify(
    photo: UploadFile = File(...),
    top_k: int = 3,
    valeur: int | None = None,
):
    """
    Renvoie les `top_k` types de pièces les plus proches de la photo.

    `valeur` restreint la recherche à une valeur faciale, en centimes. Elle
    est indispensable en pratique : plusieurs pays emploient le même dessin
    pour 1, 2 et 5 centimes, et seul le diamètre les distingue — donnée qu'une
    photo ne porte pas. L'utilisateur choisit la valeur, le modèle fait le
    reste.

    Le résultat est une proposition, pas un verdict : c'est l'utilisateur qui
    confirme dans l'interface. Avec une seule image de référence par type et
    plusieurs centaines de commémoratives, le top-1 seul n'est pas fiable.
    """
    if not (photo.content_type or "").startswith("image/"):
        raise HTTPException(400, "Envoie un fichier image.")

    raw = await photo.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image trop lourde (8 Mo maximum).")

    try:
        vector = recognition.embed_bytes(raw)
    except Exception:
        raise HTTPException(422, "Image illisible. Réessaie avec une autre photo.")

    response = supabase.rpc(
        "match_coins",
        {
            "query_embedding": vector,
            "match_count": max(1, min(top_k, 10)),
            "filtre_valeur": valeur,
        },
    ).execute()

    candidates = response.data or []
    return {
        "candidats": candidates,
        # En dessous de ce seuil, la ressemblance est trop faible pour qu'une
        # proposition ait du sens : l'interface bascule sur la saisie manuelle.
        "fiable": bool(candidates) and candidates[0]["score"] >= 0.80,
    }
