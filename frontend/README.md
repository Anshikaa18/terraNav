# TerraNav — Frontend

This directory contains the extracted frontend for the TerraNav interactive maps & navigation application, decoupled from the backend serverless functions and database files in `minor-project`.

---

## 📁 Directory Structure

```text
frontend/
├── static/                      # ⚡ Mode 1: Ready-to-run pure HTML, CSS & JS (No build required)
│   ├── index.html               # Main entry HTML
│   ├── css/
│   │   └── style.css            # Compiled Tailwind CSS + Leaflet styling
│   ├── js/
│   │   └── app.js               # Bundled modern ES module JavaScript
│   └── favicon.svg              # TerraNav icon
│
├── dist/                        # Standard Vite production build output
│   ├── index.html
│   ├── assets/
│   └── favicon.svg
│
├── src/                         # 🛠️ Mode 2: React + Vite source code
│   ├── components/              # Map, Search, Directions, Places, Layout UI components
│   ├── context/                 # AuthContext, MapContext, ThemeContext
│   ├── hooks/                   # useGeolocation, useDebounce, useLocalStorage
│   ├── pages/                   # Map, Search, Directions, Saved, History, Auth pages
│   ├── services/                # Axios API services
│   ├── styles/                  # Tailwind index.css
│   ├── utils/                   # Constants, Geo calculations
│   ├── App.jsx                  # Root App routes
│   └── main.jsx                 # React root bootstrap
│
├── public/                      # Static public assets (favicon.svg)
├── index.html                   # Vite development HTML entry
├── vite.config.js               # Vite config with backend proxy to port 3000
├── tailwind.config.js           # Tailwind CSS configuration
├── postcss.config.js            # PostCSS configuration
├── package.json                 # Decoupled frontend dependencies (no server/DB packages)
└── .env.example                 # Example environment variables
```

---

## 🚀 How to Run

### Option A: Static HTML/CSS/JS (Instant, No Node / Build Step)

You can serve the `static/` directory using any local web server:

**Using Python:**
```bash
cd static
python -m http.server 5000
```
Then open `http://localhost:5000` in your browser.

**Using Node / npx:**
```bash
npx serve static
```

**Using VS Code:**
Right-click `frontend/static/index.html` and select **"Open with Live Server"**.

---

### Option B: React + Vite Development Server (Full Source Workflow)

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```
   The app will run at `http://localhost:5173`.

3. **Backend Connection:**
   The Vite dev server is preconfigured in `vite.config.js` to automatically proxy all `/api/*` requests to the backend Express server running at `http://localhost:5000` (from `backend/`).

4. **Production Build:**
   ```bash
   npm run build
   ```
