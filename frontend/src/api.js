const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Envoie une photo au backend et récupère les types de pièces les plus proches. */
export async function identifier(fichier) {
  const corps = new FormData()
  corps.append('photo', fichier)

  const reponse = await fetch(`${API_URL}/identify`, { method: 'POST', body: corps })

  if (!reponse.ok) {
    const detail = await reponse.json().catch(() => null)
    throw new Error(detail?.detail ?? "La reconnaissance n'a pas abouti.")
  }
  return reponse.json()
}
