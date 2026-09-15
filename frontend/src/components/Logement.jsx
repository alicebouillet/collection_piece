/**
 * Un emplacement de l'album. Occupé, il montre la pièce cerclée de laiton ;
 * vide, il garde le creux gravé dans le feutre avec la pièce en filigrane.
 */
export default function Logement({ piece, onBasculer }) {
  const etat = piece.possedee ? 'possedee' : 'manquante'
  const libelle = piece.possedee
    ? `Retirer ${piece.pays} de la collection`
    : `Ajouter ${piece.pays} à la collection`

  return (
    <button
      className={`piece piece--${etat}`}
      onClick={() => onBasculer(piece)}
      title={piece.theme || undefined}
      aria-label={libelle}
      aria-pressed={piece.possedee}
    >
      <span className="logement">
        <img src={piece.image_url} alt="" loading="lazy" />
      </span>
      <span className="piece-pays">{piece.pays}</span>
      {piece.annee && <span className="piece-annee">{piece.annee}</span>}
      {piece.quantite > 1 && <span className="piece-quantite">×{piece.quantite}</span>}
    </button>
  )
}
