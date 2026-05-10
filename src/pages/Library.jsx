import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Library() {
  const navigate = useNavigate()
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal, setRenameVal] = useState('')

  useEffect(() => { loadFolders() }, [])

  async function loadFolders() {
    const { data } = await supabase.from('folders').select('*').order('name')
    setFolders(data || [])
    setLoading(false)
  }

  async function createFolder() {
    if (!newName.trim()) return
    setCreating(true)
    await supabase.from('folders').insert({ name: newName.trim() })
    setNewName('')
    setCreating(false)
    loadFolders()
  }

  async function renameFolder(id) {
    if (!renameVal.trim()) return
    await supabase.from('folders').update({ name: renameVal.trim() }).eq('id', id)
    setRenamingId(null)
    loadFolders()
  }

  async function deleteFolder(id) {
    if (!confirm('Delete this folder and all its songs?')) return
    await supabase.from('folders').delete().eq('id', id)
    loadFolders()
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <button onClick={() => navigate('/')} style={backBtn}>← Home</button>
          <h1 style={titleStyle}>Library</h1>
        </div>

        <div style={cardStyle}>
          <h2 style={subheadStyle}>New Band / Folder</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Folder name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFolder()}
              style={inputStyle}
            />
            <button onClick={createFolder} disabled={creating} style={primaryBtn}>
              {creating ? '...' : 'Create'}
            </button>
          </div>
        </div>

        {loading ? (
          <p style={mutedText}>Loading...</p>
        ) : folders.length === 0 ? (
          <p style={mutedText}>No folders yet. Create one above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {folders.map(folder => (
              <div key={folder.id} style={folderRow}>
                {renamingId === folder.id ? (
                  <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                    <input
                      autoFocus
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameFolder(folder.id)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button onClick={() => renameFolder(folder.id)} style={primaryBtn}>Save</button>
                    <button onClick={() => setRenamingId(null)} style={ghostBtn}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => navigate(`/library/${folder.id}`)}
                      style={folderNameBtn}
                    >
                      <span style={{ fontSize: '20px' }}>📁</span>
                      {folder.name}
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => { setRenamingId(folder.id); setRenameVal(folder.name) }}
                        style={iconBtn}
                        title="Rename"
                      >✏️</button>
                      <button
                        onClick={() => deleteFolder(folder.id)}
                        style={iconBtn}
                        title="Delete"
                      >🗑️</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const pageStyle = { backgroundColor: '#0a0a0f', minHeight: '100dvh', padding: '24px 16px' }
const containerStyle = { maxWidth: '640px', margin: '0 auto' }
const headerStyle = { marginBottom: '24px' }
const titleStyle = { color: '#f3f4f6', fontSize: '28px', fontWeight: '800', margin: '8px 0 0' }
const subheadStyle = { color: '#f3f4f6', fontSize: '16px', fontWeight: '600', margin: '0 0 12px' }
const backBtn = { background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer', padding: '0' }
const mutedText = { color: '#6b7280', fontSize: '15px' }
const cardStyle = { background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '20px', marginBottom: '20px' }
const inputStyle = { background: '#0a0a0f', border: '1px solid #2a2a3a', borderRadius: '10px', color: '#f3f4f6', fontSize: '16px', padding: '12px 14px', outline: 'none', flex: 1, minWidth: 0 }
const primaryBtn = { background: '#7c3aed', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: '600', padding: '12px 18px', whiteSpace: 'nowrap' }
const ghostBtn = { background: 'transparent', border: '1px solid #2a2a3a', borderRadius: '10px', color: '#9ca3af', cursor: 'pointer', fontSize: '15px', padding: '12px 14px' }
const iconBtn = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '8px', borderRadius: '8px' }
const folderRow = { display: 'flex', alignItems: 'center', gap: '8px', background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: '14px', padding: '12px 16px' }
const folderNameBtn = { background: 'none', border: 'none', color: '#f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px', fontWeight: '500', flex: 1, textAlign: 'left', padding: 0 }
