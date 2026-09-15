import { useState } from 'react'
import { supabase } from '../supabase'

/** Connexion par lien magique : pas de mot de passe à gérer. */
export default function Connexion() {
  const [email, setEmail] = useState('')
  const [etat, setEtat] = useState(null)

  async function envoyer() {
    if (!email.trim()) return
    setEtat('envoi')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
    setEtat(error ? 'erreur' : 'envoye')
  }

  return (
    <div className="connexion">
      <h1>Ma collection de 2 euros</h1>
      <p>Entre ton adresse, tu recevras un lien de connexion.</p>

      <input
        type="email"
        value={email}
        placeholder="adresse@exemple.fr"
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && envoyer()}
      />
      <button onClick={envoyer} disabled={etat === 'envoi'}>
        {etat === 'envoi' ? 'Envoi en cours' : 'Recevoir le lien'}
      </button>

      {etat === 'envoye' && <p>Le lien est parti. Regarde ta boîte mail.</p>}
      {etat === 'erreur' && <p className="erreur">L'envoi a échoué. Vérifie l'adresse et réessaie.</p>}
    </div>
  )
}
