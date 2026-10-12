# ☕ The Café Platform — High-Performance Nocturnal Restaurant & Bar SaaS

[![CI / CD & Docker Build](https://github.com/syntax-architect/Caffe-Website/actions/workflows/docker-ci-cd.yml/badge.svg)](https://github.com/syntax-architect/Caffe-Website/actions/workflows/docker-ci-cd.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Docker Ready](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
[![React](https://img.shields.io/badge/react-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-6-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-26%20suites%20passing-success.svg)](./the-cafe-barrackpore/tests)

A luxury, editorial-grade restaurant digital presence and operational operating system. Designed for fine dining, artisanal coffee roasteries, nocturnal lounges, and high-volume dining establishments.

---

## 🤖 Instructions for AI Assistants (ChatGPT, Claude, Cursor, Copilot)

> **Important Context for AI Models Reading a Downloaded GitHub ZIP:**
> 
> 1. **Monorepo Architecture**: The root repository is configured as an **npm workspace**. The core web application, components, and tests reside in `the-cafe-barrackpore/`.
> 2. **Execution Environment**: This project requires **Node.js 20+** and **npm**. 
>    - *Why ChatGPT Code Interpreter fails:* ChatGPT's default sandbox is a Python-only Linux environment that lacks Node.js and npm binaries. In that environment, running `npm test` will fail with `command not found: npm`.
>    - *Why Claude Web Artifacts fail:* Claude's web interface does not run a server-side terminal or execute Node.js TypeScript test suites.
> 3. **How to Run Commands from Root (No `cd` needed)**:
>    ```bash
>    npm install   # Installs dependencies across the workspace
>    npm test      # Runs all 26 TypeScript regression & contract test suites
>    npm run build # Compiles TypeScript, Vite bundle, and SSG prerendered static pages
>    npm run lint  # Runs oxlint static analysis
>    ```
> 4. **Test Suite Details**: Tests are located in `the-cafe-barrackpore/tests/*.test.ts` and executed directly via `tsx`. All 26 test suites are self-contained and run in demo/offline mode without requiring live database credentials.

---

## 🏗️ Repository Layout

```
.
├── Dockerfile                      # Multi-stage production Dockerfile (Nginx Alpine)
├── docker-compose.yml              # 1-command local & VPS deployment
├── docker-compose.multi-tenant.yml # Multi-client reverse-proxy setup (Traefik + Auto SSL)
├── nginx.conf                      # High-performance Nginx config (SPA routing, Gzip, headers)
├── package.json                    # Monorepo root workspace configuration
├── scripts/
│   ├── deploy-client.sh            # 1-Click bash script to provision new restaurant clients
│   └── deploy-client.ps1           # 1-Click PowerShell script for Windows environments
├── .github/workflows/
│   └── docker-ci-cd.yml            # Automated testing and GHCR Docker image publishing
└── the-cafe-barrackpore/            # Core Restaurant Application
    ├── public/                     # Static media, frames, audio, redirects
    ├── src/
    │   ├── components/             # UI components, layout variants, staff portal
    │   ├── contexts/               # React 19 State, Theme & Localization context
    │   ├── services/               # Supabase persistence, orders, menu availability
    │   └── utils/                  # Tax engine, security sanitizers, motion controls
    ├── scripts/
    │   └── prerender.ts            # SSG crawler pre-rendering & SPA static entrypoints
    └── tests/                      # 26 automated regression & contract test suites
```

---

## 🚀 Quickstart (Local Development)

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher

```bash
# 1. Clone repository
git clone https://github.com/syntax-architect/Caffe-Website.git
cd Caffe-Website

# 2. Install dependencies (runs across workspaces)
npm install

# 3. Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 🧪 Running the Test Suite

The platform includes **26 comprehensive test suites** covering internationalization, tax calculations, QR table ordering, RBAC staff authentication, kitchen display logic, payment security, and mobile UX.

```bash
# Run all 26 test suites from the root directory:
npm test
```

---

## 🐳 Docker Deployment & Multi-Client Scaling

This codebase is containerized and ready for commercial multi-client distribution.

### 1. Single Restaurant Deployment (1 Command)

```bash
# Build and run the production container on port 80
docker compose up -d --build
```
Verify health:
```bash
curl http://localhost/healthz
# Returns: healthy
```

### 2. Commercial Scaling: Selling to Multiple Restaurants

When selling this platform to multiple restaurant clients, you have two scalable deployment architectures:

#### Architecture A: Multi-Instance Container Model (Recommended)
Every restaurant client gets their own isolated Docker container. This guarantees:
- **Zero data-leak risk** between clients.
- **Independent custom themes, menus, and branding** per container.
- **Independent scaling, billing, and uptime** (one client's traffic spike never affects another).

Use `docker-compose.multi-tenant.yml` to run multiple clients on a single VPS with **automatic Let's Encrypt SSL**:

```bash
docker compose -f docker-compose.multi-tenant.yml up -d
```
Traefik automatically routes requests:
- `caffe.barrackpore.com` ➔ Container 1 (`caffe-client-barrackpore`)
- `bistro.example.com` ➔ Container 2 (`caffe-client-bistro`)
- Automatically fetches and renews HTTPS certificates!

#### Architecture B: 1-Click Provisioning Script
When onboarding a new client, provision their instance in seconds:

**Linux / macOS:**
```bash
./scripts/deploy-client.sh bistro 8082 "https://supabase-url" "anon-key"
```

**Windows PowerShell:**
```powershell
.\scripts\deploy-client.ps1 -ClientSlug "bistro" -Port 8082 -SupabaseUrl "https://..." -SupabaseKey "..."
```

---

## 🌐 Cloud Platform Deployments

### Render
- **Static Site Hosting**: Pre-rendered static files are generated in `dist/`. Ensure Render's **Redirects/Rewrites** rule is set to **Rewrite** (`/*` ➔ `/index.html`) or left blank (physical static files for `/staff/dashboard` are pre-generated during build).
- **Docker Web Service**: Connect your repo and Render will automatically detect the root `Dockerfile`.

### VPS (DigitalOcean, Hetzner, AWS EC2, Linode)
1. Install Docker: `curl -fsSL https://get.docker.com | sh`
2. Clone repo and run: `docker compose up -d`
3. Point your DNS A-record to the VPS IP address.

---

## 🔐 Environment Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase project URL for database & auth | `https://xyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anonymous API key | `eyJhbGciOi...` |
| `VITE_RESTAURANT_ID` | Multi-tenant tenant identifier | `caffe-barrackpore` |
| `VITE_SITE_URL` | Canonical public URL for QR & SEO | `https://caffe-website-6y9r.onrender.com` |

---

## 📄 License & Commercial Distribution

Proprietary commercial software. All rights reserved.
