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

/** Vecteur CLIP normalisé, comparable par cosinus à ceux stockés en base. */
async function vectoriser(canvas, onProgres) {
  const { processor, model } = await charger(onProgres)

  const { RawImage } = await import('@huggingface/transformers')
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
 * `canvas` est l'image déjà détourée. `valeur` est en centimes. Elle est indispensable : plusieurs pays gravent
 * le même motif sur 1, 2 et 5 centimes, et seul le diamètre les distingue —
 * donnée qu'une photo ne porte pas.
 */
export async function identifier(canvas, valeur, onProgres) {
  const vecteur = await vectoriser(canvas, onProgres)

  const { data, error } = await supabase.rpc('match_coins', {
    query_embedding: vecteur,
    match_count: 3,
    filtre_valeur: valeur ?? null,
  })

  if (error) throw new Error("La recherche n'a pas abouti. Vérifie ta connexion.")

  const candidats = data ?? []
  return {
    candidats,
    // Le canvas analysé est renvoyé pour affichage : voir ce que le modèle
    // a réellement vu explique la plupart des mauvaises reconnaissances.
    apercu: canvas.toDataURL('image/jpeg', 0.8),
    // En dessous de ce seuil, la ressemblance est trop faible pour qu'une
    // proposition ait du sens : l'interface bascule sur la saisie manuelle.
    fiable: candidats.length > 0 && candidats[0].score >= 0.8,
  }
}
