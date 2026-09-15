import { useState } from 'react'
import { supabase } from '../supabase'

/**
 * Connexion par adresse et mot de passe.
 *
 * Le lien magique évitait de gérer un mot de passe, mais imposait un
 * aller-retour par la boîte mail et se heurtait au quota d'envoi de
 * Supabase. Pour une collection personnelle, un mot de passe classique est
 * plus commode : instantané, sans quota, et le navigateur le retient.
 */
export default function Connexion() {
  const [mode, setMode] = useState('connexion') // connexion | inscription
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState(null)

  async function valider() {
    if (!email.trim() || !motDePasse) {
      setMessage({ type: 'erreur', texte: 'Renseigne ton adresse et ton mot de passe.' })
      return
    }
    if (mode === 'inscription' && motDePasse.length < 8) {
      setMessage({ type: 'erreur', texte: 'Le mot de passe doit faire au moins 8 caractères.' })
      return
    }

    setEnCours(true)
    setMessage(null)

    const identifiants = { email: email.trim(), password: motDePasse }
    const { error } =
      mode === 'connexion'
        ? await supabase.auth.signInWithPassword(identifiants)
        : await supabase.auth.signUp(identifiants)

    setEnCours(false)

    if (error) {
      setMessage({ type: 'erreur', texte: traduire(error.message) })
    } else if (mode === 'inscription') {
      // Selon le réglage du projet, l'inscription peut demander une
      // confirmation par mail ; sinon la session s'ouvre directement.
      setMessage({
        type: 'info',
        texte: 'Compte créé. Si rien ne se passe, vérifie ta boîte mail pour confirmer.',
      })
    }
  }

  return (
    <div className="connexion">
      <h1>Ma collection de pièces</h1>
      <p>
        {mode === 'connexion'
          ? 'Connecte-toi pour retrouver ton album.'
          : 'Choisis une adresse et un mot de passe.'}
      </p>

      <input
        type="email"
        autoComplete="email"
        value={email}
        placeholder="adresse@exemple.fr"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
        value={motDePasse}
        placeholder="mot de passe"
        onChange={(e) => setMotDePasse(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && valider()}
      />

      <button onClick={valider} disabled={enCours}>
        {enCours
          ? 'Un instant'
          : mode === 'connexion'
            ? 'Se connecter'
            : 'Créer le compte'}
      </button>

      {message && (
        <p className={message.type === 'erreur' ? 'erreur' : undefined}>{message.texte}</p>
      )}

      <button
        className="lien"
        onClick={() => {
          setMode(mode === 'connexion' ? 'inscription' : 'connexion')
          setMessage(null)
        }}
      >
        {mode === 'connexion' ? 'Créer un compte' : 'J’ai déjà un compte'}
      </button>
    </div>
  )
}

function traduire(message) {
  if (/invalid login credentials/i.test(message)) {
    return 'Adresse ou mot de passe incorrect.'
  }
  if (/already registered/i.test(message)) {
    return 'Cette adresse a déjà un compte. Connecte-toi.'
  }
  if (/rate limit/i.test(message)) {
    return 'Trop de tentatives. Réessaie dans quelques minutes.'
  }
  return message
}
