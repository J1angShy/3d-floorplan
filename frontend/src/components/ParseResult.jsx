const ROOM_LABELS = {
  bedroom: 'Bedroom', bathroom: 'Bathroom', kitchen: 'Kitchen',
  living_room: 'Living', dining_room: 'Dining', study: 'Study',
  balcony: 'Balcony', laundry: 'Laundry', garage: 'Garage',
  hallway: 'Hallway', other: 'Other',
}

const s = {
  wrap: { background: 'var(--surface)', borderRadius: 8, padding: '1rem', fontSize: 14 },
  summary: { color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.65, fontSize: 14 },
  rooms: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: {
    padding: '3px 10px', borderRadius: 20,
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    color: 'var(--text)', fontSize: 13,
  },
  outdoor: { color: 'var(--ok)', fontSize: 13, marginBottom: 4 },
  count: { color: 'var(--text-muted)', fontSize: 14 },
  key: { color: 'var(--accent)', fontSize: 13, marginBottom: 8 },
  model: {
    fontSize: 13,
    color: 'var(--text-muted)',
    marginBottom: 10,
    padding: '6px 10px',
    background: 'var(--surface-2)',
    borderRadius: 6,
    border: '1px solid var(--border)',
  },
  risks: { color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.55, marginTop: 8 },
}

export default function ParseResult({ result }) {
  return (
    <div style={s.wrap}>
      <p style={s.summary}>{result.summary}</p>
      {result.model_used ? (
        <p style={s.model}>
          <strong style={{ color: 'var(--text)' }}>Parse model:</strong>{' '}
          {result.model_used}
        </p>
      ) : null}
      <div style={s.rooms}>
        {result.rooms.map((room, i) => (
          <span key={i} style={s.tag}>
            {ROOM_LABELS[room.type] || room.type} — {room.label}
            {room.approx_area_sqm ? ` · ${room.approx_area_sqm}m²` : ''}
          </span>
        ))}
      </div>
      {result.has_outdoor_space && <p style={s.outdoor}>+ Outdoor space detected</p>}
      {result.consistency_key && <p style={s.key}>Consistency key: {result.consistency_key}</p>}
      <p style={s.count}>{result.rooms.length} spaces parsed</p>
      {result.hallucination_risks?.length > 0 && (
        <div style={s.risks}>
          Guardrails: {result.hallucination_risks.join(' ')}
        </div>
      )}
    </div>
  )
}
