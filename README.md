# Insighta Labs+ — Backend

A secure, multi-interface profile intelligence platform built with NestJS, TypeORM, and PostgreSQL.

## System Architecture

The system is split into three repositories:

- **Backend** (this repo) — NestJS REST API, single source of truth
- **CLI** (`insighta-cli`) — globally installable terminal tool
- **Web Portal** (`insighta-web`) — Next.js browser interface

All interfaces talk to the same backend. Authentication, roles, and data are consistent across all of them.

┌─────────────┐     ┌─────────────┐
│  CLI Tool   │     │ Web Portal  │
└──────┬──────┘     └──────┬──────┘
│                   │
└─────────┬─────────┘
│
┌────────▼────────┐
│  NestJS Backend │
│                 │
│  Auth Module    │
│  Profiles Module│
│  Users Module   │
└────────┬────────┘
│
┌────────▼────────┐
│   PostgreSQL    │
└─────────────────┘

## Authentication Flow

### Browser (Web Portal)
1. User clicks "Continue with GitHub"
2. Browser redirects to `GET /auth/github`
3. Passport redirects to GitHub OAuth page
4. GitHub redirects back to `GET /auth/github/callback`
5. Backend upserts user, issues access + refresh tokens
6. Tokens set as HTTP-only cookies
7. User redirected to `/dashboard`

### CLI (PKCE Flow)
1. User runs `insighta login`
2. CLI generates `state`, `code_verifier`, and `code_challenge` (SHA-256 of verifier)
3. CLI starts a local server on port 9876
4. CLI opens browser to `GET /auth/github/cli?state=X&code_challenge=Y`
5. Backend stores state + code_challenge, redirects to GitHub
6. GitHub redirects to `GET /auth/github/cli/callback`
7. Backend redirects to CLI's local server at `localhost:9876/callback`
8. CLI sends `POST /auth/github/cli/token` with `{ code, code_verifier, state }`
9. Backend validates PKCE, exchanges code with GitHub, upserts user
10. Backend issues access + refresh tokens, returns to CLI
11. CLI stores tokens at `~/.insighta/credentials.json`
12. CLI prints `Logged in as @username`

## Token Handling

| Token | Expiry | Storage (CLI) | Storage (Web) |
|-------|--------|---------------|---------------|
| Access token | 3 minutes | credentials.json | HTTP-only cookie |
| Refresh token | 5 minutes | credentials.json | HTTP-only cookie |

- Refresh tokens are hashed (SHA-256) before being stored in the database
- On refresh, the old token is immediately revoked and a new pair is issued (rotation)
- On logout, the refresh token is revoked server-side

## Role Enforcement

Two roles are supported:

| Role | Permissions |
|------|-------------|
| `admin` | Full access — list, search, create, export profiles |
| `analyst` | Read-only — list, search, export profiles |

Default role on signup: `analyst`

Roles are enforced via a global `RolesGuard` using the `@Roles('admin')` decorator. Any endpoint without `@Roles()` is accessible to all authenticated users. Inactive users (`is_active: false`) receive `403 Forbidden` on all requests.

## Natural Language Parsing

The `NlpParserService` parses free-text queries into structured filters:

- Extracts gender keywords (`male`, `female`)
- Extracts age group keywords (`young`, `adult`, `senior`, `child`, `teenager`)
- Extracts country names and maps to country codes
- Extracts age ranges (`older than 30`, `under 25`)

Example:
"young females from nigeria" → { gender: 'female', age_group: 'adult', country_id: 'NG' }

## API Reference

All `/api/*` endpoints require:
- `Authorization: Bearer <access_token>`
- `X-API-Version: 1`

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/auth/github` | No | Browser OAuth redirect |
| GET | `/auth/github/callback` | No | Browser OAuth callback |
| GET | `/auth/github/cli` | No | CLI OAuth redirect |
| GET | `/auth/github/cli/callback` | No | CLI OAuth callback |
| POST | `/auth/github/cli/token` | No | CLI token exchange |
| POST | `/auth/refresh` | No | Refresh token pair |
| POST | `/auth/logout` | No | Revoke refresh token |
| GET | `/auth/whoami` | Yes | Get current user |

### Profiles
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/profiles` | Any | List with filters + pagination |
| GET | `/api/profiles/:id` | Any | Get single profile |
| GET | `/api/profiles/search` | Any | Natural language search |
| GET | `/api/profiles/export` | Any | Export CSV |
| POST | `/api/profiles` | Admin | Create profile |

### Query Parameters (GET /api/profiles)
| Param | Type | Description |
|-------|------|-------------|
| `gender` | male \| female | Filter by gender |
| `country_id` | string | Filter by country code (e.g. NG) |
| `age_group` | child \| teenager \| adult \| senior | Filter by age group |
| `min_age` | number | Minimum age |
| `max_age` | number | Maximum age |
| `sort_by` | age \| created_at \| gender_probability | Sort field |
| `order` | asc \| desc | Sort direction |
| `page` | number | Page number (default: 1) |
| `limit` | number | Page size (default: 10, max: 50) |

## Rate Limiting

| Scope | Limit |
|-------|-------|
| `/auth/*` | 10 requests per minute |
| All other endpoints | 60 requests per minute per user |

## Setup & Installation

### Prerequisites
- Node.js 20+
- PostgreSQL 14+

### Steps

```bash
# Clone the repo
git clone https://github.com/your-username/insighta-backend.git
cd insighta-backend

# Install dependencies
npm install

# Copy env file and fill in values
cp .env.example .env

# Start the server
npm run start:dev
```

### Environment Variables
DATABASE_URL=postgresql://postgres:password@localhost:5432/insighta_db
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:8000/auth/github/callback
GITHUB_CLI_CALLBACK_URL=http://localhost:8000/auth/github/cli/callback
JWT_SECRET=
WEB_PORTAL_URL=http://localhost:3000
PORT=8000
NODE_ENV=development

## Running Tests

```bash
npm test
```

## Deployment

Backend is deployed : `https://intelliqueryengine-production.up.railway.app/`
