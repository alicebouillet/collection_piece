import { useMemo } from 'react'
import Logement from './Logement'

/**
 * Les pièces sont regroupées par pays : c'est la façon dont on range une
 * collection, et ça met en évidence les pays presque complets.
 */
export default function Album({ pieces, onBasculer }) {
  const parPays = useMemo(() => {
    const groupes = new Map()
    for (const piece of pieces) {
      if (!groupes.has(piece.pays)) groupes.set(piece.pays, [])
      groupes.get(piece.pays).push(piece)
    }
    return [...groupes.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'))
  }, [pieces])

  if (pieces.length === 0) {
    return (
      <div className="vide">
        <p>Aucune pièce ne correspond à ces filtres.</p>
        <p>Élargis la recherche pour voir le reste de l'album.</p>
      </div>
    )
  }

  return (
    <div className="album">
      {parPays.map(([pays, liste]) => {
        const possedees = liste.filter((p) => p.possedee).length
        return (
          <section key={pays} className="pays-section">
            <header className="pays-entete">
              <h2>{pays}</h2>
              <span className={possedees === liste.length ? 'pays-complet' : 'pays-compte'}>
                {possedees} / {liste.length}
              </span>
            </header>
            <div className="pays-grille">
              {liste.map((piece) => (
                <Logement key={piece.id} piece={piece} onBasculer={onBasculer} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
