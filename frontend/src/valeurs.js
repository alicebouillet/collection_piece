/** Valeurs faciales, en centimes. Sert au filtre et au choix avant photo. */
export const VALEURS = [
  { centimes: 1, libelle: '1 c' },
  { centimes: 2, libelle: '2 c' },
  { centimes: 5, libelle: '5 c' },
  { centimes: 10, libelle: '10 c' },
  { centimes: 20, libelle: '20 c' },
  { centimes: 50, libelle: '50 c' },
  { centimes: 100, libelle: '1 €' },
  { centimes: 200, libelle: '2 €' },
]

export function libelleValeur(centimes) {
  return VALEURS.find((v) => v.centimes === centimes)?.libelle ?? ''
}
