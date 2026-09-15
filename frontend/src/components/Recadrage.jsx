import { useEffect, useRef, useState } from 'react'
import { rendre } from '../detourage'

const LARGEUR = 300 // largeur d'affichage de la photo, en pixels

/**
 * Ajustement du cercle de recadrage avant analyse.
 *
 * La détection automatique propose un cercle ; elle se trompe sur les fonds
 * chargés. Plutôt que de subir le résultat ou de tout recadrer à la main,
 * on part de sa proposition et on la corrige au besoin : glisser pour
 * déplacer, curseur pour la taille.
 */
export default function Recadrage({ photo, onValider, onReprendre }) {
  const { bitmap, detecte } = photo
  const [cercle, setCercle] = useState(photo.cercle)
  const [apercu, setApercu] = useState(null)
  const toile = useRef(null)
  const glisse = useRef(null)

  const echelle = LARGEUR / bitmap.width
  const hauteur = Math.round(bitmap.height * echelle)
  const rayonMax = Math.min(bitmap.width, bitmap.height) / 2

  // Redessine la photo et le cercle à chaque changement.
  useEffect(() => {
    const ctx = toile.current.getContext('2d')
    ctx.clearRect(0, 0, LARGEUR, hauteur)
    ctx.drawImage(bitmap, 0, 0, LARGEUR, hauteur)

    const cx = cercle.cx * echelle
    const cy = cercle.cy * echelle
    const r = cercle.rayon * echelle

    // L'extérieur est assombri : le regard va droit à ce qui sera analysé.
    ctx.save()
    ctx.fillStyle = 'rgba(12, 22, 20, 0.66)'
    ctx.beginPath()
    ctx.rect(0, 0, LARGEUR, hauteur)
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true)
    ctx.fill()
    ctx.restore()

    ctx.strokeStyle = '#c39a4b'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }, [bitmap, cercle, echelle, hauteur])

  // Aperçu du résultat, mis à jour en même temps.
  useEffect(() => {
    setApercu(rendre(bitmap, cercle).toDataURL('image/jpeg', 0.8))
  }, [bitmap, cercle])

  function versImage(e) {
    const rect = toile.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * bitmap.width,
      y: ((e.clientY - rect.top) / rect.height) * bitmap.height,
    }
  }

  function debutGlisse(e) {
    const point = versImage(e)
    glisse.current = { dx: cercle.cx - point.x, dy: cercle.cy - point.y }
    toile.current.setPointerCapture(e.pointerId)
  }

  function pendantGlisse(e) {
    if (!glisse.current) return
    const point = versImage(e)
    setCercle((c) => ({
      ...c,
      cx: Math.round(point.x + glisse.current.dx),
      cy: Math.round(point.y + glisse.current.dy),
    }))
  }

  function finGlisse(e) {
    glisse.current = null
    toile.current.releasePointerCapture?.(e.pointerId)
  }

  return (
    <>
      <p className="panneau-aide">
        {detecte
          ? 'Vérifie le cercle : déplace-le au doigt, ajuste sa taille au curseur.'
          : "Contour non détecté. Place le cercle sur la pièce : déplace-le au doigt, ajuste sa taille au curseur."}
      </p>

      <div className="recadrage">
        <canvas
          ref={toile}
          width={LARGEUR}
          height={hauteur}
          onPointerDown={debutGlisse}
          onPointerMove={pendantGlisse}
          onPointerUp={finGlisse}
          onPointerCancel={finGlisse}
        />
        {apercu && (
          <figure className="recadrage-apercu">
            <img src={apercu} alt="Aperçu du résultat" />
            <figcaption>analysé</figcaption>
          </figure>
        )}
      </div>

      <label className="recadrage-taille">
        <span>Taille</span>
        <input
          type="range"
          min={Math.round(rayonMax * 0.15)}
          max={Math.round(rayonMax)}
          value={Math.round(cercle.rayon)}
          onChange={(e) => setCercle((c) => ({ ...c, rayon: Number(e.target.value) }))}
        />
      </label>

      <button className="principal" onClick={() => onValider(rendre(bitmap, cercle))}>
        Identifier
      </button>
      <button className="secondaire" onClick={onReprendre}>
        Reprendre la photo
      </button>
    </>
  )
}
