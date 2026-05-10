import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, getChartUrl } from '../lib/supabase'

export default function FolderView() {
  const { folderId } = useParams()
  const navigate = useNavigate()
  const [folder, setFolder] = useState(null)
  const [songs, setSongs] = useState([])
  const [setlists, setSetlists] = useState([])
  const [tab, setTab] = useState('songs') // 'songs' | 'setlists'
  const [uploading, setUploading] = useState(false)
  const [newSetlistName, setNewSetlistName] = useState('')
  const [selectedSetlist, setSelectedSetlist] = useState(null)
  const [setlistSongs, setSetlistSongs] = useState([])
  const fileRef = useRef()

  useEffect(() => {
    loadFolder()
    loadSongs()
    loadSetlists()
  }, [folderId])

  async function loadFolder() {
    const { data } = await supabase.from('folders').select('*').eq('id', folderId).single()
    setFolder(data)
  }

  async function loadSongs() {
    const { data } = await supabase.from('songs').select('*').eq('folder_id', folderId).order('name')
    setSongs(data || [])
  }

  async function loadSetlists() {
    const { data } = await supabase.from('setlists').select('*').eq('folder_id', folderId).order('name')
    setSetlists(data || [])
  }

  async function loadSetlistSongs(setlistId) {
    const { data } = await supabase
      .from('setlist_songs')
      .select('*, songs(*)')
      .eq('setlist_id', setlistId)
      .order('order')
    setSetlistSongs(data || [])
  }

  async function uploadSong(e) {
    const file = e.target.files[0]
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    const fileType = ext === 'pdf' ? 'pdf' : 'image'
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${folderId}/${Date.now()}_${safeName}`

    setUploading(true)
    const { error: upErr } = await supabase.storage.from('charts').upload(filePath, file)
    if (!upErr) {
      await supabase.from('songs').insert({
        folder_id: folderId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        file_path: filePath,
        file_type: fileType,
      })
      loadSongs()
    }
    setUploading(false)
    e.target.value = ''
  }

  async function deleteSong(song) {
    if (!confirm(`Delete "${song.name}"?`)) return
    await supabase.storage.from('charts').remove([song.file_path])
    await supabase.from('songs').delete().eq('id', song.id)
    loadSongs()
  }

  async function createSetlist() {
    if (!newSetlistName.trim()) return
    const { data } = await supabase.from('setlists').insert({
      name: newSetlistName.trim(),
      folder_id: folderId,
    }).select().single()
    setNewSetlistName('')
    loadSetlists()
    if (data) { setSelectedSetlist(data); loadSetlistSongs(data.id) }
  }

  async function deleteSetlist(id) {
    if (!confirm('Delete this setlist?')) return
    await supabase.from('setlists').delete().eq('id', id)
    if (selectedSetlist?.id === id) setSelectedSetlist(null)
    loadSetlists()
  }

  async function addSongToSetlist(songId) {
    const maxOrder = setlistSongs.reduce((m, s) => Math.max(m, s.order), 0)
    await supabase.from('setlist_songs').insert({
      setlist_id: selectedSetlist.id,
      song_id: songId,
      order: maxOrder + 1,
    })
    loadSetlistSongs(selectedSetlist.id)
  }

  async function removeSongFromSetlist(id) {
    await supabase.from('setlist_songs').delete().eq('id', id)
    loadSetlistSongs(selectedSetlist.id)
  }

  async function moveSong(idx, dir) {
    const newList = [...setlistSongs]
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= newList.length) return
    const a = newList[idx], b = newList[swapIdx]
    await supabase.from('setlist_songs').update({ order: b.order }).eq('id', a.id)
    await supabase.from('setlist_songs').update({ order: a.order }).eq('id', b.id)
    loadSetlistSongs(selectedSetlist.id)
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={{ marginBottom: '24px' }}>
          <button onClick={() => navigate('/library')} style={backBtn}>← Library</button>
          <h1 style={titleStyle}>{folder?.name || '...'}</h1>
        </div>

        <div style={tabBar}>
          <button onClick={() => setTab('songs')} style={tab === 'songs' ? activeTab : inactiveTab}>Songs</button>
          <button onClick={() => setTab('setlists')} style={tab === 'setlists' ? activeTab : inactiveTab}>Setlists</button>
        </div>

        {tab === 'songs' && (
          <div>
            <button
              onClick={() => fileRef.current.click()}
              disabled={uploading}
              style={{ ...primaryBtn, width: '100%', marginBottom: '16px', padding: '16px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {uploading ? 'Uploading...' : '+ Upload Song (PDF or Image)'}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadSong} style={{ display: 'none' }} />

            {songs.length === 0 ? (
              <p style={mutedText}>No songs yet. Upload one above.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {songs.map(song => (
                  <div key={song.id} style={songRow}>
                    <span style={{ fontSize: '18px' }}>{song.file_type === 'pdf' ? '📄' : '🖼️'}</span>
                    <span style={{ flex: 1, color: '#f3f4f6', fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.name}</span>
                    <a
                      href={getChartUrl(song.file_path)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...iconBtn, textDecoration: 'none' }}
                    >👁️</a>
                    <button onClick={() => deleteSong(song)} style={iconBtn}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'setlists' && (
          <div>
            <div style={cardStyle}>
              <h2 style={subheadStyle}>New Setlist</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Setlist name"
                  value={newSetlistName}
                  onChange={e => setNewSetlistName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createSetlist()}
                  style={inputStyle}
                />
                <button onClick={createSetlist} style={primaryBtn}>Create</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {setlists.map(sl => (
                <button
                  key={sl.id}
                  onClick={() => { setSelectedSetlist(sl); loadSetlistSongs(sl.id) }}
                  style={{
                    ...songRow,
                    cursor: 'pointer',
                    border: selectedSetlist?.id === sl.id ? '1px solid #7c3aed' : '1px solid #2a2a3a',
                    background: selectedSetlist?.id === sl.id ? '#1e1230' : '#1a1a24',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>📋</span>
                  <span style={{ flex: 1, color: '#f3f4f6', fontSize: '15px' }}>{sl.name}</span>
                  <span
                    onClick={e => { e.stopPropagation(); deleteSetlist(sl.id) }}
                    style={{ ...iconBtn, cursor: 'pointer' }}
                  >🗑️</span>
                </button>
              ))}
            </div>

            {selectedSetlist && (
              <div>
                <h3 style={{ color: '#f3f4f6', fontSize: '18px', margin: '0 0 12px' }}>{selectedSetlist.name}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                  {setlistSongs.length === 0 && <p style={mutedText}>No songs in this setlist yet.</p>}
                  {setlistSongs.map((ss, idx) => (
                    <div key={ss.id} style={{ ...songRow, gap: '6px' }}>
                      <span style={{ color: '#6b7280', fontSize: '13px', width: '24px', textAlign: 'center' }}>{idx + 1}</span>
                      <span style={{ flex: 1, color: '#f3f4f6', fontSize: '15px' }}>{ss.songs?.name}</span>
                      <button onClick={() => moveSong(idx, -1)} disabled={idx === 0} style={iconBtn}>↑</button>
                      <button onClick={() => moveSong(idx, 1)} disabled={idx === setlistSongs.length - 1} style={iconBtn}>↓</button>
                      <button onClick={() => removeSongFromSetlist(ss.id)} style={iconBtn}>✕</button>
                    </div>
                  ))}
                </div>

                <h4 style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Add songs</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {songs.filter(s => !setlistSongs.some(ss => ss.song_id === s.id)).map(s => (
                    <button key={s.id} onClick={() => addSongToSetlist(s.id)} style={{ ...songRow, cursor: 'pointer', textAlign: 'left' }}>
                      <span>+</span>
                      <span style={{ flex: 1, color: '#f3f4f6', fontSize: '15px' }}>{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const pageStyle = { backgroundColor: '#0a0a0f', minHeight: '100dvh', padding: '24px 16px' }
const containerStyle = { maxWidth: '640px', margin: '0 auto' }
const titleStyle = { color: '#f3f4f6', fontSize: '28px', fontWeight: '800', margin: '8px 0 0' }
const subheadStyle = { color: '#f3f4f6', fontSize: '16px', fontWeight: '600', margin: '0 0 12px' }
const backBtn = { background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer', padding: '0' }
const mutedText = { color: '#6b7280', fontSize: '15px' }
const cardStyle = { background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '20px', marginBottom: '16px' }
const inputStyle = { background: '#0a0a0f', border: '1px solid #2a2a3a', borderRadius: '10px', color: '#f3f4f6', fontSize: '16px', padding: '12px 14px', outline: 'none', flex: 1, minWidth: 0 }
const primaryBtn = { background: '#7c3aed', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: '600', padding: '12px 18px', whiteSpace: 'nowrap' }
const iconBtn = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '6px', borderRadius: '8px', color: '#9ca3af' }
const songRow = { display: 'flex', alignItems: 'center', gap: '10px', background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '12px 14px' }
const tabBar = { display: 'flex', gap: '4px', background: '#1a1a24', borderRadius: '12px', padding: '4px', marginBottom: '20px' }
const activeTab = { flex: 1, background: '#7c3aed', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: '600', padding: '10px' }
const inactiveTab = { flex: 1, background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '15px', padding: '10px' }
