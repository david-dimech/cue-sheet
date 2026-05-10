import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SongPicker({ session, currentSongId, onPick, isSlideUp = false }) {
  const [allSongs, setAllSongs] = useState([])
  const [setlistSongs, setSetlistSongs] = useState([])
  const [browseAll, setBrowseAll] = useState(!session?.setlist_id)

  useEffect(() => {
    loadSongs()
    if (session?.setlist_id) loadSetlistSongs()
  }, [session?.id])

  async function loadSongs() {
    const { data } = await supabase
      .from('songs')
      .select('*')
      .eq('folder_id', session.folder_id)
      .order('name')
    setAllSongs(data || [])
  }

  async function loadSetlistSongs() {
    const { data } = await supabase
      .from('setlist_songs')
      .select('*, songs(*)')
      .eq('setlist_id', session.setlist_id)
      .order('order')
    setSetlistSongs(data || [])
  }

  const displaySongs = browseAll ? allSongs : setlistSongs.map(ss => ss.songs)

  return (
    <div style={isSlideUp ? slideUpStyle : pickerStyle}>
      {session?.setlist_id && (
        <div style={tabRow}>
          <button
            onClick={() => setBrowseAll(false)}
            style={!browseAll ? activeTab : inactiveTab}
          >Setlist</button>
          <button
            onClick={() => setBrowseAll(true)}
            style={browseAll ? activeTab : inactiveTab}
          >Browse All</button>
        </div>
      )}

      <div style={listStyle}>
        {displaySongs.map((song, idx) => {
          if (!song) return null
          const active = song.id === currentSongId
          return (
            <button
              key={song.id}
              onClick={() => onPick(song)}
              style={{
                ...songBtn,
                background: active ? '#1e1230' : '#1a1a24',
                border: active ? '1px solid #7c3aed' : '1px solid #2a2a3a',
              }}
            >
              {!browseAll && session?.setlist_id && (
                <span style={{ color: '#6b7280', fontSize: '13px', width: '24px', flexShrink: 0 }}>{idx + 1}</span>
              )}
              <span style={{ fontSize: '16px' }}>{song.file_type === 'pdf' ? '📄' : '🖼️'}</span>
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {song.name}
              </span>
              {active && <span style={{ color: '#a855f7', fontSize: '12px', flexShrink: 0 }}>LIVE</span>}
            </button>
          )
        })}
        {displaySongs.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>No songs found</p>
        )}
      </div>
    </div>
  )
}

const pickerStyle = {
  display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
}

const slideUpStyle = {
  display: 'flex', flexDirection: 'column',
  background: '#0a0a0f', borderTop: '1px solid #2a2a3a',
  maxHeight: '55vh', overflow: 'hidden',
}

const tabRow = {
  display: 'flex', gap: '4px', padding: '12px 12px 0',
  background: 'inherit',
}

const listStyle = {
  flex: 1, overflow: 'auto', padding: '12px',
  display: 'flex', flexDirection: 'column', gap: '6px',
}

const songBtn = {
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '14px 16px', borderRadius: '12px',
  color: '#f3f4f6', cursor: 'pointer', fontSize: '15px',
  width: '100%', textAlign: 'left',
}

const activeTab = {
  flex: 1, background: '#7c3aed', border: 'none', borderRadius: '8px',
  color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: '8px',
}

const inactiveTab = {
  flex: 1, background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: '8px',
  color: '#6b7280', cursor: 'pointer', fontSize: '14px', padding: '8px',
}
