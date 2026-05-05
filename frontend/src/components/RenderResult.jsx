import { useState } from 'react'

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  img: { width: '100%', borderRadius: 8, background: '#000' },
  row: { display: 'flex', gap: 8 },
  btn: {
    padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontSize: 13,
  },
  prompt: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '0.75rem', fontSize: 13,
    color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto',
  },
  meta: { fontSize: 14, color: 'var(--text-muted)' },
  mock: {
    padding: '0.6rem 0.75rem', borderRadius: 6,
    background: 'rgba(123, 63, 110, 0.18)', color: 'var(--text)', fontSize: 14,
    border: '1px solid rgba(123, 63, 110, 0.55)',
  },
  model: {
    fontSize: 13,
    color: 'var(--text-muted)',
    padding: '6px 10px',
    background: 'var(--surface)',
    borderRadius: 6,
    border: '1px solid var(--border)',
  },
}

export default function RenderResult({ result }) {
  const [showPrompt, setShowPrompt] = useState(false)
  const dataUrl = `data:${result.mime_type};base64,${result.image_base64}`

  const download = () => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = '3d-floorplan.png'
    a.click()
  }

  return (
    <div style={s.wrap}>
      <img src={dataUrl} alt="3D render" style={s.img} />
      {result.is_mock && (
        <div style={s.mock}>
          Mock render shown because Gemini is not configured. Add GEMINI_API_KEY to run Nano Banana.
        </div>
      )}
      {result.image_model_used ? (
        <p style={s.model}>
          <strong style={{ color: 'var(--text)' }}>Image model:</strong>{' '}
          {result.image_model_used}
        </p>
      ) : null}
      <p style={s.meta}>{result.room_count} rooms</p>
      <div style={s.row}>
        <button style={s.btn} onClick={download}>Download PNG</button>
        <button style={s.btn} onClick={() => setShowPrompt(v => !v)}>
          {showPrompt ? 'Hide prompt' : 'View prompt'}
        </button>
      </div>
      {showPrompt && <pre style={s.prompt}>{result.prompt_used}</pre>}
    </div>
  )
}
