/**
 * Reconnaissance de pièces, entièrement dans le navigateur.
 *
 * CLIP tourne ici via transformers.js : pas de serveur à héberger, rien qui
 * s'endort, et la photo ne quitte jamais l'appareil. Le prix à payer est le
 * téléchargement du modèle au premier usage (~90 Mo), ensuite mis en cache
 * par le navigateur.
 */

import { supabase } from './supabase'

const MODELE = 'Xenova/clip-vit-base-patch32'

let chargement = null

/**
 * Charge le modèle une seule fois, et partage la même promesse ensuite.
 *
 * L'import est dynamique à dessein : transformers.js tire ONNX Runtime et
 * son binaire WebAssembly, soit une vingtaine de mégaoctets. Les charger à
 * l'ouverture de la page pénaliserait tous ceux qui se contentent de
 * consulter leur album.
 */
function charger(onProgres) {
  if (!chargement) {
    chargement = import('@huggingface/transformers').then(
      ({ AutoProcessor, CLIPVisionModelWithProjection }) =>
        Promise.all([
          AutoProcessor.from_pretrained(MODELE),
          CLIPVisionModelWithProjection.from_pretrained(MODELE, {
            dtype: 'q8',
            progress_callback: onProgres,
          }),
        ]).then(([processor, model]) => ({ processor, model })),
    )
  }
  return chargement
}

/** Vrai si le modèle est déjà en mémoire — sert à n'afficher la barre qu'une fois. */
export function modelePret() {
  return chargement !== null
}

/**
 * Isole le disque de la pièce et renvoie un canvas carré sur fond noir.
 *
 * Le fond d'une photo prise à la main est du bruit pur pour le modèle.
 * Faute de détection de cercle en JS, on recadre au carré centré : la
 * consigne donnée à l'utilisateur est de cadrer la pièce seule et centrée,
 * ce qui suffit en pratique.
 */
async function preparer(fichier) {
  const bitmap = await createImageBitmap(fichier)
  const cote = Math.min(bitmap.width, bitmap.height)
  const gauche = (bitmap.width - cote) / 2
  const haut = (bitmap.height - cote) / 2

  const canvas = document.createElement('canvas')
  canvas.width = 224
  canvas.height = 224
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, gauche, haut, cote, cote, 0, 0, 224, 224)
  bitmap.close()

  return canvas
}

/** Vecteur CLIP normalisé, comparable par cosinus à ceux stockés en base. */
async function vectoriser(fichier, onProgres) {
  const { processor, model } = await charger(onProgres)

  const { RawImage } = await import('@huggingface/transformers')
  const canvas = await preparer(fichier)
  const image = await RawImage.fromCanvas(canvas)
  const entrees = await processor(image)
  const { image_embeds } = await model(entrees)

  const brut = Array.from(image_embeds.data)
  const norme = Math.hypot(...brut)
  return brut.map((x) => x / norme)
}

/**
 * Identifie une pièce et renvoie les candidats les plus proches.
 *
 * `valeur` est en centimes. Elle est indispensable : plusieurs pays gravent
 * le même motif sur 1, 2 et 5 centimes, et seul le diamètre les distingue —
 * donnée qu'une photo ne porte pas.
 */
export async function identifier(fichier, valeur, onProgres) {
  const vecteur = await vectoriser(fichier, onProgres)

  const { data, error } = await supabase.rpc('match_coins', {
    query_embedding: vecteur,
    match_count: 3,
    filtre_valeur: valeur ?? null,
  })

  if (error) throw new Error("La recherche n'a pas abouti. Vérifie ta connexion.")

  const candidats = data ?? []
  return {
    candidats,
    // En dessous de ce seuil, la ressemblance est trop faible pour qu'une
    // proposition ait du sens : l'interface bascule sur la saisie manuelle.
    fiable: candidats.length > 0 && candidats[0].score >= 0.8,
  }
}
