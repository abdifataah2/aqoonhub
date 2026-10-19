# Somskill — release checklist (October 2026)

## Implemented on feature/somskill-phase2
- Platform administrator: create schools and school admins; no school self-registration.
- School staff login with role-based access, classes, subjects, class-subject mappings and teacher assignments.
- Student registration, bulk Excel .xlsx template/import/export (max 500 students).
- Teacher account Excel template/import (max 100 teachers), individual accounts and password reset.
- Exams: draft marks, Excel .xlsx template/import (max 1000 marks), review and publish.
- Registration-number-only published student results, attendance, fee payments and audit logs.
- Class/subject editing and deletion; removal of assignments.
- CI builds frontend and runs API integration tests against PostgreSQL.

## GitHub-first verification
1. Wait for BOTH frontend and backend GitHub Actions jobs to pass for the latest commit.
2. Review failed job logs; fix and rerun until green.
3. In a test environment, perform browser acceptance: platform login → school creation → school admin login → teacher import and assignment → student import → exam marks import → publish → student results lookup.
4. Verify tenant separation with two schools and teacher restrictions.
5. Use fictional data only until security and privacy sign-off.

## Before live release
- Provision managed PostgreSQL and a persistent Node API host, plus frontend hosting and DNS.
- Set unique production JWT_SECRET, DATABASE_URL, FRONTEND_ORIGIN and platform seed credentials in secure environment variables.
- Apply database/001_initial_schema.sql, 002_attendance_fees.sql, 003_audit_events.sql and 004_class_subjects.sql in order; run seed.
- Configure TLS, restricted CORS, secure secret management, rate limits, backups and recovery drills, error monitoring and logging.
- Confirm all school administrators and user roles, data retention and access policies.
- **Important privacy limitation:** registration numbers alone are guessable. Published results can be viewed by anyone who knows a registration number. Agree on a stronger student verification method before using real student data.
- Browser E2E and production deployment are NOT proven by GitHub CI alone.

## Local development
Run backend from server/ with npm install and npm run dev, and frontend from root with npm ci and npm run dev. Use /platform for platform admin, /s/<slug>/galitaan for school staff, and /s/<slug>/natiijo for student results.
