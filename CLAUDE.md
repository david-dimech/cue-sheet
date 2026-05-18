# Cue Sheet — Real-time Chord Chart Sync

Band leaders push chord charts to musicians' screens live during a gig. Members join via a 6-character session code. No authentication — fully open access.

## Tech Stack

- **React 19** + **Vite 8** (ES modules)
- **Tailwind CSS v4** — CSS-based config via `@import "tailwindcss"` in `src/index.css`. No `tailwind.config.js`. No `npx tailwindcss init`.
- **Supabase** — database, storage, realtime
- **React Router v7**
- **PDF.js (pdfjs-dist v5)** — dynamically imported in `ChartViewer.jsx`

## Environment Variables

Stored in `.env.local` (not committed). See `.env.example`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Dev Server

```bash
npm run dev        # localhost only
```

`vite.config.js` has `server: { host: true }` so the app is reachable on the local network (e.g. from a phone on the same Wi-Fi). Vite prints the network IP on startup.

```bash
npm run build      # production build to dist/
```

## Project Structure

```
src/
  App.jsx                     # Router — all routes defined here
  main.jsx                    # React root mount
  index.css                   # Tailwind v4 import + global resets
  lib/
    supabase.js               # Supabase client + getChartUrl(filePath)
    utils.js                  # generateCode(), cn()
  pages/
    Home.jsx                  # / — Start Session or Join Session
    Library.jsx               # /library — folder list + CRUD
    FolderView.jsx            # /library/:folderId — songs + setlists
    LeaderView.jsx            # /session/:code/leader
    MusicianView.jsx          # /session/:code/musician?name=X
  components/
    ChartViewer.jsx           # PDF multi-page renderer + image viewer
    SongPicker.jsx            # Setlist / browse-all song list
supabase-schema.sql           # Full DB init: tables, RLS, realtime, storage
```

## Routes

| Path | Component | Notes |
|------|-----------|-------|
| `/` | `Home` | Mode select: start or join |
| `/library` | `Library` | All folders |
| `/library/:folderId` | `FolderView` | Songs tab + Setlists tab |
| `/session/:code/leader` | `LeaderView` | Split panel: chart + picker |
| `/session/:code/musician` | `MusicianView` | Full-screen chart; `?name=` query param |

## Database Schema (Supabase)

| Table | Key columns |
|-------|-------------|
| `folders` | `id`, `name` |
| `songs` | `id`, `folder_id`, `name`, `file_path`, `file_type` (`pdf`\|`image`) |
| `setlists` | `id`, `folder_id`, `name` |
| `setlist_songs` | `id`, `setlist_id`, `song_id`, `order` |
| `sessions` | `id`, `code` (6-char unique), `folder_id`, `setlist_id`, `current_song_id` |
| `participants` | `id`, `session_id`, `display_name`, `has_control`, `joined_at` |

RLS is enabled on all tables with open `public_all_*` policies (no auth required).

Realtime is enabled on `sessions` and `participants` via `supabase_realtime` publication.

## Storage

One bucket: `charts` (public). Files stored at `{folderId}/{timestamp}_{filename}`.  
`getChartUrl(filePath)` in `src/lib/supabase.js` returns the public URL.

## Realtime Architecture

- **LeaderView** subscribes to `sessions` (song changes) and `participants` (control delegation) for its session.
- **MusicianView** subscribes to `sessions` (current song updates) and `participants` (its own row for `has_control` changes). Session DELETE triggers a "Session ended" screen.
- Both use `supabase.channel()` with `postgres_changes` filters and clean up with `supabase.removeChannel()` on unmount.

## Key Behaviours

- **Session code**: 6-char alphanumeric (no ambiguous chars like 0/O/1/I), generated in `utils.js`, collision-checked against DB before insert.
- **Control delegation**: Leader taps a participant in the panel → toggles `has_control`. Musician's `SongPicker` slide-up appears/disappears instantly via realtime.
- **PDF rendering**: `ChartViewer` dynamically imports `pdfjs-dist`, sets the worker URL via `import.meta.url`, scales pages to container width.
- **Styling**: All styles are inline JS objects (no Tailwind utility classes in JSX). Tailwind v4 is only used for the global reset/body defaults in `index.css`.

## Git Branches

- `master` — stable, merged from dev after build verification
- `dev` — active development (default working branch)

## Database Setup

Run `supabase-schema.sql` in the Supabase SQL editor for a fresh project. It creates all tables, indexes, RLS policies, enables realtime, and creates the `charts` storage bucket.
