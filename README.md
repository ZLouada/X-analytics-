# X Analytics Free

> **Free, self-hosted X (Twitter) Analytics** — Run your own analytics with your own account. No subscription needed.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)](https://docker.com/)

---

## 🎯 Why X Analytics Free?

X (Twitter) moved detailed analytics behind **X Premium** ($8-16/month). This tool gives you **similar insights for free** by:

- Using **your own X account** via official OAuth 2.0
- Running **entirely on your machine** (or your server)
- **Zero cost** — no subscriptions, no hidden fees
- **Your data stays yours** — we never see your tweets, followers, or tokens

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Engagement Analytics** | Impressions, likes, retweets, replies, quotes, bookmarks, engagement rate |
| 📈 **Historical Trends** | Track performance over 7/30/90 days with automatic snapshots |
| ⏰ **Best Posting Times** | Discover which hours (UTC) get the most engagement |
| 👥 **Audience Insights** | Follower locations, verified followers, follower/following ratios |
| 🏆 **Top Tweets** | Ranked by engagement rate with direct links to X |
| 📤 **Export Reports** | Download as JSON, CSV, or PDF |
| 🔄 **Auto Sync** | Background refresh (configurable interval) |
| 🐳 **Docker Ready** | One-command deployment |

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/x-analytics-free.git
cd x-analytics-free

# 2. Create environment file
cp .env.example .env
# Edit .env with your X API credentials (see below)

# 3. Generate secrets
openssl rand -base64 32  # For ENCRYPTION_KEY
openssl rand -base64 32  # For SESSION_SECRET

# 4. Start
docker compose up -d

# 5. Open http://localhost:3000 and sign in with X
```

### Option 2: Local Development

```bash
# Prerequisites: Node.js 20+, pnpm

git clone https://github.com/yourusername/x-analytics-free.git
cd x-analytics-free

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Initialize database
pnpm run db:init

# Start dev servers (API + UI)
pnpm run dev

# Open http://localhost:5173
```

---

## 🔑 Getting X API Credentials

1. Go to [developer.x.com](https://developer.x.com/en/portal/projects-and-apps)
2. Create a **Project** → **App**
3. In **User authentication settings**:
   - **Type**: `Public client` (for PKCE)
   - **App permissions**: `Read` (tweet.read, users.read)
   - **Callback URI**: `http://localhost:3000/auth/callback` (or your domain)
   - **Website URL**: `http://localhost:3000`
4. Save and copy **Client ID** and **Client Secret**
5. Add to your `.env`:
   ```env
   X_CLIENT_ID=your_client_id
   X_CLIENT_SECRET=your_client_secret
   X_REDIRECT_URI=http://localhost:3000/auth/callback
   ```

> **Note**: The Free/Basic API tiers have rate limits. This tool respects them automatically.

---

## 📁 Project Structure

```
x-analytics-free/
├── docker/                 # Docker configuration
├── src/
│   ├── api/               # X API v2 client (OAuth 2.0 PKCE)
│   ├── analytics/         # Analytics computation engine
│   ├── auth/              # Authentication utilities
│   ├── config/            # Environment validation (Zod)
│   ├── export/            # JSON/CSV/PDF export
│   ├── server/            # Express API server
│   ├── storage/           # SQLite + repositories
│   ├── types/             # TypeScript types
│   └── ui/                # React + Vite dashboard
├── scripts/               # Database init/migration
├── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js 20+ (ESM) |
| **Language** | TypeScript (strict) |
| **API** | Express.js + Zod validation |
| **Database** | SQLite (better-sqlite3, WAL mode) |
| **Auth** | OAuth 2.0 PKCE (jose) + encrypted token storage |
| **Frontend** | React 18 + Vite + React Router |
| **Styling** | Tailwind CSS (via CDN in HTML) |
| **Charts** | Canvas API (zero dependencies) |
| **Export** | pdfkit, csv-stringify |
| **Container** | Docker multi-stage build |
| **Logging** | Pino |

---

## 🔒 Security & Privacy

- **Tokens encrypted at rest** (AES-256-GCM)
- **PKCE flow** — no client secret needed for public clients
- **HttpOnly cookies** — tokens never in localStorage
- **Rate limiting** — protects against abuse
- **Helmet.js** — security headers
- **No external calls** except to `api.x.com`
- **Open source** — audit the code yourself

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/auth/login` | Start OAuth flow |
| `GET` | `/auth/callback` | OAuth callback |
| `GET` | `/auth/status` | Check auth status |
| `POST` | `/auth/logout` | Logout |
| `GET` | `/api/analytics/report` | Full analytics report |
| `GET` | `/api/analytics/quick-stats` | Dashboard summary |
| `GET` | `/api/analytics/tweets` | Paginated tweets |
| `GET` | `/api/analytics/followers` | Paginated followers |
| `POST` | `/api/analytics/sync` | Trigger data sync |
| `GET` | `/api/analytics/export` | Export report (JSON/CSV/PDF) |
| `GET` | `/api/analytics/export/all` | Export all raw data |
| `GET` | `/api/analytics/history` | Historical snapshots |
| `GET/PUT` | `/api/analytics/settings` | User preferences |

---

## 📦 Deployment

### Production with Docker

```bash
# Build and run
docker compose -f docker/docker-compose.yml up -d --build

# View logs
docker compose -f docker/docker-compose.yml logs -f

# Stop
docker compose -f docker/docker-compose.yml down
```

### With Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name analytics.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable HTTPS with Let's Encrypt:
```bash
certbot --nginx -d analytics.yourdomain.com
```

Update `X_REDIRECT_URI` in `.env` to `https://analytics.yourdomain.com/auth/callback`.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## ⚠️ Disclaimer

This project is **not affiliated with X Corp.** It uses the official X API v2 with your explicit permission via OAuth 2.0. You are responsible for complying with X's [Developer Agreement](https://developer.x.com/en/developer-terms/agreement) and [API Terms](https://developer.x.com/en/developer-terms/api-terms).

**Rate limits apply** based on your X API tier. This tool implements automatic backoff and retry logic.

---

## 🙏 Acknowledgments

- [X API v2](https://developer.x.com/en/docs/twitter-api) for the official API
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for fast SQLite
- [jose](https://github.com/panva/jose) for JWT/OAuth utilities
- [pdfkit](https://github.com/foliojs/pdfkit) for PDF generation

---

**Star ⭐ this repo if you find it useful!**