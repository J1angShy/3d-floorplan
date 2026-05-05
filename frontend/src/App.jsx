import { useState } from 'react'
import UploadZone from './components/UploadZone'
import ParseResult from './components/ParseResult'
import RenderResult from './components/RenderResult'
import { buildPromptFromParse, getGenerateJob, getParseJob, startGenerateJob, startParseJob } from './api/client'

const BRAND_PRESET = 'modern'

const s = {
  app: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: {
    borderBottom: '1px solid var(--border)',
    padding: '1rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  title: { fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px' },
  subtitle: { fontSize: 14, color: 'var(--text-muted)' },
  main: {
    flex: 1, display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    minHeight: 0,
    gap: '1px', background: 'var(--border)',
  },
  panel: {
    background: 'var(--bg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16,
    minWidth: 0, minHeight: 0,
  },
  emptyCol: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    border: '1px dashed var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    fontSize: 15,
    textAlign: 'center',
    padding: '2rem 1.25rem',
    lineHeight: 1.5,
  },
  step: { fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' },
  title2: { fontSize: 13, fontWeight: 600, marginBottom: 2 },
  btn: {
    padding: '9px 18px', borderRadius: 6, border: 'none',
    background: 'var(--accent)', color: '#fff',
    cursor: 'pointer', fontSize: 14, fontWeight: 500,
    alignSelf: 'flex-start',
  },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  status: { fontSize: 15, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 },
  error: { fontSize: 14, color: 'var(--error)' },
  helper: { fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 },
  progressWrap: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: 8,
  },
  progressTrack: { height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--accent)', transition: 'width 0.25s ease' },
  progressMeta: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' },
  dot: {
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--accent)', animation: 'pulse 1s infinite',
  },
  promptArea: {
    width: '100%',
    minHeight: 248,
    padding: '12px 14px',
    fontSize: 13,
    lineHeight: 1.55,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    color: 'var(--text)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  actionRow: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  btnSecondary: {
    padding: '9px 18px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--surface-2)', color: 'var(--text)',
    cursor: 'pointer', fontSize: 14, fontWeight: 500, alignSelf: 'flex-start',
  },
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function buildProgressMessage(progress, type) {
  if (!progress) {
    const label = type === 'parse' ? 'analysis' : 'generation'
    return {
      progress: 5,
      stage: 'queued',
      message: `Submitting ${label} job...`,
      elapsed_seconds: 0,
    }
  }

  const elapsed = Math.floor(progress.elapsed_seconds || 0)
  const extra =
    progress.stage === 'calling_nano_banana' && elapsed > 45
      ? ' Still waiting on Nano Banana 2; larger floorplans can take longer.'
      : progress.stage === 'calling_gemini_vision' && elapsed > 20
        ? ' Still waiting on Gemini Vision; detailed plans can take longer to parse.'
      : ''

  return {
    ...progress,
    message: `${progress.message}${extra}`,
  }
}

export default function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [parseResult, setParseResult] = useState(null)
  const [renderResult, setRenderResult] = useState(null)
  const [parseProgress, setParseProgress] = useState(null)
  const [generationProgress, setGenerationProgress] = useState(null)
  const [promptDraft, setPromptDraft] = useState('')
  const [promptLoading, setPromptLoading] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const handleFileSelect = (f) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setParseResult(null)
    setRenderResult(null)
    setParseProgress(null)
    setGenerationProgress(null)
    setPromptDraft('')
    setPromptLoading(false)
    setStatus('idle')
    setError(null)
  }

  const handleParse = async () => {
    setStatus('parsing')
    setError(null)
    setParseResult(null)
    setRenderResult(null)
    setPromptDraft('')
    setPromptLoading(false)
    setParseProgress({
      progress: 5,
      stage: 'submitting',
      message: 'Submitting floorplan analysis job...',
      elapsed_seconds: 0,
    })
    try {
      const job = await startParseJob(file)
      setParseProgress({
        progress: 8,
        stage: job.status,
        message: job.message,
        elapsed_seconds: 0,
      })

      for (;;) {
        await sleep(1500)
        const next = await getParseJob(job.job_id)
        setParseProgress(next)

        if (next.status === 'completed') {
          const result = next.result
          setParseResult(result)
          setPromptLoading(true)
          try {
            const { prompt } = await buildPromptFromParse(result, BRAND_PRESET)
            setPromptDraft(prompt)
            setStatus('parsed')
          } catch (e) {
            setPromptDraft('')
            setError(e.message)
            setStatus('error')
          } finally {
            setPromptLoading(false)
          }
          break
        }

        if (next.status === 'failed') {
          throw new Error(next.error || next.message || 'Floorplan analysis failed')
        }
      }
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  const handleGenerate = async () => {
    setStatus('generating')
    setError(null)
    setRenderResult(null)
    setGenerationProgress({
      progress: 5,
      stage: 'submitting',
      message: 'Submitting generation job...',
      elapsed_seconds: 0,
    })
    try {
      const job = await startGenerateJob(file, parseResult, BRAND_PRESET, promptDraft)
      setGenerationProgress({
        progress: 8,
        stage: job.status,
        message: job.message,
        elapsed_seconds: 0,
      })

      for (;;) {
        await sleep(2000)
        const next = await getGenerateJob(job.job_id)
        setGenerationProgress(next)

        if (next.status === 'completed') {
          setRenderResult(next.result)
          setStatus('done')
          break
        }

        if (next.status === 'failed') {
          throw new Error(next.error || next.message || 'Generation failed')
        }
      }
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  const reloadPromptFromParse = async () => {
    if (!parseResult) return
    setError(null)
    setPromptLoading(true)
    try {
      const { prompt } = await buildPromptFromParse(parseResult, BRAND_PRESET)
      setPromptDraft(prompt)
    } catch (e) {
      setError(e.message)
    } finally {
      setPromptLoading(false)
    }
  }

  const isLoading = status === 'parsing' || status === 'generating'
  const canGenerate = parseResult && promptDraft.trim() && !promptLoading && status !== 'generating'

  return (
    <div style={s.app}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      <header style={s.header}>
        <div>
          <div style={s.title}>2D → 3D Floorplan</div>
          <div style={s.subtitle}>Parse first, then generate with locked brand guardrails.</div>
        </div>
      </header>

      <main style={s.main}>

        {/* Step 1: Upload */}
        <div style={s.panel}>
          <span style={s.step}>01 — Input</span>
          <UploadZone onFileSelect={handleFileSelect} preview={preview} />
          <p style={s.helper}>
            MVP focus: extract a structured room list, build a deterministic brand prompt,
            review and edit it in step 03, then generate.
          </p>

          {file && !isLoading && (status === 'idle' || status === 'error') && (
            <button style={s.btn} onClick={handleParse}>Parse rooms</button>
          )}
          {status === 'error' && <p style={s.error}>{error}</p>}
        </div>

        {/* Step 2: Parse — always visible */}
        <div style={s.panel}>
          <span style={s.step}>02 — Parse</span>
          {status === 'parsing' && (
            <>
              <div style={s.status}><span style={s.dot} /> Analysing floor plan...</div>
              <GenerationProgress progress={buildProgressMessage(parseProgress, 'parse')} />
            </>
          )}
          {parseResult && (
            <ParseResult result={parseResult} />
          )}
          {status === 'error' && !parseResult && <p style={s.error}>{error}</p>}
          {!parseResult && status !== 'parsing' && status !== 'generating' && status !== 'error' && (
            <div style={s.emptyCol}>
              No analysis yet.<br />
              Upload a floor plan and run Parse rooms.
            </div>
          )}
        </div>

        {/* Step 3: Output — always visible */}
        <div style={s.panel}>
          <span style={s.step}>03 — Prompt & output</span>
          {renderResult ? (
            <RenderResult result={renderResult} />
          ) : parseResult ? (
            <>
              <p style={s.helper}>
                This prompt is built from the parse result and brand preset. Edit if needed, then generate.
              </p>
              {promptLoading && (
                <div style={s.status}><span style={s.dot} /> Building generation prompt...</div>
              )}
              {!promptLoading && (
                <textarea
                  style={s.promptArea}
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  disabled={status === 'generating'}
                  spellCheck={false}
                  aria-label="Generation prompt"
                />
              )}
              <div style={s.actionRow}>
                <button
                  type="button"
                  style={{
                    ...s.btnSecondary,
                    ...(status === 'generating' || promptLoading ? s.btnDisabled : {}),
                  }}
                  disabled={status === 'generating' || promptLoading}
                  onClick={reloadPromptFromParse}
                >
                  Reset prompt from brand preset
                </button>
                <button
                  type="button"
                  style={{
                    ...s.btn,
                    ...(!canGenerate ? s.btnDisabled : {}),
                  }}
                  disabled={!canGenerate}
                  onClick={handleGenerate}
                >
                  Generate 3D
                </button>
              </div>
              {status === 'generating' && (
                <>
                  <div style={s.status}><span style={s.dot} /> Generating 3D render...</div>
                  <GenerationProgress progress={buildProgressMessage(generationProgress, 'generate')} />
                </>
              )}
            </>
          ) : (
            <div style={s.emptyCol}>
              No prompt yet.<br />
              Complete parse in step 02 — the brand prompt will appear here for review.
            </div>
          )}
        </div>

      </main>
    </div>
  )
}

function GenerationProgress({ progress }) {
  const pct = Math.max(0, Math.min(100, progress.progress || 0))
  const elapsed = Math.floor(progress.elapsed_seconds || 0)

  return (
    <div style={s.progressWrap}>
      <div style={s.progressMeta}>
        <span>{progress.stage?.replaceAll('_', ' ') || 'working'}</span>
        <span>{pct}% · {elapsed}s</span>
      </div>
      <div style={s.progressTrack}>
        <div style={{ ...s.progressFill, width: `${pct}%` }} />
      </div>
      <p style={s.helper}>{progress.message}</p>
    </div>
  )
}
