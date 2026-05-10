import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateCode } from '../lib/utils'

export default function Home() {
  const navigate = useNavigate()
  const [mode, setMode] = useState(null) // 'start' | 'join'
  const [folders, setFolders] = useState([])
  const [setlists, setSetlists] = useState([])
  const [selectedFolder, setSelectedFolder] = useState('')
  const [selectedSetlist, setSelectedSetlist] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadFolders() {
    const { data } = await supabase.from('folders').select('*').order('name')
    setFolders(data || [])
  }

  async function loadSetlists(folderId) {
    const { data } = await supabase
      .from('setlists')
      .select('*')
      .eq('folder_id', folderId)
      .order('name')
    setSetlists(data || [])
  }

  function handleModeSelect(m) {
    setMode(m)
    setError('')
    if (m === 'start') loadFolders()
  }

  async function handleFolderChange(e) {
    const id = e.target.value
    setSelectedFolder(id)
    setSelectedSetlist('')
    if (id) loadSetlists(id)
  }

  async function handleStartSession() {
    if (!selectedFolder) { setError('Please select a band/folder'); return }
    setLoading(true)
    setError('')
    try {
      let code
      let taken = true
      while (taken) {
        code = generateCode()
        const { data } = await supabase.from('sessions').select('id').eq('code', code).maybeSingle()
        taken = !!data
      }

      const { data: session, error: err } = await supabase.from('sessions').insert({
        code,
        folder_id: selectedFolder,
        setlist_id: selectedSetlist || null,
      }).select().single()

      if (err) throw err

      const { error: pErr } = await supabase.from('participants').insert({
        session_id: session.id,
        display_name: 'Leader',
        has_control: true,
      })
      if (pErr) throw pErr

      navigate(`/session/${code}/leader`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoinSession() {
    if (!joinCode.trim()) { setError('Enter a session code'); return }
    if (!displayName.trim()) { setError('Enter your name'); return }
    setLoading(true)
    setError('')
    try {
      const { data: session, error: err } = await supabase
        .from('sessions')
        .select('id')
        .eq('code', joinCode.trim().toUpperCase())
        .maybeSingle()

      if (err) throw err
      if (!session) { setError('Session not found'); setLoading(false); return }

      const { error: pErr } = await supabase.from('participants').insert({
        session_id: session.id,
        display_name: displayName.trim(),
        has_control: false,
      })
      if (pErr) throw pErr

      navigate(`/session/${joinCode.trim().toUpperCase()}/musician?name=${encodeURIComponent(displayName.trim())}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ backgroundColor: '#0a0a0f', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎸</div>
          <h1 style={{ fontSize: '40px', fontWeight: '800', color: '#f3f4f6', margin: '0 0 8px', letterSpacing: '-1px' }}>Vamp</h1>
          <p style={{ color: '#6b7280', fontSize: '16px', margin: 0 }}>Real-time chord charts for live gigs</p>
        </div>

        {!mode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button onClick={() => handleModeSelect('start')} style={btnStyle('#7c3aed')}>
              <span style={{ fontSize: '24px' }}>🎤</span>
              <div>
                <div style={{ fontWeight: '700', fontSize: '18px' }}>Start Session</div>
                <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '2px' }}>Band leader — push charts to your band</div>
              </div>
            </button>
            <button onClick={() => handleModeSelect('join')} style={btnStyle('#1a1a24', '#2a2a3a')}>
              <span style={{ fontSize: '24px' }}>🎵</span>
              <div>
                <div style={{ fontWeight: '700', fontSize: '18px' }}>Join Session</div>
                <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '2px' }}>Musician — enter a code to join</div>
              </div>
            </button>
            <button
              onClick={() => navigate('/library')}
              style={{ marginTop: '8px', background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer', padding: '12px', textDecoration: 'underline' }}
            >
              Manage Library
            </button>
          </div>
        )}

        {mode === 'start' && (
          <div>
            <button onClick={() => setMode(null)} style={backBtn}>← Back</button>
            <h2 style={sectionTitle}>Start a Session</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <select
                value={selectedFolder}
                onChange={handleFolderChange}
                style={selectStyle}
              >
                <option value="">Select a band / folder</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              {selectedFolder && (
                <select
                  value={selectedSetlist}
                  onChange={e => setSelectedSetlist(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">No setlist (browse all songs)</option>
                  {setlists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {error && <p style={{ color: '#f87171', fontSize: '14px', margin: 0 }}>{error}</p>}
              <button
                onClick={handleStartSession}
                disabled={loading}
                style={btnStyle('#7c3aed')}
              >
                {loading ? 'Starting...' : 'Start Session'}
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div>
            <button onClick={() => setMode(null)} style={backBtn}>← Back</button>
            <h2 style={sectionTitle}>Join a Session</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Session code (e.g. AB3X9K)"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ ...inputStyle, fontSize: '24px', letterSpacing: '4px', textAlign: 'center', textTransform: 'uppercase' }}
              />
              <input
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                style={inputStyle}
              />
              {error && <p style={{ color: '#f87171', fontSize: '14px', margin: 0 }}>{error}</p>}
              <button
                onClick={handleJoinSession}
                disabled={loading}
                style={btnStyle('#7c3aed')}
              >
                {loading ? 'Joining...' : 'Join Session'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  background: '#1a1a24',
  border: '1px solid #2a2a3a',
  borderRadius: '12px',
  color: '#f3f4f6',
  fontSize: '16px',
  padding: '16px',
  outline: 'none',
  width: '100%',
}

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
}

const backBtn = {
  background: 'none',
  border: 'none',
  color: '#6b7280',
  fontSize: '14px',
  cursor: 'pointer',
  padding: '0 0 16px',
  display: 'block',
}

const sectionTitle = {
  color: '#f3f4f6',
  fontSize: '22px',
  fontWeight: '700',
  margin: '0 0 20px',
}

function btnStyle(bg, borderColor) {
  return {
    background: bg,
    border: borderColor ? `1px solid ${borderColor}` : 'none',
    borderRadius: '16px',
    color: '#f3f4f6',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px 24px',
    width: '100%',
    textAlign: 'left',
    fontSize: '16px',
  }
}
