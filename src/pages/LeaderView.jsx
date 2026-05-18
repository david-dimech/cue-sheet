import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ChartViewer from '../components/ChartViewer'
import SongPicker from '../components/SongPicker'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

export default function LeaderView() {
  const { code } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [session, setSession] = useState(null)
  const [currentSong, setCurrentSong] = useState(null)
  const [participants, setParticipants] = useState([])
  const [showParticipants, setShowParticipants] = useState(false)
  // Mobile: 'songs' is the default so leader can pick immediately
  const [mobileTab, setMobileTab] = useState('songs')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSession()
  }, [code])

  useEffect(() => {
    if (!session) return
    loadCurrentSong(session.current_song_id)
    loadParticipants(session.id)

    const channel = supabase
      .channel(`session-leader-${session.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${session.id}`,
      }, payload => {
        setSession(prev => ({ ...prev, ...payload.new }))
        loadCurrentSong(payload.new.current_song_id)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'participants',
        filter: `session_id=eq.${session.id}`,
      }, () => loadParticipants(session.id))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session?.id])

  async function loadSession() {
    const { data } = await supabase.from('sessions').select('*').eq('code', code).single()
    setSession(data)
    setLoading(false)
  }

  async function loadCurrentSong(songId) {
    if (!songId) { setCurrentSong(null); return }
    const { data } = await supabase.from('songs').select('*').eq('id', songId).single()
    setCurrentSong(data)
  }

  async function loadParticipants(sessionId) {
    const { data } = await supabase
      .from('participants')
      .select('*')
      .eq('session_id', sessionId)
      .order('joined_at')
    setParticipants(data || [])
  }

  async function pickSong(song) {
    await supabase.from('sessions').update({ current_song_id: song.id }).eq('id', session.id)
    // On mobile, switch to chart view so leader can see what was pushed
    if (isMobile) setMobileTab('chart')
  }

  async function toggleControl(participant) {
    await supabase.from('participants')
      .update({ has_control: !participant.has_control })
      .eq('id', participant.id)
  }

  async function endSession() {
    if (!confirm('End session? Members will lose connection.')) return
    await supabase.from('sessions').delete().eq('id', session.id)
    navigate('/')
  }

  if (loading) {
    return <div style={centered}>Loading session...</div>
  }

  if (!session) {
    return (
      <div style={centered}>
        Session not found.{' '}
        <button onClick={() => navigate('/')} style={linkBtn}>Go home</button>
      </div>
    )
  }

  const topBar = (
    <div style={topBarStyle}>
      <div>
        <span style={codeLabel}>SESSION</span>
        <span style={codeText}>{code}</span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => setShowParticipants(p => !p)} style={topBarBtn}>
          👥 {participants.length}
        </button>
        <button onClick={endSession} style={{ ...topBarBtn, color: '#f87171' }}>End</button>
      </div>
    </div>
  )

  const participantsPanel = showParticipants && (
    <div style={participantsPanelStyle}>
      <h3 style={{ color: '#f3f4f6', fontSize: '15px', fontWeight: '600', margin: '0 0 10px' }}>Participants</h3>
      {participants.map(p => (
        <div key={p.id} style={participantRow}>
          <span style={{ color: p.has_control ? '#a855f7' : '#f3f4f6', fontSize: '14px', flex: 1 }}>
            {p.has_control ? '🎛️ ' : ''}{p.display_name}
          </span>
          <button
            onClick={() => toggleControl(p)}
            style={{
              ...controlBtn,
              background: p.has_control ? '#7c3aed' : '#2a2a3a',
              color: p.has_control ? '#fff' : '#9ca3af',
            }}
          >
            {p.has_control ? 'Revoke' : 'Give Control'}
          </button>
        </div>
      ))}
    </div>
  )

  // ── Mobile layout ───────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={pageStyle}>
        {topBar}
        {participantsPanel}

        {/* Now-playing bar — always visible */}
        <div style={nowPlayingBar}>
          <span style={{ color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Now playing
          </span>
          <span style={{ color: '#f3f4f6', fontSize: '15px', fontWeight: '600', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentSong ? currentSong.name : '—'}
          </span>
        </div>

        {/* Tab bar */}
        <div style={mobileTabBar}>
          <button
            onClick={() => setMobileTab('songs')}
            style={mobileTab === 'songs' ? mobileActiveTab : mobileInactiveTab}
          >
            Songs
          </button>
          <button
            onClick={() => setMobileTab('chart')}
            style={mobileTab === 'chart' ? mobileActiveTab : mobileInactiveTab}
          >
            Chart
          </button>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {mobileTab === 'songs' ? (
            <SongPicker
              session={session}
              currentSongId={currentSong?.id}
              onPick={pickSong}
            />
          ) : (
            <ChartViewer song={currentSong} />
          )}
        </div>
      </div>
    )
  }

  // ── Desktop layout (side-by-side) ───────────────────────────
  return (
    <div style={pageStyle}>
      {topBar}
      {participantsPanel}

      <div style={desktopLayout}>
        <div style={chartArea}>
          <div style={songTitleBar}>
            {currentSong ? currentSong.name : 'No song selected'}
          </div>
          <ChartViewer song={currentSong} />
        </div>

        <div style={pickerArea}>
          <div style={pickerHeader}>Song Picker</div>
          <SongPicker
            session={session}
            currentSongId={currentSong?.id}
            onPick={pickSong}
          />
        </div>
      </div>
    </div>
  )
}

const pageStyle = {
  backgroundColor: '#0a0a0f', minHeight: '100dvh', display: 'flex', flexDirection: 'column',
}

const topBarStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 16px', background: '#111118', borderBottom: '1px solid #2a2a3a',
  flexShrink: 0,
}

const codeLabel = { color: '#6b7280', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', marginRight: '8px' }
const codeText = { color: '#a855f7', fontSize: '20px', fontWeight: '800', letterSpacing: '3px' }

const topBarBtn = {
  background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: '8px',
  color: '#f3f4f6', cursor: 'pointer', fontSize: '14px', padding: '8px 14px',
}

const participantsPanelStyle = {
  background: '#111118', borderBottom: '1px solid #2a2a3a', padding: '16px', flexShrink: 0,
}

const participantRow = {
  display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0',
  borderBottom: '1px solid #1a1a24',
}

const controlBtn = {
  border: 'none', borderRadius: '6px', cursor: 'pointer',
  fontSize: '12px', fontWeight: '600', padding: '6px 12px',
}

const nowPlayingBar = {
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '10px 16px', background: '#111118', borderBottom: '1px solid #2a2a3a',
  flexShrink: 0,
}

const mobileTabBar = {
  display: 'flex', background: '#111118', borderBottom: '1px solid #2a2a3a',
  flexShrink: 0,
}

const mobileActiveTab = {
  flex: 1, background: 'none', border: 'none', borderBottom: '2px solid #7c3aed',
  color: '#a855f7', cursor: 'pointer', fontSize: '15px', fontWeight: '700',
  padding: '14px',
}

const mobileInactiveTab = {
  flex: 1, background: 'none', border: 'none', borderBottom: '2px solid transparent',
  color: '#6b7280', cursor: 'pointer', fontSize: '15px', padding: '14px',
}

// Desktop-only styles
const desktopLayout = { flex: 1, display: 'flex', overflow: 'hidden' }

const chartArea = {
  flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
  borderRight: '1px solid #2a2a3a', minWidth: 0,
}

const songTitleBar = {
  padding: '12px 16px', color: '#f3f4f6', fontSize: '16px', fontWeight: '700',
  background: '#111118', borderBottom: '1px solid #2a2a3a', flexShrink: 0,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

const pickerArea = {
  width: '300px', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
}

const pickerHeader = {
  padding: '12px 16px', color: '#6b7280', fontSize: '12px', fontWeight: '700',
  textTransform: 'uppercase', letterSpacing: '0.5px',
  background: '#111118', borderBottom: '1px solid #2a2a3a', flexShrink: 0,
}

const centered = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: '100dvh', color: '#f3f4f6',
}

const linkBtn = {
  background: 'none', border: 'none', color: '#a855f7', cursor: 'pointer', fontSize: '16px',
}
