/** Une ligne fine plutôt qu'un gros chiffre : l'album reste le sujet. */
export default function Avancement({ pieces }) {
  const total = pieces.length
  const possedees = pieces.filter((p) => p.possedee).length
  const part = total ? Math.round((possedees / total) * 100) : 0

  return (
    <div className="avancement">
      <div className="avancement-ligne">
        <div className="avancement-part" style={{ width: `${part}%` }} />
      </div>
      <p className="avancement-texte">
        <strong>{possedees}</strong> pièces sur {total} répertoriées
      </p>
    </div>
  )
}
