import { useRef, useState } from 'react'
import { VALEURS, libelleValeur } from '../valeurs'

export default function PanneauIdentification({ onFermer, onAjouter }) {
  const [valeur, setValeur] = useState(null)
  const [etat, setEtat] = useState('valeur') // valeur | attente | analyse | resultats | erreur
  const [resultat, setResultat] = useState(null)
  const [message, setMessage] = useState(null)
  const [progres, setProgres] = useState(null)
  const champ = useRef(null)

  // Le module de reconnaissance embarque ONNX Runtime : il n'est chargé
  // qu'au moment où l'utilisateur demande vraiment une identification.
  const chargerModule = () => import('../reconnaissance')

  function choisir(centimes) {
    setValeur(centimes)
    setEtat('attente')
    // Le sélecteur de fichier doit s'ouvrir dans le même geste que le tap,
    // sinon les navigateurs mobiles bloquent l'accès à l'appareil photo.
    setTimeout(() => champ.current?.click(), 0)
  }

  function suivreTelechargement(info) {
    if (info.status === 'progress' && info.total) {
      setProgres(Math.round((info.loaded / info.total) * 100))
    } else if (info.status === 'done') {
      setProgres(null)
    }
  }

  async function analyser(e) {
    const fichier = e.target.files?.[0]
    if (!fichier) return

    setEtat('analyse')
    const { modelePret } = await chargerModule()
    setProgres(modelePret() ? null : 0)

    try {
      const { identifier } = await chargerModule()
      const reponse = await identifier(fichier, valeur, suivreTelechargement)
      setResultat(reponse)
      setEtat('resultats')
    } catch (err) {
      setMessage(err.message)
      setEtat('erreur')
    } finally {
      setProgres(null)
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
              Photographie la face nationale, pièce bien à plat et centrée dans
              le cadre.
            </p>
            <button className="secondaire" onClick={() => champ.current.click()}>
              Prendre une photo
            </button>
            <button className="secondaire" onClick={() => setEtat('valeur')}>
              Changer de valeur ({libelleValeur(valeur)})
            </button>
          </>
        )}

        {etat === 'analyse' && (
          <>
            <p className="panneau-aide">
              {progres === null
                ? 'Analyse de la photo.'
                : 'Premier usage : téléchargement du modèle de reconnaissance. Il sera gardé en mémoire pour les fois suivantes.'}
            </p>
            {progres !== null && (
              <div className="avancement-ligne">
                <div className="avancement-part" style={{ width: `${progres}%` }} />
              </div>
            )}
          </>
        )}

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
