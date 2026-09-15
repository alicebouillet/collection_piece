const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/**
 * Envoie une photo au backend et récupère les types les plus proches.
 * `valeur` (en centimes) restreint la recherche : sans elle, 1, 2 et 5
 * centimes sont indiscernables pour beaucoup de pays.
 */
export async function identifier(fichier, valeur) {
  const corps = new FormData()
  corps.append('photo', fichier)

  const url = new URL(`${API_URL}/identify`)
  if (valeur) url.searchParams.set('valeur', valeur)

  const reponse = await fetch(url, { method: 'POST', body: corps })

  if (!reponse.ok) {
    const detail = await reponse.json().catch(() => null)
    throw new Error(detail?.detail ?? "La reconnaissance n'a pas abouti.")
  }
  return reponse.json()
}
