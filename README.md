# 🎵 SONORA — Premium Personal Music Streaming Platform

SONORA is a production-ready, full-stack personal music streaming platform built with **React**, **TypeScript**, **Tailwind CSS**, **Node.js/Express**, **Supabase PostgreSQL**, and **Cloudinary** for studio-grade audio delivery.

Inspired by Spotify and Apple Music, SONORA delivers a cinematic dark UI, persistent HTML5 audio streaming that never interrupts during navigation, playlist management, listening history, smart recommendations, instant multi-category search, and a protected Curator Admin Studio with Cloudinary audio uploads.

---

## 🌟 Key Features

### 🎧 Audio Playback & Streaming Engine
- **Persistent Global Player**: HTML5 Audio streaming with unbroken playback across client-side page routing.
- **Cloudinary Audio Integration**: Streams audio using Cloudinary's `video` resource type with HTTP range seeking support.
- **Waveform Progress Bar**: Smooth seek slider with current time and total track duration.
- **Full Playback Controls**: Play, pause, skip forward, skip backward (or restart if >3s in), shuffle, repeat (off, all, one), volume slider with mute toggle, and playback speed control (0.75x, 1x, 1.25x, 1.5x, 2x).
- **Play Queue Drawer**: Slide-over drawer displaying now-playing track and upcoming queue with reorder, remove, and clear capabilities.
- **Expanded Now-Playing Screen**: Fullscreen cinematic overlay featuring album artwork, animated equalizer bars, and comprehensive controls.
- **Keyboard Shortcuts**:
  - `Space`: Play / Pause
  - `ArrowLeft` / `ArrowRight`: Seek -5s / +5s
  - `ArrowUp` / `ArrowDown`: Volume +10% / -10%
  - `M`: Toggle Mute
  - `L`: Toggle Like / Favorite
  - `N`: Next Song
  - `P`: Previous Song
  - `S`: Toggle Shuffle

### 📚 Music Catalogue & Discovery
- **Home**: Dynamic time-based greeting, featured soundscape banner, 6-tile quick access shelf, trending songs with play count metrics, featured albums, and recommended songs based on listening history.
- **Explore**: Vibrant genre explorer cards (Synthwave, Neo-Soul, Cyberpunk, Indie Folk, Deep House, Electronic, Ambient, Lo-Fi Chill) with real-time genre filtering.
- **Search**: Global instant search across songs, artists, albums, and playlists with tabbed categories and recent search history.
- **Library**: Unified personal hub with quick access to playlists, liked songs, albums, and artists.
- **Playlists**: Complete CRUD for playlists, custom cover art, track reordering, and track removal.
- **Albums & Artists**: Rich discography, verified artist profiles with monthly listener statistics and bios.
- **Favourites & Recently Played**: Liked songs shelf with shuffle play and timestamped playback journal.

### 🛡️ Curator Studio (Admin Dashboard)
- **Role-Based Authorization**: Protected routes with admin privilege enforcement.
- **Cloudinary Direct Upload Studio**:
  - Audio file upload (MP3, WAV, FLAC, M4A, OGG) with automatic client-side duration detection.
  - Cover artwork upload (JPG, PNG, WEBP) with instant preview.
  - Metadata editor: Title, Artist, Album, Genre, Release Year, and Featured / Trending collection toggles.
  - Live upload progress bar (% and status indicators).
- **Catalogue Management**: Searchable and filterable table to edit metadata or delete songs.
- **Album & Artist Managers**: Create and manage artist profiles and album records.
- **Storage & System Metrics**: Real-time stats on total tracks, artists, albums, and total stream plays.

---

## 🏗️ Architecture & Tech Stack

```
sonora/
├── client/                     # Frontend (React 19, TypeScript, Vite, Tailwind CSS)
│   ├── src/
│   │   ├── components/         # Player, Sidebar, Header, SongRow, SongCard, QueueDrawer...
│   │   ├── context/            # AudioPlayerContext, AuthContext, FavoritesContext, ToastContext...
│   │   ├── views/              # HomeView, ExploreView, SearchView, AdminDashboardView...
│   │   ├── services/           # REST API client
│   │   └── types/              # Domain models
├── server/                     # Backend (Node.js, Express, TypeScript)
│   ├── src/
│   │   ├── config/             # Supabase & Cloudinary configurations
│   │   ├── controllers/        # Song, Album, Artist, Playlist, Upload, and User controllers
│   │   ├── middleware/         # Supabase JWT auth & admin role verification
│   │   ├── data/               # Seed data & unified DataStore repository
│   │   └── routes/             # REST API endpoints
└── supabase/
    └── migrations/             # Production PostgreSQL schema, triggers & RLS policies
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ (tested on Node v24)
- npm 9+

### 2. Installation

Clone or open the repository:
```bash
cd sonora
```

Install backend dependencies:
```bash
cd server
npm install
cp .env.example .env
```

Install frontend dependencies:
```bash
cd ../client
npm install
cp .env.example .env
```

### 3. Running the Development Servers

**Terminal 1 — Backend API Server (Port 5000):**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend Client (Port 5173):**
```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser.

> [!NOTE]
> SONORA features an intelligent hybrid data layer. Out-of-the-box, it operates with rich, high-fidelity royalty-free tracks hosted on public CDNs with real audio playback. Once you add your Supabase and Cloudinary keys to `server/.env`, it seamlessly switches to live cloud storage and PostgreSQL.

---

## 🗄️ Supabase Database Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Open `supabase/migrations/20261101_initial_schema.sql` from this repository.
4. Paste and execute the SQL query. This creates:
   - `profiles` (with automatic trigger on `auth.users`)
   - `songs` (with Cloudinary audio URL and public ID)
   - `artists`
   - `albums`
   - `playlists` & `playlist_songs` (with ordering)
   - `favourites`
   - `listening_history`
   - Row Level Security (RLS) policies and performance indexes.
5. In **Project Settings** -> **API**, copy your:
   - `Project URL`
   - `anon public` key
   - `service_role` secret key

---

## ☁️ Cloudinary Setup

1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. Go to your Cloudinary Dashboard and retrieve:
   - `Cloud Name`
   - `API Key`
   - `API Secret`
3. Add these credentials to `server/.env`.
4. Audio files are uploaded with `resource_type: 'video'`, which enables Cloudinary's streaming CDN and HTTP range requests.

---

## ⚙️ Environment Variables

### Server (`server/.env`):
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Supabase Credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudinary Storage Credentials
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Client (`client/.env`):
```env
# Optional: Set full URL for production backend (empty string proxies /api to server in dev)
VITE_API_URL=
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
```

---

## 📡 REST API Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/songs` | List songs (supports `?genre=`, `?search=`, `?sort=`, `?featured=`) | Public |
| `GET` | `/api/songs/:id` | Get single song metadata | Public |
| `POST` | `/api/songs` | Create new song record | Admin |
| `PUT` | `/api/songs/:id` | Update song metadata | Admin |
| `DELETE`| `/api/songs/:id` | Delete song record | Admin |
| `POST` | `/api/songs/:id/play` | Increment play count | Public |
| `GET` | `/api/albums` | List albums | Public |
| `GET` | `/api/albums/:id` | Get album and tracklist | Public |
| `POST` | `/api/albums` | Create album | Admin |
| `GET` | `/api/artists` | List artists | Public |
| `GET` | `/api/artists/:id` | Get artist discography and top tracks | Public |
| `POST` | `/api/artists` | Create artist | Admin |
| `GET` | `/api/playlists` | Get public and user playlists | Authenticated |
| `GET` | `/api/playlists/:id` | Get playlist details and tracks | Authenticated |
| `POST` | `/api/playlists` | Create playlist | Authenticated |
| `PUT` | `/api/playlists/:id` | Update playlist metadata | Authenticated |
| `DELETE`| `/api/playlists/:id` | Delete playlist | Authenticated |
| `POST` | `/api/playlists/:id/songs` | Add song to playlist | Authenticated |
| `DELETE`| `/api/playlists/:id/songs/:songId` | Remove song from playlist | Authenticated |
| `PUT` | `/api/playlists/:id/reorder` | Reorder playlist tracks | Authenticated |
| `GET` | `/api/users/favorites` | Get user liked songs | Authenticated |
| `POST` | `/api/users/favorites` | Toggle favorite song | Authenticated |
| `GET` | `/api/users/history` | Get listening history | Authenticated |
| `POST` | `/api/users/history` | Record played track | Authenticated |
| `GET` | `/api/users/recommendations`| Personalized song recommendations | Authenticated |
| `POST` | `/api/upload/file` | Multipart file upload to Cloudinary (audio & cover) | Admin |
| `GET` | `/api/upload/signature` | Server-signed upload parameters for direct client upload | Admin |
| `GET` | `/api/admin/stats` | Curator platform and storage statistics | Admin |

---

## 🚢 Production Deployment

### 1. Database (Supabase)
Run the SQL migration in `supabase/migrations/20261101_initial_schema.sql` on your Supabase project.

### 2. Backend (Render / Railway / Fly.io)
1. Push your repository to GitHub.
2. In Render or Railway, create a new **Web Service** pointing to the `server/` directory.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Set environment variables:
   - `PORT=5000`
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://your-sonora-frontend.vercel.app`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### 3. Frontend (Vercel)
1. Import your GitHub repository into Vercel.
2. Set Root Directory to `client`.
3. Framework Preset: **Vite**.
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Set Environment Variables:
   - `VITE_API_URL=https://your-sonora-backend.onrender.com/api`
   - `VITE_SUPABASE_URL=https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=your-anon-key`
   - `VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name`
7. Click **Deploy**.

---

## 📄 License
Licensed under the MIT License.
