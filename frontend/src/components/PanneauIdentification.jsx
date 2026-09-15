import { useRef, useState } from 'react'
import { identifier } from '../api'

export default function PanneauIdentification({ onFermer, onAjouter }) {
  const [etat, setEtat] = useState('attente') // attente | analyse | resultats | erreur
  const [resultat, setResultat] = useState(null)
  const [message, setMessage] = useState(null)
  const champ = useRef(null)

  async function analyser(e) {
    const fichier = e.target.files?.[0]
    if (!fichier) return

    setEtat('analyse')
    try {
      const reponse = await identifier(fichier)
      setResultat(reponse)
      setEtat('resultats')
    } catch (err) {
      setMessage(err.message)
      setEtat('erreur')
    }
  }

  return (
    <div className="panneau" onClick={onFermer}>
      <div className="panneau-contenu" onClick={(e) => e.stopPropagation()}>
        <h2>Identifier une pièce</h2>
        <p className="panneau-aide">
          Photographie la face nationale, pièce bien à plat et cadrée seule.
        </p>

        <input
          ref={champ}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={analyser}
          hidden
        />

        {etat === 'attente' && (
          <button className="secondaire" onClick={() => champ.current.click()}>
            Prendre une photo
          </button>
        )}

        {etat === 'analyse' && <p className="panneau-aide">Analyse de la photo.</p>}

        {etat === 'erreur' && (
          <>
            <p className="erreur">{message}</p>
            <button className="secondaire" onClick={() => setEtat('attente')}>
              Réessayer
            </button>
          </>
        )}

        {etat === 'resultats' && (
          <>
            <p className="panneau-aide">
              {resultat.fiable
                ? 'Voici les pièces les plus ressemblantes. Choisis la bonne.'
                : "Aucune correspondance nette. Vérifie ces propositions, ou cherche la pièce dans l'album."}
            </p>

            {resultat.candidats.map((c) => (
              <button key={c.id} className="candidat" onClick={() => onAjouter(c)}>
                <img src={c.image_url} alt="" />
                <span>
                  <span className="candidat-nom">{c.pays}</span>
                  <br />
                  <span className="candidat-detail">
                    {c.annee ? `${c.annee} — ${c.theme ?? 'commémorative'}` : 'pièce courante'}
                  </span>
                  <br />
                  <span className="candidat-score">
                    ressemblance {Math.round(c.score * 100)} %
                  </span>
                </span>
              </button>
            ))}

            <button className="secondaire" onClick={() => setEtat('attente')}>
              Reprendre une photo
            </button>
          </>
        )}

        <button className="secondaire" onClick={onFermer}>Fermer</button>
      </div>
    </div>
  )
}
