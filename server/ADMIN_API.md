# AqoonHub Phase 2 — Admin API

All routes below require `Authorization: Bearer <token>` from `POST /api/schools/:slug/login`.
Every route is under `/api/schools/:slug/admin`.

| Method | Route | Roles |
|---|---|---|
| GET | /summary | school_admin, exam_officer, teacher |
| GET | /classes | school_admin, exam_officer, teacher |
| POST | /classes | school_admin |
| GET | /students | school_admin, exam_officer, teacher |
| POST | /students | school_admin |
| GET | /subjects | school_admin, exam_officer, teacher |
| POST | /subjects | school_admin |
| GET | /exams | school_admin, exam_officer, teacher |
| POST | /exams | school_admin, exam_officer |
| POST | /exams/:examId/marks | school_admin, exam_officer, teacher |
| POST | /exams/:examId/submit | school_admin, exam_officer |
| POST | /exams/:examId/publish | school_admin, exam_officer |

Example bodies:

```json
{"name":"Fasalka 1aad","academicYear":"2026-2027"}
```

```json
{"classId":"UUID","registrationNumber":"2026-001","fullName":"Arday Tijaabo","resultPin":"secure-pin-at-least-6"}
```

```json
{"classId":"UUID","title":"Imtixaanka Koowaad","academicYear":"2026-2027"}
```

```json
{"studentId":"UUID","subjectId":"UUID","score":78,"maxScore":100}
```

### Important
These endpoints are an **early prototype**. Do not deploy with real student data.
Teacher permissions are still too broad (teachers can see all students in their school and edit any draft exam); restrict them to assigned classes and subjects.
Publishing does not yet validate completeness of all marks, grade thresholds, or multi-person approvals. There are no audit logs, CSRF-safe cookie sessions, or automated integration tests. Do not merge into main until these are addressed.
