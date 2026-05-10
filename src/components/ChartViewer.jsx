import { useEffect, useRef, useState } from 'react'
import { getChartUrl } from '../lib/supabase'

export default function ChartViewer({ song, compact = false }) {
  const canvasRef = useRef()
  const [numPages, setNumPages] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [renderTask, setRenderTask] = useState(null)

  useEffect(() => {
    if (!song) { setPdfDoc(null); setNumPages(0); setPageNum(1); return }
    if (song.file_type === 'pdf') {
      loadPdf(song)
    }
  }, [song?.id])

  useEffect(() => {
    if (pdfDoc) renderPage(pageNum)
  }, [pdfDoc, pageNum])

  async function loadPdf(song) {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()

    const url = getChartUrl(song.file_path)
    const doc = await pdfjsLib.getDocument(url).promise
    setPdfDoc(doc)
    setNumPages(doc.numPages)
    setPageNum(1)
  }

  async function renderPage(num) {
    if (!pdfDoc || !canvasRef.current) return
    if (renderTask) renderTask.cancel()
    const page = await pdfDoc.getPage(num)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const containerWidth = canvas.parentElement?.clientWidth || window.innerWidth
    const viewport = page.getViewport({ scale: 1 })
    const scale = containerWidth / viewport.width
    const scaled = page.getViewport({ scale })
    canvas.width = scaled.width
    canvas.height = scaled.height
    const task = page.render({ canvasContext: ctx, viewport: scaled })
    setRenderTask(task)
    try { await task.promise } catch (e) { /* cancelled */ }
  }

  if (!song) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎵</div>
          <p style={{ fontSize: '18px', margin: 0 }}>No song selected</p>
          <p style={{ fontSize: '14px', margin: '4px 0 0', opacity: 0.7 }}>Waiting for the leader to push a song...</p>
        </div>
      </div>
    )
  }

  if (song.file_type === 'pdf') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto', background: '#111' }}>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
        </div>
        {numPages > 1 && (
          <div style={navBar}>
            <button
              onClick={() => setPageNum(p => Math.max(1, p - 1))}
              disabled={pageNum <= 1}
              style={navBtn}
            >← Prev</button>
            <span style={{ color: '#9ca3af', fontSize: '14px' }}>{pageNum} / {numPages}</span>
            <button
              onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
              disabled={pageNum >= numPages}
              style={navBtn}
            >Next →</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', overflow: 'hidden' }}>
      <img
        src={getChartUrl(song.file_path)}
        alt={song.name}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
      />
    </div>
  )
}

const navBar = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 20px', background: '#1a1a24', borderTop: '1px solid #2a2a3a',
}
const navBtn = {
  background: '#2a2a3a', border: 'none', borderRadius: '8px', color: '#f3f4f6',
  cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: '10px 20px',
}
