# 🏗️ 3D Floor Plan Generator · Structural Intelligence

An interactive 3D floor plan analyser that converts architectural floor plan images (PNG) into real-time 3D scenes — complete with structural material recommendations, cost–strength tradeoff charts, and an AI-powered engineering chatbot.

**Tech Stack:** OpenCV · Three.js · Flask · Vite · Google Gemini

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **3D Rendering** | Real-time Three.js scene with walls, windows (glass + frames), and animated doors |
| **Room Detection** | OpenCV wall/opening detection pipeline with window and gate/door classification |
| **Structural Classification** | Automatically classifies walls as Load-Bearing, Partition, Slab, or Column |
| **Material Analysis** | Ranked material recommendations with cost, strength, and durability scores |
| **Radar Chart Comparison** | Hover or click any material card to see a live radar comparison chart |
| **Pros / Cons Panels** | Expandable per-material pros and cons with engineering rationale |
| **AI Chatbot (Gemini)** | Ask questions about any structural element — powered by Google Gemini 2.5 Flash |
| **Wall Coordinates** | Pixel and real-world (metres) coordinates shown for each selected wall |
| **Structural Concerns** | Auto-flagged issues shown in the overview panel |
| **Multi-Image Support** | Load any of the floor plan PNGs in the `backend/test/` folder |

---

## 📁 Project Structure

```
main/3DFloorGenerator/
│
├── backend/                        # Flask API server
│   ├── app.py                      # ★ Main app — all routes
│   ├── material_analysis.py        # Material tradeoff engine
│   ├── main.py                     # Structural wall classifier (OpenCV)
│   ├── turtle_test.py              # Wall geometry detection
│   ├── t.py                        # Window & gate/door detection
│   ├── door.py                     # Door detection helpers
│   └── test/                       # Floor plan images
│       ├── F1.png
│       ├── F2.png
│       ├── F3.png  ← default
│       ├── F4.png
│       └── image.png
│
└── frontend/                       # Vite + Three.js app
    ├── index.html                  # Entry HTML (Chart.js CDN included)
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.js                 # ★ App entry — scene + API orchestration
        │
        ├── config/
        │   └── constants.js        # API URLs, scale factors, camera/light config
        │
        ├── services/
        │   ├── floorPlanApi.js     # Wall / window / door geometry fetching
        │   └── materialApi.js      # ★ Material analysis + Gemini chat API calls
        │
        ├── ui/
        │   ├── StatusUI.js         # Status bar helpers
        │   ├── StructuralPanel.js  # ★ Overview + detail panel (DOM injection & logic)
        │   ├── MaterialCards.js    # ★ Material cards, pros/cons DB, radar chart popup
        │   └── ChatUI.js           # ★ AI chatbot UI (message bubbles + input)
        │
        ├── styles/
        │   ├── main.css            # Core app styles
        │   └── structural.css      # ★ All panel / card / chart / chat styles
        │
        ├── scene/                  # Three.js scene management
        │   ├── SceneManager.js
        │   ├── RendererManager.js
        │   ├── CameraManager.js
        │   ├── LightingManager.js
        │   └── Ground.js
        │
        ├── builders/               # 3D geometry builders
        │   ├── WallBuilder.js      # Wall segments with opening cutouts + type colours
        │   ├── WindowBuilder.js    # Glass + frame window geometry
        │   └── DoorBuilder.js      # Animated swing door
        │
        └── core/
            └── ResizeHandler.js    # Responsive canvas resize
```

> **★** = files added or significantly modified during the structural intelligence integration

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| pip packages | `flask flask-cors opencv-python numpy google-generativeai` |

---

### 1 — Clone / navigate to the project

```bash
cd main/3DFloorGenerator
```

---

### 2 — Configure your Gemini API key

Open `backend/app.py` and set your key:

```python
GEMINI_API_KEY = "YOUR_API_KEY_HERE"
```

Or export it as an environment variable (preferred):

```bash
# Windows PowerShell
$env:GEMINI_API_KEY = "YOUR_API_KEY_HERE"

# macOS / Linux
export GEMINI_API_KEY="YOUR_API_KEY_HERE"
```

Get a free key at [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

---

### 3 — Install Python dependencies

```bash
cd backend
pip install flask flask-cors opencv-python numpy google-generativeai
```

---

### 4 — Start the backend

```bash
# from backend/
python app.py
```

Backend starts at **http://127.0.0.1:5000**

---

### 5 — Install and start the frontend

```bash
cd ../frontend
npm install
npm run dev
```

Frontend starts at **http://localhost:5173** (or the next available port)

---

## 🌐 API Reference

All routes are served by the Flask backend on port **5000**.

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/images` | List all available floor plan PNGs |
| `GET` | `/api/data?image=F3.png` | Wall geometry, windows, and gates for 3D rendering |
| `GET` | `/api/material-analysis` | Full structural classification + material recommendations |
| `POST` | `/api/chat` | Gemini AI chat — body: `{ question, element }` |

---

## 🖱️ How to Use

1. **Select a floor plan** from the dropdown in the sidebar and click **⟳ Load**
2. The 3D scene renders automatically — walls are colour-coded by structural type:
   - 🟠 **Orange** — Load-Bearing Wall
   - 🟢 **Teal** — Partition Wall
   - 🟣 **Purple** — Slab
   - 🟡 **Yellow** — Column
3. **Click any wall** in the 3D viewport to open the Structural Intelligence panel
4. In the panel:
   - **Details tab** — view wall coordinates, scoring weights, and ranked material options
   - **Hover** a material card → radar chart popup appears
   - **Click** a material card → expands pros/cons list and pins the chart
   - **Ask AI tab** — type any engineering question about the selected element
5. Use the **Overview panel** (right side) to:
   - See summary stats (total elements, load-bearing count, etc.)
   - Browse the full element list and click to highlight in 3D
   - Check the ⚠ Issues tab for flagged structural concerns
6. **Click a door** in the 3D viewport to open/close it with animation

---

## 🎨 Colour Palette Reference

```
Accent (yellow-green) : #e8ff47
Load-Bearing Wall     : #ff6b35
Partition Wall        : #00d4aa
Slab                  : #bf5af2
Column                : #ffd60a
Window (glass)        : #00aaff
Door / Gate           : #8b4513
Background            : #07080d
Panel background      : #0b0d14
```

---

## 🧩 Module Responsibilities (New Files)

### `src/services/materialApi.js`
Single source of truth for all AI-related HTTP calls:
- `fetchMaterialAnalysis()` — calls `/api/material-analysis`, returns enriched analysis JSON
- `sendChatMessage(question, element)` — calls `/api/chat`, returns Gemini answer string

### `src/ui/StructuralPanel.js`
Injects and manages the two right-side panels:
- `initStructuralUI()` — creates overview + detail panel DOM (call once at startup)
- `openPanel(el)` — populates and slides in the detail panel for an element
- `closePanel()` — hides detail panel, reveals overview
- `renderOverview(result, onSelectEl)` — fills summary stats, element list, concerns

### `src/ui/MaterialCards.js`
Everything related to material option cards:
- `renderDetails(el)` — builds card HTML including coordinates, weight chips, material options
- `bindMatCards(recs)` — wires hover (radar popup) and click (pros/cons expand) events
- `MATERIAL_PROS_CONS` — built-in database for 8 material types
- `getProsCons(name)` — lookup with fuzzy matching

### `src/ui/ChatUI.js`
Chatbot UI logic:
- `setChatElement(el)` — sets context and seeds the greeting message
- `appendMsg(role, text)` — renders a chat bubble (user or AI)
- `sendChat()` — reads input, calls API, renders streamed response
- `initChatInputHandlers()` — wires Enter key + send button

### `src/styles/structural.css`
Self-contained CSS for all structural panel features — can be added/removed without touching `main.css`.

---

## ⚙️ Configuration

All API endpoints and scene constants live in `src/config/constants.js`:

```js
export const API_URL          = 'http://127.0.0.1:5000/api/data';
export const MATERIAL_API_URL = 'http://127.0.0.1:5000/api/material-analysis';
export const CHAT_API_URL     = 'http://127.0.0.1:5000/api/chat';

export const SCALE        = 0.2;   // pixel → world-unit scale factor
export const WALL_HEIGHT  = 12;    // world units
export const WALL_THICKNESS = 1.2; // world units
```

---

## 🔧 Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Backend failed — is Flask running?` | Start `python app.py` in `backend/` |
| `Gemini Error: Invalid API key` | Set `GEMINI_API_KEY` correctly in `app.py` or env |
| No walls appear | Check the `test/` folder has PNG files; verify `/api/data` returns 200 |
| Material panel shows no data | `/api/material-analysis` failed — check the backend terminal for traceback |
| Chart popup doesn't show | Ensure the Chart.js CDN `<script>` loaded (check browser console) |
| Windows / doors missing | Backend image path resolution — verify `?image=F3.png` query param |

---

## 📦 Dependencies

### Backend
| Package | Purpose |
|---------|---------|
| `flask` | Web server |
| `flask-cors` | Cross-origin requests from the Vite dev server |
| `opencv-python` | Wall, window, door detection from PNG |
| `numpy` | Image processing |
| `google-generativeai` | Gemini 2.5 Flash AI chatbot |

### Frontend
| Package | Purpose |
|---------|---------|
| `three` (`^0.160.0`) | 3D rendering engine |
| `vite` (`^5.0.0`) | Dev server + bundler |
| `chart.js` (`4.4.3`) | Radar chart for material comparison (CDN) |

---

## 📄 License

MIT — free to use, modify, and distribute.
