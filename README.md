# COCK & KEYS 🐓🔑

> **A real-time, first-person 3D multiplayer browser indie game.**
> 
> *Hunt unpredictable roosters, recover stolen keys, suffer dramatic amnesia, decipher observable landmark riddles, escape unarmed, and watch your Red Meter!*

---

## 🎮 Game Premise & Rules

1. **Match Start (2–4 Players):**
   - Each player spawns in the town disguised as an ordinary town resident (**Pedestrian**, **Waiter**, **Doctor**, or **Lawyer**).
   - Your assigned house is known at the start.
   - 8 roosters have stolen the town's keys and are running loose through the streets and alleys.

2. **The Rooster Hunt:**
   - 8 Roosters carry 8 Keys: **4 Genuine Keys** and **4 Decoy Keys**.
   - Knock out a rooster with melee attacks to make it drop its key.
   - **Decoy Key:** Collect it and keep hunting. No memory loss or collapse.
   - **Genuine Key Sequence:**
     - **Collapse:** Immediate electric collapse and knockout.
     - **Drop Inventory:** All weapons and gadgets drop onto the pavement at your collapse location for others to loot.
     - **Memory Loss:** You wake up with amnesia—you no longer remember which house is yours!
     - **Observable Riddle:** You receive a cryptic riddle based strictly on observable 3D landmarks in the town (e.g. Clocktower shadow, Ancient Oak tree, Marble Fountain, Bronze Rooster Monument).
     - **Subtle Smile:** A subtle smile appears on your character's face.
     - **Unarmed Escape:** You are stripped of weapons and cannot attack. Blend in with town NPCs, navigate to your assigned house, and unlock the front door with your genuine key.

3. **Red Meter (Permanent Violence Reputation):**
   - Every wrongful NPC kill adds **+1 Red Meter point** permanently.
   - **Meter 1–4 (Suspicion):** NPCs stare and react negatively.
   - **Meter 5–6 (Faction Retaliation):** NPCs belonging to the specific faction you attacked will retaliate and attack you on sight.
   - **Meter 7 (Universal Hostility):** All town NPCs hunt you down on sight.
   - **Meter 8 (Immediate Game Over):** Disqualification and instant loss.

---

## 🛠️ Tech Stack & Architecture

- **Client:** Three.js, TypeScript, Vite.
- **Server:** Node.js v24 authoritative server, persistent WebSockets (`ws`), 20Hz tick simulation.
- **Physics & Collisions:** AABB bounding box colliders against buildings, landmarks, and town walls.
- **Audio:** Web Audio API sound generator (Zero external audio file downloads to preserve mobile data).
- **Testing:** Node.js built-in native test runner (`node --test`).
- **Cost:** ₹0 — Completely free open-source tools and zero-cost hosting.

---

## 🚀 Quickstart & Development

### Prerequisites
- Node.js (v20+ or v24+)
- `pnpm` (Corepack enabled: `corepack enable`)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run the Authoritative Server + Web Client (Unified)
```bash
# Build the client bundle
pnpm run build:client

# Start the authoritative server (runs on port 3000)
pnpm run server
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

### 3. Or Run with Vite Dev Server
```bash
# Terminal 1: Start server
pnpm run server

# Terminal 2: Start Vite client dev server
pnpm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### 4. Run Automated Tests
```bash
pnpm test
```
Executes all unit tests, game rule simulations, and live WebSocket E2E server tests.

---

## 🌐 Free Public Deployment (₹0 Budget)

The game includes a unified production setup where the Node server serves both the static web frontend and persistent WebSockets on a single port (`process.env.PORT`).

### Option A: Render.com (Free Tier — Verified Persistent WebSockets)
1. Push this repository to GitHub.
2. Create a new **Web Service** on [Render.com](https://render.com).
3. Connect your repository.
4. Settings:
   - **Environment:** `Node` or `Docker`
   - **Build Command:** `corepack enable && pnpm install && pnpm run build:client`
   - **Start Command:** `node --experimental-strip-types src/server/index.ts`
   - **Instance Type:** `Free`
5. Deploy! Render provisions a free HTTPS/WSS URL (`https://cock-and-keys.onrender.com`).

### Option B: Railway / Fly.io / Glitch
- Using the included [`Dockerfile`](file:///home/imfarhan0105/Desktop/game/Dockerfile):
```bash
fly launch
# or deploy directly on Railway free tier
```

---

## 🧪 Verified Acceptance Tests
- [x] Decoy key does not trigger memory loss.
- [x] Genuine key triggers collapse, memory loss, inventory drop, riddle & smile.
- [x] Key carrier cannot attack or use weapons.
- [x] Riddle points to observable town landmarks for player's assigned house.
- [x] Unlocking wrong house fails; unlocking correct assigned house wins.
- [x] Wrongful NPC kills increment Red Meter (+1); never decreases.
- [x] Red Meter 5 triggers only attacked faction retaliation.
- [x] Red Meter 7 triggers town-wide universal hostility.
- [x] Red Meter 8 causes immediate game over.
- [x] Shareable 4-letter room codes & real WebSocket synchronization.
