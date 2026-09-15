import { libelleValeur } from '../valeurs'

/**
 * Un emplacement de l'album. Occupé, il montre la pièce cerclée de laiton ;
 * vide, il garde le creux gravé dans le feutre avec la pièce en filigrane.
 * Le diamètre du logement suit la valeur faciale, comme dans un vrai album.
 */
export default function Logement({ piece, onBasculer }) {
  const etat = piece.possedee ? 'possedee' : 'manquante'
  const libelle = piece.possedee
    ? `Retirer ${piece.pays} ${libelleValeur(piece.valeur)} de la collection`
    : `Ajouter ${piece.pays} ${libelleValeur(piece.valeur)} à la collection`

  return (
    <button
      className={`piece piece--${etat}`}
      onClick={() => onBasculer(piece)}
      title={piece.theme || undefined}
      aria-label={libelle}
      aria-pressed={piece.possedee}
    >
      <span className={`logement logement--v${piece.valeur}`}>
        <img src={`${import.meta.env.BASE_URL}${piece.image_url}`} alt="" loading="lazy" />
      </span>
      <span className="piece-pays">{piece.pays}</span>
      <span className="piece-annee">
        {piece.annee ? `${libelleValeur(piece.valeur)} · ${piece.annee}` : libelleValeur(piece.valeur)}
      </span>
      {piece.version_face && <span className="piece-quantite">{piece.version_face}</span>}
    </button>
  )
}
