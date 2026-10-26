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

## Step 3 — Deploy frontend and API on Vercel
Import the GitHub repository as a Vercel project with root directory `.`. `vercel.json` configures the Vite output (`dist`), SPA routes, and `/api/*` function routing. The API uses the server workspace dependencies, so Vercel installs the root npm workspaces.

Connect a Neon PostgreSQL database to the project. In Vercel → **Settings → Environment Variables**, set:
- `DATABASE_URL`: Neon pooled connection string (secret; use the `-pooler` hostname)
- `JWT_SECRET`: unique random secret with at least 32 characters

Apply `database/001_initial_schema.sql`, then `002_attendance_fees.sql`, `003_audit_events.sql`, and `004_class_subjects.sql` in order using the Neon SQL Editor. Never put connection strings, JWT secrets, or real passwords in GitHub or chat.

After the first deployment, verify `https://YOUR-PROJECT.vercel.app/api/health`, then test platform/school login, school creation, Excel imports, teacher assignments, publishing, and student results with test accounts. Vercel serves both the React frontend and the Express API on the same domain; `VITE_API_URL` should remain unset.

## Release safety
Registration-number-only login is not strong identity verification; anyone who knows a student's registration number may access the student view. Obtain school consent and use the result PIN verification flow for private results. Configure Neon backups and recovery tests before using real student data.
