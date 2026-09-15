import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import Connexion from './components/Connexion'
import Avancement from './components/Avancement'
import Filtres from './components/Filtres'
import Album from './components/Album'
import PanneauIdentification from './components/PanneauIdentification'

export default function App() {
  const [session, setSession] = useState(null)
  const [pieces, setPieces] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [panneauOuvert, setPanneauOuvert] = useState(false)
  const [filtres, setFiltres] = useState({ valeur: 'toutes', type: 'tous', pays: 'tous', etat: 'tous', texte: '' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: abonnement } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => abonnement.subscription.unsubscribe()
  }, [])

  const chargerCatalogue = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('vue_catalogue')
      .select('*')
      .order('pays', { ascending: true })
      .order('valeur', { ascending: true })
      .order('annee', { ascending: true, nullsFirst: true })

    if (error) setErreur("Le catalogue n'a pas pu être chargé. Vérifie ta connexion.")
    else {
      setPieces(data)
      setErreur(null)
    }
    setChargement(false)
  }, [])

  useEffect(() => {
    if (session) chargerCatalogue()
  }, [session, chargerCatalogue])

  /** Ajoute la pièce à la collection, ou l'en retire si elle y est déjà. */
  async function basculer(piece) {
    const avant = pieces
    setPieces((liste) =>
      liste.map((p) =>
        p.id === piece.id
          ? { ...p, possedee: !p.possedee, quantite: p.possedee ? 0 : 1 }
          : p,
      ),
    )

    const requete = piece.possedee
      ? supabase.from('collection').delete()
          .eq('coin_type_id', piece.id)
          .eq('user_id', session.user.id)
      : supabase.from('collection')
          .insert({ coin_type_id: piece.id, user_id: session.user.id })

    const { error } = await requete
    if (error) {
      setPieces(avant)
      setErreur("La modification n'a pas été enregistrée. Réessaie.")
    }
  }

  const listePays = useMemo(
    () => [...new Set(pieces.map((p) => p.pays))].sort((a, b) => a.localeCompare(b, 'fr')),
    [pieces],
  )

  const visibles = useMemo(() => {
    const recherche = filtres.texte.trim().toLowerCase()
    return pieces.filter((p) => {
      if (filtres.valeur !== 'toutes' && p.valeur !== Number(filtres.valeur)) return false
      if (filtres.type !== 'tous' && p.type !== filtres.type) return false
      if (filtres.pays !== 'tous' && p.pays !== filtres.pays) return false
      if (filtres.etat === 'possedees' && !p.possedee) return false
      if (filtres.etat === 'manquantes' && p.possedee) return false
      if (recherche) {
        const champs = `${p.pays} ${p.theme ?? ''} ${p.annee ?? ''}`.toLowerCase()
        if (!champs.includes(recherche)) return false
      }
      return true
    })
  }, [pieces, filtres])

  if (!session) return <Connexion />

  return (
    <div className="shell">
      <header className="masthead">
        <h1>Ma collection de pièces</h1>
        <p>{session.user.email}</p>
      </header>

      <Avancement pieces={pieces} />

      <Filtres valeurs={filtres} onChange={setFiltres} pays={listePays} />

      {erreur && <p className="erreur">{erreur}</p>}

      {chargement ? (
        <div className="vide">
          <p>Chargement du catalogue.</p>
        </div>
      ) : (
        <Album pieces={visibles} onBasculer={basculer} />
      )}

      <button className="identifier" onClick={() => setPanneauOuvert(true)}>
        Identifier une pièce
      </button>

      {panneauOuvert && (
        <PanneauIdentification
          onFermer={() => setPanneauOuvert(false)}
          onAjouter={async (candidat) => {
            const piece = pieces.find((p) => p.id === candidat.id)
            if (piece && !piece.possedee) await basculer(piece)
            setPanneauOuvert(false)
          }}
        />
      )}

      <p className="credit">Images des pièces © Banque centrale européenne</p>
    </div>
  )
}
