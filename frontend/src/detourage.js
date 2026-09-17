/**
 * Isolation du disque de la pièce sur une photo.
 *
 * Les images de référence de la BCE sont des disques centrés sur fond blanc.
 * Une photo prise à la main ne leur ressemble que de loin : table, ombres,
 * pièce décentrée n'occupant qu'un tiers du cadre. CLIP compare alors surtout
 * des plans de travail. Détourer rapproche les deux, et c'est le geste qui
 * change le plus la qualité de la reconnaissance.
 *
 * Pas d'OpenCV ici : le cas est facile. Une pièce est un objet compact et
 * contrasté sur un fond à peu près uniforme, donc un seuillage par écart au
 * fond suivi d'une recherche de composante connexe suffit.
 */

const ANALYSE = 256 // côté de l'image de travail
const SORTIE = 224 // entrée attendue par CLIP

/** Médiane des quatre coins : estimation du fond, robuste à une ombre isolée. */
function couleurFond(data, largeur, hauteur) {
  const coin = 12
  const echantillons = []

  for (const [dx, dy] of [[0, 0], [largeur - coin, 0], [0, hauteur - coin], [largeur - coin, hauteur - coin]]) {
    let r = 0, v = 0, b = 0, n = 0
    for (let y = dy; y < dy + coin; y++) {
      for (let x = dx; x < dx + coin; x++) {
        const i = (y * largeur + x) * 4
        r += data[i]; v += data[i + 1]; b += data[i + 2]; n++
      }
    }
    echantillons.push([r / n, v / n, b / n])
  }

  const median = (k) => {
    const valeurs = echantillons.map((e) => e[k]).sort((a, b) => a - b)
    return (valeurs[1] + valeurs[2]) / 2
  }
  return [median(0), median(1), median(2)]
}

/** Composante connexe la plus grande, à partir du centre de l'image. */
function composantePrincipale(masque, largeur, hauteur) {
  const vu = new Uint8Array(masque.length)
  let meilleure = null

  // On part de points répartis au centre : la pièce y est presque toujours.
  const departs = []
  for (let fy = 0.35; fy <= 0.65; fy += 0.15) {
    for (let fx = 0.35; fx <= 0.65; fx += 0.15) {
      departs.push(Math.round(fy * hauteur) * largeur + Math.round(fx * largeur))
    }
  }

  for (const depart of departs) {
    if (!masque[depart] || vu[depart]) continue

    const pile = [depart]
    vu[depart] = 1
    const pixels = []

    while (pile.length) {
      const p = pile.pop()
      pixels.push(p)
      const x = p % largeur
      const y = (p - x) / largeur

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= largeur || ny >= hauteur) continue
        const q = ny * largeur + nx
        if (masque[q] && !vu[q]) {
          vu[q] = 1
          pile.push(q)
        }
      }
    }

    if (!meilleure || pixels.length > meilleure.length) meilleure = pixels
  }

  return meilleure
}

/**
 * Détecte le disque et renvoie ses coordonnées dans l'image d'origine,
 * ou null si le résultat n'est pas crédible.
 */
export function trouverDisque(bitmap) {
  const canvas = document.createElement('canvas')
  canvas.width = ANALYSE
  canvas.height = ANALYSE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, ANALYSE, ANALYSE)

  const { data } = ctx.getImageData(0, 0, ANALYSE, ANALYSE)
  const [fr, fv, fb] = couleurFond(data, ANALYSE, ANALYSE)

  const SEUIL = 42 // écart au fond, en distance de Manhattan pondérée
  const masque = new Uint8Array(ANALYSE * ANALYSE)
  for (let p = 0; p < masque.length; p++) {
    const i = p * 4
    const ecart =
      Math.abs(data[i] - fr) + Math.abs(data[i + 1] - fv) + Math.abs(data[i + 2] - fb)
    masque[p] = ecart > SEUIL ? 1 : 0
  }

  const pixels = composantePrincipale(masque, ANALYSE, ANALYSE)
  if (!pixels) return null

  const surface = pixels.length
  const part = surface / masque.length
  // Trop petit : du bruit. Trop grand : le fond entier a été pris pour l'objet.
  if (part < 0.04 || part > 0.92) return null

  let sx = 0, sy = 0
  for (const p of pixels) {
    sx += p % ANALYSE
    sy += (p - (p % ANALYSE)) / ANALYSE
  }
  const cx = sx / surface
  const cy = sy / surface

  // Un disque de même surface donne un rayon plus stable qu'une boîte
  // englobante, qui serait tirée par le moindre reflet en bordure.
  const rayon = Math.sqrt(surface / Math.PI)

  const echelleX = bitmap.width / ANALYSE
  const echelleY = bitmap.height / ANALYSE
  return {
    cx: cx * echelleX,
    cy: cy * echelleY,
    rayon: rayon * Math.min(echelleX, echelleY),
  }
}

/**
 * Prépare une photo : décodage et proposition d'un cercle de recadrage.
 *
 * Le cercle est une proposition, pas un verdict — l'interface laisse
 * l'ajuster. `detecte` indique si la détection a abouti ou si on retombe
 * sur un cercle centré par défaut.
 */
export async function preparer(fichier) {
  const bitmap = await createImageBitmap(fichier)
  const disque = trouverDisque(bitmap)

  if (disque) return { bitmap, cercle: disque, detecte: true }

  const cote = Math.min(bitmap.width, bitmap.height)
  return {
    bitmap,
    cercle: { cx: bitmap.width / 2, cy: bitmap.height / 2, rayon: cote / 2 },
    detecte: false,
  }
}

/**
 * Rend la pièce détourée dans un canvas 224×224, sur fond blanc.
 *
 * Le fond est blanc et non noir, contrairement à la version serveur : les
 * images de référence de la BCE sont sur blanc, et leur ressembler compte
 * plus que de supprimer un maximum d'information.
 */
export function rendre(bitmap, cercle) {
  const r = cercle.rayon * 1.08
  const source = { x: cercle.cx - r, y: cercle.cy - r, cote: r * 2 }

  // Réduction par paliers de moitié. Un navigateur qui passe de 3000 px à
  // 224 en une seule fois sous-échantillonne brutalement : il ne retient
  // qu'un pixel sur treize et le résultat est mou. En divisant par deux à
  // chaque étape, chaque pixel conserve la moyenne de ses voisins.
  let courant = document.createElement('canvas')
  let cote = Math.min(Math.ceil(source.cote), 2048)
  courant.width = cote
  courant.height = cote
  let ctx = courant.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, source.x, source.y, source.cote, source.cote, 0, 0, cote, cote)

  while (cote > SORTIE * 2) {
    const suivant = document.createElement('canvas')
    const nouveau = Math.max(SORTIE, Math.round(cote / 2))
    suivant.width = nouveau
    suivant.height = nouveau
    const c = suivant.getContext('2d')
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = 'high'
    c.drawImage(courant, 0, 0, cote, cote, 0, 0, nouveau, nouveau)
    courant = suivant
    cote = nouveau
  }

  const canvas = document.createElement('canvas')
  canvas.width = SORTIE
  canvas.height = SORTIE
  const final = canvas.getContext('2d')
  final.fillStyle = '#ffffff'
  final.fillRect(0, 0, SORTIE, SORTIE)
  final.imageSmoothingEnabled = true
  final.imageSmoothingQuality = 'high'

  final.save()
  final.beginPath()
  final.arc(SORTIE / 2, SORTIE / 2, SORTIE / 2, 0, Math.PI * 2)
  final.clip()
  final.drawImage(courant, 0, 0, cote, cote, 0, 0, SORTIE, SORTIE)
  final.restore()

  accentuer(final)
  return canvas
}

/**
 * Légère accentuation, pour compenser l'adoucissement inévitable de la
 * réduction. Masque flou simplifié : on soustrait une version moyennée.
 */
function accentuer(ctx, force = 0.45) {
  const image = ctx.getImageData(0, 0, SORTIE, SORTIE)
  const src = image.data
  const copie = new Uint8ClampedArray(src)

  for (let y = 1; y < SORTIE - 1; y++) {
    for (let x = 1; x < SORTIE - 1; x++) {
      const i = (y * SORTIE + x) * 4
      for (let c = 0; c < 3; c++) {
        const moyenne =
          (copie[i - SORTIE * 4 + c] +
            copie[i + SORTIE * 4 + c] +
            copie[i - 4 + c] +
            copie[i + 4 + c]) / 4
        src[i + c] = copie[i + c] + (copie[i + c] - moyenne) * force
      }
    }
  }

  ctx.putImageData(image, 0, 0)
}
