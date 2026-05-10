import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Library from './pages/Library'
import FolderView from './pages/FolderView'
import LeaderView from './pages/LeaderView'
import MusicianView from './pages/MusicianView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/library" element={<Library />} />
        <Route path="/library/:folderId" element={<FolderView />} />
        <Route path="/session/:code/leader" element={<LeaderView />} />
        <Route path="/session/:code/musician" element={<MusicianView />} />
      </Routes>
    </BrowserRouter>
  )
}
