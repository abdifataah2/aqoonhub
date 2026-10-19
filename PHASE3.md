# AqoonHub Phase 3 (development)
This branch adds a platform administrator, school creation, class/subject and teacher assignments, CSV bulk student import/export, and registration-number-only student results.

## Local upgrade
1. Apply database/004_class_subjects.sql after migrations 001–003.
2. Add SEED_PLATFORM_EMAIL (valid email) and SEED_PLATFORM_PASSWORD (at least 12 characters) to server/.env.
3. Run npm run seed in server/, then restart backend and frontend.
4. Visit /platform for platform admin; /s/<slug>/galitaan for school staff; /s/<slug>/natiijo for students.
5. School admin creates classes, subjects, maps class subjects, assigns teachers, and adds students/staff.

## Bulk student CSV
Export from Excel as **CSV UTF-8**, header: registrationNumber,fullName,classId.
The class UUID appears beside the class name in the school admin dashboard.
Import is transactional, maximum 500 rows/request, duplicate registration numbers are rejected.
Native .xlsx upload and complex CSV quoting are not yet implemented.

## Security / release blockers
- **Registration number alone is not a secret.** Anyone who knows/guesses a registration number can view the student's published marks. Obtain explicit school consent and implement stronger verification before storing real students' results.
- Never use real student data in this development build.
- This is not yet production-ready: complete full authorization and tenancy review, session hardening, backups, monitoring, and deployment.
- Run GitHub CI and local end-to-end tests before considering release.
