import { useEffect } from 'react'

const s = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.88)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1.5rem',
  },
  closeBtn: {
    position: 'fixed', top: '1rem', right: '1.25rem', zIndex: 1001,
    background: 'none', border: 'none', color: '#fff',
    fontSize: 28, lineHeight: 1, cursor: 'pointer', opacity: 0.7,
  },
  singleImg: {
    maxWidth: '100%', maxHeight: '90vh',
    objectFit: 'contain', borderRadius: 8,
  },
  compareWrap: {
    display: 'flex', gap: '1rem',
    width: '100%', maxHeight: '90vh',
  },
  panel: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: 8,
    minWidth: 0,
  },
  panelLabel: {
    fontSize: 13, color: 'rgba(255,255,255,0.55)',
    textAlign: 'center', letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  panelImg: {
    width: '100%', flex: 1, objectFit: 'contain',
    borderRadius: 8, background: '#111',
    maxHeight: 'calc(90vh - 28px)',
  },
}

export default function ImageModal({ isOpen, onClose, mode, src, leftSrc, rightSrc, leftLabel, rightLabel }) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div style={s.backdrop} onClick={onClose}>
      <button style={s.closeBtn} onClick={onClose} aria-label="Close">×</button>
      {mode === 'single' ? (
        <img
          src={src}
          alt="Preview"
          style={s.singleImg}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div style={s.compareWrap} onClick={(e) => e.stopPropagation()}>
          <div style={s.panel}>
            <span style={s.panelLabel}>{leftLabel || '2D Floorplan'}</span>
            <img src={leftSrc} alt="2D floorplan" style={s.panelImg} />
          </div>
          <div style={s.panel}>
            <span style={s.panelLabel}>{rightLabel || '3D Render'}</span>
            <img src={rightSrc} alt="3D render" style={s.panelImg} />
          </div>
        </div>
      )}
    </div>
  )
}
