import { useMemo } from 'react'

/** Statistiques de remplissage : total, par type, et pays terminés. */
export default function Avancement({ pieces }) {
  const stats = useMemo(() => {
    const total = pieces.length
    const possedees = pieces.filter((p) => p.possedee).length

    const compte = (filtre) => {
      const sous = pieces.filter(filtre)
      return { possedees: sous.filter((p) => p.possedee).length, total: sous.length }
    }

    const pays = new Map()
    for (const p of pieces) {
      const etat = pays.get(p.pays) ?? { possedees: 0, total: 0 }
      etat.total += 1
      if (p.possedee) etat.possedees += 1
      pays.set(p.pays, etat)
    }
    const complets = [...pays.values()].filter((e) => e.possedees === e.total).length

    return {
      total,
      possedees,
      part: total ? Math.round((possedees / total) * 100) : 0,
      courantes: compte((p) => p.type === 'courante'),
      commemoratives: compte((p) => p.type === 'commemorative'),
      paysComplets: complets,
      paysTotal: pays.size,
    }
  }, [pieces])

  return (
    <div className="avancement">
      <p className="avancement-chiffre">
        <strong>{stats.possedees}</strong>
        <span> sur {stats.total} pièces · {stats.part} %</span>
      </p>

      <div className="avancement-ligne">
        <div className="avancement-part" style={{ width: `${stats.part}%` }} />
      </div>

      <dl className="avancement-detail">
        <div>
          <dt>Courantes</dt>
          <dd>{stats.courantes.possedees} / {stats.courantes.total}</dd>
        </div>
        <div>
          <dt>Commémoratives</dt>
          <dd>{stats.commemoratives.possedees} / {stats.commemoratives.total}</dd>
        </div>
        <div>
          <dt>Pays complets</dt>
          <dd>{stats.paysComplets} / {stats.paysTotal}</dd>
        </div>
      </dl>
    </div>
  )
}
