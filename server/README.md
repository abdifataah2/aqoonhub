# AqoonHub Phase 2 — API development

This branch adds a **development-only** PostgreSQL/Express API foundation. It is not production-ready and is not connected to the existing React UI yet.

## Requirements
- Node.js 20+
- PostgreSQL 15+

## Local setup
1. Create an empty local PostgreSQL database named `aqoonhub`.
2. Apply `database/001_initial_schema.sql` to that database (e.g. `psql -d aqoonhub -f database/001_initial_schema.sql`).
3. `cd server`
4. Copy `.env.example` to `.env`, set `DATABASE_URL`, a cryptographically random `JWT_SECRET` of 32+ characters, and replace seed credentials.
5. `npm install`
6. `npm run seed` (development database only)
7. `npm run dev`

API available at `http://localhost:4000/api/health`.

## Available routes
- `GET /api/schools`: active school directory.
- `GET /api/schools/:slug`: school branding.
- `POST /api/schools/:slug/login`: email/password, returns short-lived JWT.
- `GET /api/schools/:slug/me`: authenticated school membership check.
- `POST /api/schools/:slug/results/verify`: registrationNumber + pin, returns only published exam marks.

## Critical limitations
- The React forms still show demo-only notices and do not yet call this API.
- Do not put real student data in this environment.
- Before deployment: configure HTTPS, RLS/strong tenant authorization, secure cookies instead of browser-persisted JWTs, robust session revocation, stronger rate limits backed by shared storage, account lockouts, audit logging, data retention, backups, input validation, grading configuration, and comprehensive tests.
- Teacher and admin CRUD endpoints are not implemented yet.
- Seed script changes password for an existing matching email; use **only in local development**.
