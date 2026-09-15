import { useRef, useState } from 'react'
import { identifier } from '../api'
import { VALEURS, libelleValeur } from '../valeurs'

export default function PanneauIdentification({ onFermer, onAjouter }) {
  const [valeur, setValeur] = useState(null)
  const [etat, setEtat] = useState('valeur') // valeur | attente | analyse | resultats | erreur
  const [resultat, setResultat] = useState(null)
  const [message, setMessage] = useState(null)
  const champ = useRef(null)

  function choisir(centimes) {
    setValeur(centimes)
    setEtat('attente')
    // Le sélecteur de fichier doit s'ouvrir dans le même geste que le tap,
    // sinon les navigateurs mobiles bloquent l'accès à l'appareil photo.
    setTimeout(() => champ.current?.click(), 0)
  }

  async function analyser(e) {
    const fichier = e.target.files?.[0]
    if (!fichier) return

    setEtat('analyse')
    try {
      const reponse = await identifier(fichier, valeur)
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

        <input
          ref={champ}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={analyser}
          hidden
        />

        {etat === 'valeur' && (
          <>
            <p className="panneau-aide">
              Quelle valeur ? Plusieurs pays gravent le même motif sur 1, 2 et
              5 centimes, alors seule la taille les sépare — et une photo ne la
              donne pas.
            </p>
            <div className="choix-valeur">
              {VALEURS.map((v) => (
                <button key={v.centimes} onClick={() => choisir(v.centimes)}>
                  {v.libelle}
                </button>
              ))}
            </div>
          </>
        )}

        {etat === 'attente' && (
          <>
            <p className="panneau-aide">
              Photographie la face nationale, pièce bien à plat et cadrée seule.
            </p>
            <button className="secondaire" onClick={() => champ.current.click()}>
              Prendre une photo
            </button>
            <button className="secondaire" onClick={() => setEtat('valeur')}>
              Changer de valeur ({libelleValeur(valeur)})
            </button>
          </>
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
                <img src={`${import.meta.env.BASE_URL}${c.image_url}`} alt="" />
                <span>
                  <span className="candidat-nom">
                    {c.pays} · {libelleValeur(c.valeur)}
                  </span>
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

            <button className="secondaire" onClick={() => setEtat('valeur')}>
              Reprendre une photo
            </button>
          </>
        )}

        <button className="secondaire" onClick={onFermer}>Fermer</button>
      </div>
    </div>
  )
}
