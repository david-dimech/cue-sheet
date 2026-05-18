import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ChartViewer from '../components/ChartViewer'
import SongPicker from '../components/SongPicker'

export default function MusicianView() {
  const { code } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const displayName = searchParams.get('name') || 'Musician'
  const [session, setSession] = useState(null)
  const [currentSong, setCurrentSong] = useState(null)
  const [myParticipant, setMyParticipant] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [disconnected, setDisconnected] = useState(false)

  useEffect(() => {
    init()
  }, [code])

  useEffect(() => {
    if (!session || !myParticipant) return

    const channel = supabase
      .channel(`session-musician-${session.id}-${myParticipant.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${session.id}`,
      }, payload => {
        setSession(prev => ({ ...prev, ...payload.new }))
        loadCurrentSong(payload.new.current_song_id)
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${session.id}`,
      }, () => setDisconnected(true))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'participants',
        filter: `id=eq.${myParticipant.id}`,
      }, payload => {
        setMyParticipant(prev => ({ ...prev, ...payload.new }))
        if (!payload.new.has_control) setPickerOpen(false)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session?.id, myParticipant?.id])

  async function init() {
    const { data: sess } = await supabase
      .from('sessions')
      .select('*')
      .eq('code', code)
      .single()

    if (!sess) { setLoading(false); return }
    setSession(sess)
    loadCurrentSong(sess.current_song_id)

    // Prefer the stored participant ID (set on join) to avoid name-collision issues
    const storedId = sessionStorage.getItem(`vamp_participant_${code}`)
    let participant = null

    if (storedId) {
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('id', storedId)
        .maybeSingle()
      participant = data
    }

    // Fall back to name match (e.g. page refreshed without stored ID)
    if (!participant) {
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('session_id', sess.id)
        .eq('display_name', displayName)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      participant = data
      // Re-store the recovered ID for subsequent refreshes
      if (participant) {
        sessionStorage.setItem(`vamp_participant_${code}`, participant.id)
      }
    }

    setMyParticipant(participant)
    setLoading(false)
  }

  async function loadCurrentSong(songId) {
    if (!songId) { setCurrentSong(null); return }
    const { data } = await supabase.from('songs').select('*').eq('id', songId).single()
    setCurrentSong(data)
  }

  async function handlePick(song) {
    await supabase.from('sessions').update({ current_song_id: song.id }).eq('id', session.id)
    setPickerOpen(false)
  }

  if (loading) {
    return <div style={fullScreen}><p style={{ color: '#6b7280' }}>Connecting...</p></div>
  }

  if (!session) {
    return (
      <div style={fullScreen}>
        <p style={{ color: '#f3f4f6', fontSize: '18px' }}>Session not found</p>
        <button onClick={() => navigate('/')} style={goHomeBtn}>Go Home</button>
      </div>
    )
  }

  if (disconnected) {
    return (
      <div style={fullScreen}>
        <p style={{ color: '#f3f4f6', fontSize: '20px', marginBottom: '12px' }}>Session ended</p>
        <p style={{ color: '#6b7280', fontSize: '15px', marginBottom: '24px' }}>The leader has ended this session.</p>
        <button onClick={() => navigate('/')} style={goHomeBtn}>Go Home</button>
      </div>
    )
  }

  const hasControl = myParticipant?.has_control

  return (
    <div style={pageStyle}>
      <div style={headerBar}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={codePill}>{code}</span>
          {currentSong && <span style={titleSmall}>{currentSong.name}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasControl && <span style={controlBadge}>🎛️ Control</span>}
          <span style={namePill}>{displayName}</span>
        </div>
      </div>

      <div style={chartWrap}>
        <ChartViewer song={currentSong} />
      </div>

      {hasControl && (
        <>
          <button onClick={() => setPickerOpen(p => !p)} style={pickerToggle}>
            {pickerOpen ? '▼ Close Picker' : '▲ Song Picker'}
          </button>
          {pickerOpen && (
            <SongPicker
              session={session}
              currentSongId={currentSong?.id}
              onPick={handlePick}
              isSlideUp
            />
          )}
        </>
      )}
    </div>
  )
}

const pageStyle = {
  backgroundColor: '#000', minHeight: '100dvh', display: 'flex', flexDirection: 'column',
}

const fullScreen = {
  backgroundColor: '#000', minHeight: '100dvh', display: 'flex',
  flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
}

const headerBar = {
  position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 14px',
  background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
}

const codePill = {
  background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.5)',
  borderRadius: '6px', color: '#a855f7', fontSize: '13px', fontWeight: '700',
  letterSpacing: '2px', padding: '4px 8px',
}

const titleSmall = {
  color: 'rgba(255,255,255,0.7)', fontSize: '13px',
  maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

const namePill = {
  background: 'rgba(255,255,255,0.1)', borderRadius: '6px',
  color: 'rgba(255,255,255,0.6)', fontSize: '12px', padding: '4px 8px',
}

const controlBadge = {
  background: 'rgba(124,58,237,0.4)', borderRadius: '6px',
  color: '#a855f7', fontSize: '12px', fontWeight: '600', padding: '4px 8px',
}

const chartWrap = {
  flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
}

const pickerToggle = {
  background: '#111118', border: 'none', borderTop: '1px solid #2a2a3a',
  color: '#9ca3af', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
  padding: '14px', textAlign: 'center', flexShrink: 0,
}

const goHomeBtn = {
  background: '#7c3aed', border: 'none', borderRadius: '12px', color: '#fff',
  cursor: 'pointer', fontSize: '16px', fontWeight: '600', padding: '14px 32px',
}
