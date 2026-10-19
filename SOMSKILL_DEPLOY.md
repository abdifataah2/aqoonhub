# Somskill deployment and VS Code sync

## Step 1 — GitHub
The application is branded **Somskill** in the frontend, backend, and project metadata. GitHub Actions checks the frontend build and PostgreSQL-backed API integration tests.

## Step 2 — Refresh VS Code
In the existing local project folder, run:
```powershell
git status
git pull origin main
npm ci
cd server
npm install
cd ..
```
If `git status` shows local edits, commit or stash them before pulling. Do not use `git reset --hard` or force-push.

## Step 3 — Deploy
Deploy the **frontend** on Vercel: import the GitHub repository, select root directory `.`, build command `npm run build`, output directory `dist`, framework Vite. SPA routing is configured in `vercel.json`.

The backend is a **persistent Express/Node API with PostgreSQL**. Host it on a Node-capable platform with a managed PostgreSQL database; Vercel static frontend hosting alone will not make the API and database run.

Frontend Vercel environment variable:
- `VITE_API_URL=https://YOUR-BACKEND-HOST` (no trailing slash)

Backend environment variables:
- `DATABASE_URL`: PostgreSQL connection string (secret)
- `JWT_SECRET`: unique secret of at least 32 characters
- `FRONTEND_ORIGIN`: exact public Vercel frontend origin, e.g. `https://somskill.vercel.app`
- `PORT`: platform-assigned port where required
- `SEED_PLATFORM_EMAIL` and `SEED_PLATFORM_PASSWORD`: only for initial platform admin seed

Apply `database/001_initial_schema.sql` through `004_class_subjects.sql` in order, then run the server seed script. Never commit credentials or `.env` files.

Verify the live backend `/api/health` endpoint, platform login, school creation, Excel imports, teacher assignments, publishing, and student results with test accounts.

## Release safety
Registration-number-only results are accessible to anyone who knows or guesses a student's registration number. Obtain school consent and implement stronger student verification before storing real student results. Backups, recovery tests, security review, and full browser E2E remain required for production.
