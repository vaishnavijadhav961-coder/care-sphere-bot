# CareSphere Bot

**AI-powered e-commerce customer care chatbot.**

A React 19 SPA powered by Firebase Realtime Database and the Gemini API. The chatbot appears as a floating widget — it answers product questions, tracks orders, applies coupons, runs a flash-deal quiz, and escalates to human agents when needed. An admin dashboard provides realtime order/inventory/escalation management with a one-click database seeder.

---

> *[Add a demo GIF here — 5-second screen recording of the chat widget opening, asking a question, and getting a bot reply makes this dramatically more impactful for hackathon judging.]*

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, react-router-dom v7, Vite |
| Backend | Firebase Realtime Database |
| AI | Gemini 3.1 Flash Lite (via REST API) |
| Auth | Firebase Auth (email/password) |
| Hosting | Firebase Hosting (`client/dist`) |
| Linting | ESLint 10 + react-hooks + react-refresh |

---

## Project Structure

```
care-sphere-bot/
├── firebase.json                 # Hosting config + rewrites
├── client/
│   ├── .env                      # Firebase + Gemini API keys (VITE_ prefixed)
│   ├── index.html                # SPA entry
│   ├── vite.config.js            # Vite + React plugin
│   ├── package.json              # Dependencies & scripts
│   ├── eslint.config.js          # Flat ESLint config
│   ├── public/images/            # 10 product images
│   └── src/
│       ├── main.jsx              # Root render
│       ├── App.jsx               # Router + providers + route definitions
│       ├── App.css               # Dark mode CSS overrides per page
│       ├── index.css             # Global design tokens (light/dark)
│       ├── styles/
│       │   ├── variables.css     # CSS custom properties
│       │   └── admin.css         # Admin dashboard (1320 lines)
│       ├── hooks/
│       │   ├── AuthContext.jsx   # Auth state + admin flag from RTDB
│       │   ├── ThemeContext.jsx  # Light/dark toggle (localStorage)
│       │   └── useRealtimeListener.js  # Generic RTDB listener hook
│       ├── firebase/
│       │   ├── config.js         # Firebase init (app, db, auth)
│       │   ├── auth.js           # login, register, logout
│       │   ├── products.js       # CRUD + seed for products
│       │   ├── orders.js         # CRUD + seed for orders
│       │   ├── cart.js           # Per-user cart operations
│       │   ├── coupons.js        # Validate, create, seed coupons
│       │   ├── flashDeals.js     # Flash deal code generation + validation
│       │   ├── escalations.js    # Human support ticket CRUD
│       │   ├── chatSessions.js   # Per-account chat history persistence
│       │   └── utils.js          # Shared helpers (snapshotToArray, etc.)
│       ├── bot/
│       │   ├── bot.js            # Core: calls Gemini with live data injection
│       │   ├── masterPrompt.js   # System prompt with 15 rules + modes
│       │   └── tagDetection.js   # Parse [FLASH_DEAL] [ESCALATE] [FAILURE] [REDIRECT] [CART_REMOVE] [CART_UPDATE] tags
│       ├── components/
│       │   ├── TopNav.jsx        # Sticky nav, cart badge, user dropdown, theme toggle
│       │   ├── ChatWidget.jsx    # Floating chatbot — main product
│       │   └── ChatWidget.css    # Chat UI styling
│       └── pages/
│           ├── Admin.jsx         # 4-tab admin dashboard
│           ├── ProductGrid.jsx   # Product listing with search, category, sort
│           ├── ProductPage.jsx   # Single product detail page
│           ├── Compare.jsx       # Side-by-side product comparison
│           ├── Checkout.jsx      # Cart + coupon validation + place order
│           ├── Track.jsx         # Order tracking with 4-step timeline
│           ├── Orders.jsx        # User's order history
│           ├── Coupons.jsx       # Coupon browser with category filter
│           ├── Login.jsx         # Email/password login
│           └── Register.jsx      # Email/password registration
```

---

## Firebase RTDB Data Model

| Path | Schema |
|---|---|
| `products/{id}` | `{ name, price, stock, inStock, category, discount, rating, description, pageUrl, image, specs: {}, notifyList: [] }` |
| `orders/{id}` | `{ customerId, productId, productName, price, status, orderDate, estimatedDelivery, delayReason, trackingNumber, items: [], timeline: [] }` |
| `carts/{uid}/{productId}` | `{ productId, name, price, image, quantity, addedAt }` |
| `coupons/{code}` | `{ code, discount, discountPercent, description, applicableOn, validTill, expiryDate, isActive }` |
| `flashDealCodes/{pushId}` | `{ code, customerId, discountPercent, used, createdAt, expiresAt }` |
| `chatSessions/{uid}/{sessionId}` | `{ messages: [{ role, parts: [{ text }] }], preview, createdAt, updatedAt }` |
| `escalations/{id}` | `{ customerId, customerName, urgency, summary, chatHistory: [], status, createdAt }` |
| `admins/{uid}` | `true` |

---

## Routes

| Path | Page | Access |
|---|---|---|
| `/` | Redirects to `/products` | Public |
| `/products` | Product grid with search & filters | Public |
| `/products/:id` | Product detail page | Public |
| `/compare?p1=X&p2=Y` | Product comparison | Public |
| `/track/:orderId` | Order tracking timeline | Public |
| `/coupons` | Coupon listing | Public |
| `/login` | Sign in (redirects if authed) | Public |
| `/register` | Sign up (redirects if authed) | Public |
| `/checkout` | Cart & checkout | Public |
| `/orders` | User's order history | Auth required |
| `/admin` | Admin dashboard | Admin required |
| `*` | 404 page | — |

---

## Chatbot Features

- **Two modes**: Human (warm + emojis) / Direct (short + bullet points)
- **Product Q&A**: Name, price, stock, specs, rating with auto-redirect
- **Order tracking**: Status, delivery date, delay reasons with auto-redirect
- **Comparisons**: Same-category only, auto-winner detection with redirect
- **Coupon matching**: Lists all or filters by category with redirect
- **Stock notifications**: Confirms notify-list signup
- **Cart management**: View items, remove via `[CART_REMOVE]` tag
- **Flash deal game**: Gemini detects right moment → quiz → 15% off code (2hr expiry)
- **Chat history persistence**: Per-account sessions survive page reloads; switch, start, or delete sessions
- **Self-reported failures**: Gemini uses `[FAILURE]` tag when unable to find info; frontend auto-escalates after 3 failures
- **Human escalation**: Persistent two-way chat via RTDB tickets with LLM-generated handoff summaries; AI retains full conversation context (including agent replies) after resolution
- **Auto-navigation**: Gemini controls browser via `[REDIRECT: /path]` tags
- **Proactive alerts**: Realtime delay notifications + back-in-stock alerts

---

## Admin Dashboard

4-tab interface with realtime data:

1. **Overview** — Revenue, active orders, unresolved tickets, low stock. Quick order summary + escalation queue with expandable tickets, agent reply, and resolve.
2. **Orders** — Searchable table, inline status selector, delay modal with reason + new ETA.
3. **Products** — Grid with stock adjuster (± buttons), category filter, create product form.
4. **Coupons** — Standard coupon list + flash deal list, create coupon form.

Includes one-click database seeder (10 products, 3 orders, 3 coupons, 3 escalations) and demo simulator (urgent ticket, delayed order injection).

---

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project
- **Firebase Realtime Database instance** — create one in the [Firebase Console](https://console.firebase.google.com/). The region you choose (e.g., `asia-southeast1`, `us-central1`) determines the `databaseURL` value in `.env`. Pick your region before setting up the app.
- Gemini API key ([Google AI Studio](https://aistudio.google.com/))

### Setup

```bash
cd client
npm install
cp .env.example .env
```

Fill `.env` with your Firebase and Gemini credentials:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_URL=...
VITE_GEMINI_API_KEY=...
```

### Run

```bash
npm run dev      # Dev server (Vite)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint
```

### Deploy to Firebase

```bash
firebase deploy
```

Make sure `firebase.json` points `hosting.public` to `client/dist`.

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint on all files |

---

## Screenshots

> *[Add screenshots here — e.g., product grid, chat widget open, admin dashboard, tracking page]*

---

## Team

> *[Built by Name, Name, Name for Hackathon Name]*

---

## License

MIT
