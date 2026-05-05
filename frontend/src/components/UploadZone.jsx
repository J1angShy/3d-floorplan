import { useRef, useState } from 'react'

const s = {
  zone: {
    border: '1.5px dashed var(--border)',
    borderRadius: 8,
    padding: '2rem',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
    background: 'var(--surface)',
  },
  zoneActive: { borderColor: 'var(--accent)' },
  preview: {
    width: '100%',
    maxHeight: 280,
    objectFit: 'contain',
    borderRadius: 6,
    marginTop: 12,
    background: '#000',
  },
  label: { color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.55 },
}

export default function UploadZone({ onFileSelect, preview }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const handle = (file) => {
    if (file && file.type.startsWith('image/')) onFileSelect(file)
  }

  return (
    <div>
      <div
        style={{ ...s.zone, ...(dragging ? s.zoneActive : {}) }}
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => handle(e.target.files[0])}
        />
        {preview
          ? <img src={preview} alt="Floor plan preview" style={s.preview} />
          : <p style={s.label}>Drop 2D floor plan here<br />or click to browse</p>
        }
      </div>
    </div>
  )
}
