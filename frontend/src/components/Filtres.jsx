import { VALEURS } from '../valeurs'

export default function Filtres({ valeurs, onChange, pays }) {
  const modifier = (champ) => (e) => onChange({ ...valeurs, [champ]: e.target.value })

  return (
    <div className="filtres">
      <input
        type="search"
        value={valeurs.texte}
        placeholder="Chercher un pays, une année, un thème"
        onChange={modifier('texte')}
      />

      <select value={valeurs.valeur} onChange={modifier('valeur')} aria-label="Valeur">
        <option value="toutes">Toutes les valeurs</option>
        {VALEURS.map((v) => (
          <option key={v.centimes} value={v.centimes}>{v.libelle}</option>
        ))}
      </select>

      <select value={valeurs.type} onChange={modifier('type')} aria-label="Type de pièce">
        <option value="tous">Courantes et commémoratives</option>
        <option value="commemorative">Commémoratives</option>
        <option value="courante">Courantes</option>
      </select>

      <select value={valeurs.etat} onChange={modifier('etat')} aria-label="Possession">
        <option value="tous">Possédées et manquantes</option>
        <option value="possedees">Possédées</option>
        <option value="manquantes">Manquantes</option>
      </select>

      <select value={valeurs.pays} onChange={modifier('pays')} aria-label="Pays">
        <option value="tous">Tous les pays</option>
        {pays.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
  )
}
