import Logement from './Logement'

export default function Album({ pieces, onBasculer }) {
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
      {pieces.map((piece) => (
        <Logement key={piece.id} piece={piece} onBasculer={onBasculer} />
      ))}
    </div>
  )
}
