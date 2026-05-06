import { useEffect, useRef, useState } from 'react'
import { createBrand, deleteBrand, getBrands, parseBrandPdf, updateBrand } from '../api/client'

const FIELDS = [
  { key: 'name', label: 'Display Name', hint: 'Short name shown in the brand selector' },
  { key: 'walls', label: 'Walls', hint: 'Wall finish and color, e.g. "pure white matte plaster (#FFFFFF)"' },
  { key: 'floor', label: 'Floor', hint: 'Floor material and texture' },
  { key: 'furniture_style', label: 'Furniture Style', hint: 'Style descriptors and upholstery' },
  { key: 'accent_primary', label: 'Primary Accent', hint: 'Dominant brand color with hex code' },
  { key: 'accent_secondary', label: 'Secondary Accent', hint: 'Secondary color with hex code' },
  { key: 'fixtures', label: 'Fixtures & Frames', hint: 'Door frames, window frames, hardware finish' },
  { key: 'lighting', label: 'Lighting', hint: 'Lighting character and direction' },
  { key: 'greenery', label: 'Greenery', hint: 'Plant style or "none"' },
]

const EMPTY = {
  name: '', walls: '', floor: '', furniture_style: '',
  accent_primary: '', accent_secondary: '', fixtures: '', lighting: '', greenery: '',
}

const s = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  header: {
    borderBottom: '1px solid var(--border)',
    padding: '1rem 1.5rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  headerRight: { display: 'flex', gap: 8 },
  title: { fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px' },
  backBtn: {
    padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontSize: 13,
  },
  btn: {
    padding: '8px 16px', borderRadius: 6, border: 'none',
    background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
  },
  btnSecondary: {
    padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontSize: 13,
  },
  btnDanger: {
    padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(224,82,82,0.4)',
    background: 'transparent', color: 'var(--error)', cursor: 'pointer', fontSize: 13,
  },
  btnDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  content: { padding: '1.5rem', flex: 1, maxWidth: 860, width: '100%', margin: '0 auto' },
  error: { fontSize: 13, color: 'var(--error)', padding: '0.6rem 0.75rem', background: 'rgba(224,82,82,0.1)', borderRadius: 6, border: '1px solid rgba(224,82,82,0.25)' },
  // Brand card
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
    padding: '1rem 1.25rem', marginBottom: 10,
  },
  cardRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardName: { fontSize: 15, fontWeight: 600, marginBottom: 4 },
  cardId: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 },
  cardFields: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px' },
  cardField: { fontSize: 13, color: 'var(--text-muted)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardFieldKey: { color: 'var(--text)', fontWeight: 500 },
  cardActions: { display: 'flex', gap: 6, flexShrink: 0, marginTop: 2 },
  // Form
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  formTitle: { fontSize: 15, fontWeight: 600, marginBottom: 4 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  fieldHint: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 },
  fieldInput: {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
    resize: 'vertical', minHeight: 60, boxSizing: 'border-box',
  },
  fieldInputSingle: {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
  },
  formActions: { display: 'flex', gap: 8, paddingTop: 4 },
  saveError: { fontSize: 13, color: 'var(--error)' },
  // PDF zone
  pdfZone: {
    border: '1.5px dashed var(--border)', borderRadius: 8, padding: '2rem',
    textAlign: 'center', cursor: 'pointer', background: 'var(--surface)',
    marginBottom: 16, transition: 'border-color 0.15s',
  },
  pdfZoneActive: { borderColor: 'var(--accent)' },
  pdfLabel: { color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.55 },
  pdfLoading: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-muted)' },
  dot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite', flexShrink: 0 },
  sectionLabel: { fontSize: 12, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 },
  divider: { border: 'none', borderTop: '1px solid var(--border)', margin: '1.25rem 0' },
  deleteConfirm: {
    marginTop: 8, padding: '0.75rem', background: 'rgba(224,82,82,0.08)',
    border: '1px solid rgba(224,82,82,0.25)', borderRadius: 6, fontSize: 13,
    display: 'flex', gap: 8, alignItems: 'center',
  },
}

const PREVIEW_KEYS = ['walls', 'floor', 'accent_primary']

export default function BrandPresetsPage({ onBack, activeBrand, onActiveBrandChange }) {
  const [brands, setBrands] = useState({})
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState(null)

  const [view, setView] = useState('list')       // 'list' | 'form'
  const [formMode, setFormMode] = useState('create') // 'create' | 'edit'
  const [editId, setEditId] = useState(null)
  const [draftId, setDraftId] = useState('')
  const [draft, setDraft] = useState(EMPTY)

  const [pdfStep, setPdfStep] = useState(false)
  const [pdfDragging, setPdfDragging] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const pdfInputRef = useRef()

  const fetchBrands = async () => {
    setLoading(true)
    try {
      const data = await getBrands()
      setBrands(data.presets || {})
    } catch (e) {
      setPageError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBrands() }, [])

  const openEdit = (id) => {
    setFormMode('edit')
    setEditId(id)
    setDraftId(id)
    setDraft({ ...brands[id] })
    setPdfStep(false)
    setPdfError(null)
    setSaveError(null)
    setView('form')
  }

  const openCreate = (fromPdf = false) => {
    setFormMode('create')
    setEditId(null)
    setDraftId('')
    setDraft({ ...EMPTY })
    setPdfStep(fromPdf)
    setPdfError(null)
    setSaveError(null)
    setView('form')
  }

  const handlePdfFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setPdfError('Please upload a PDF file.')
      return
    }
    setPdfLoading(true)
    setPdfError(null)
    try {
      const result = await parseBrandPdf(file)
      setDraft(prev => ({ ...EMPTY, ...result }))
      if (result.name) {
        setDraftId(result.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
      }
      setPdfStep(false)
    } catch (e) {
      setPdfError(e.message)
    } finally {
      setPdfLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      if (formMode === 'create') {
        const id = draftId.trim().toLowerCase().replace(/\s+/g, '_')
        if (!id) { setSaveError('Brand ID is required.'); setSaving(false); return }
        await createBrand(id, draft)
      } else {
        await updateBrand(editId, draft)
      }
      await fetchBrands()
      setView('list')
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteBrand(id)
      if (activeBrand === id) onActiveBrandChange('modern')
      setDeleteConfirm(null)
      await fetchBrands()
    } catch (e) {
      setPageError(e.message)
    }
  }

  const setField = (key, val) => setDraft(prev => ({ ...prev, [key]: val }))

  // ── Form view ──────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div style={s.page}>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
        <header style={s.header}>
          <div style={s.headerLeft}>
            <button style={s.backBtn} onClick={() => setView('list')}>← Back</button>
            <span style={s.title}>{formMode === 'edit' ? `Edit: ${draft.name || editId}` : 'New Brand Preset'}</span>
          </div>
          <div style={s.headerRight}>
            <button style={s.btnSecondary} onClick={() => setView('list')}>Cancel</button>
            <button
              style={{ ...s.btn, ...(saving ? s.btnDisabled : {}) }}
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Save preset'}
            </button>
          </div>
        </header>

        <div style={s.content}>
          {/* PDF upload step */}
          {pdfStep && (
            <>
              <p style={s.sectionLabel}>Step 1 — Upload branding guide PDF</p>
              {pdfLoading ? (
                <div style={{ ...s.pdfZone, cursor: 'default' }}>
                  <div style={{ ...s.pdfLoading, justifyContent: 'center' }}>
                    <span style={s.dot} />
                    Extracting brand details from PDF…
                  </div>
                </div>
              ) : (
                <div
                  style={{ ...s.pdfZone, ...(pdfDragging ? s.pdfZoneActive : {}) }}
                  onClick={() => pdfInputRef.current.click()}
                  onDragOver={(e) => { e.preventDefault(); setPdfDragging(true) }}
                  onDragLeave={() => setPdfDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setPdfDragging(false); handlePdfFile(e.dataTransfer.files[0]) }}
                >
                  <input ref={pdfInputRef} type="file" accept="application/pdf" style={{ display: 'none' }}
                    onChange={(e) => handlePdfFile(e.target.files[0])} />
                  <p style={s.pdfLabel}>Drop branding guide PDF here<br />or click to browse — max 20 MB</p>
                </div>
              )}
              {pdfError && <p style={{ ...s.error, marginBottom: 12 }}>{pdfError}</p>}
              <p style={{ ...s.sectionLabel, marginBottom: 16 }}>
                — or skip and fill in manually below
              </p>
            </>
          )}

          <div style={s.form}>
            {formMode === 'create' && (
              <div style={s.fieldGroup}>
                <label style={s.fieldLabel}>Brand ID <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(slug, no spaces)</span></label>
                <span style={s.fieldHint}>Used internally — e.g. "acme", "modern_luxe"</span>
                <input
                  style={s.fieldInputSingle}
                  value={draftId}
                  onChange={(e) => setDraftId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="brand_id"
                />
              </div>
            )}

            {FIELDS.map(({ key, label, hint }) => (
              <div key={key} style={s.fieldGroup}>
                <label style={s.fieldLabel}>{label}</label>
                <span style={s.fieldHint}>{hint}</span>
                <textarea
                  style={s.fieldInput}
                  value={draft[key] || ''}
                  onChange={(e) => setField(key, e.target.value)}
                  rows={key === 'name' ? 1 : 2}
                />
              </div>
            ))}

            {saveError && <p style={s.error}>{saveError}</p>}
          </div>
        </div>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <button style={s.backBtn} onClick={onBack}>← Floorplan</button>
          <span style={s.title}>Brand Presets</span>
        </div>
        <div style={s.headerRight}>
          <button style={s.btnSecondary} onClick={() => openCreate(true)}>+ From PDF</button>
          <button style={s.btn} onClick={() => openCreate(false)}>+ New blank</button>
        </div>
      </header>

      <div style={s.content}>
        {pageError && <p style={{ ...s.error, marginBottom: 12 }}>{pageError}</p>}
        {loading ? (
          <div style={s.pdfLoading}><span style={s.dot} /> Loading presets…</div>
        ) : (
          Object.entries(brands).map(([id, preset]) => (
            <div key={id} style={s.card}>
              <div style={s.cardRow}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={s.cardName}>{preset.name || id}</div>
                  <div style={s.cardId}>id: {id}{activeBrand === id ? ' · active' : ''}</div>
                  <div style={s.cardFields}>
                    {PREVIEW_KEYS.map(k => (
                      <span key={k} style={s.cardField}>
                        <span style={s.cardFieldKey}>{k.replace('_', ' ')}: </span>
                        {preset[k]}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={s.cardActions}>
                  {activeBrand !== id && (
                    <button style={s.btnSecondary} onClick={() => onActiveBrandChange(id)}>Use</button>
                  )}
                  <button style={s.btnSecondary} onClick={() => openEdit(id)}>Edit</button>
                  {Object.keys(brands).length > 1 && (
                    <button style={s.btnDanger} onClick={() => setDeleteConfirm(id)}>Delete</button>
                  )}
                </div>
              </div>

              {deleteConfirm === id && (
                <div style={s.deleteConfirm}>
                  <span style={{ flex: 1 }}>Delete "{preset.name || id}"? This cannot be undone.</span>
                  <button style={s.btnDanger} onClick={() => handleDelete(id)}>Confirm delete</button>
                  <button style={s.btnSecondary} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
