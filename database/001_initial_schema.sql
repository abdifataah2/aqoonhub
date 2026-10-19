-- AqoonHub Phase 2: initial PostgreSQL schema.
-- Apply only to a dedicated development database after review.
-- Application queries MUST enforce school_id authorization server-side.
-- This schema alone is NOT a production security boundary.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL,
  logo_url text,
  brand_color text NOT NULL DEFAULT '#2563eb',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  is_platform_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE school_memberships (
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('school_admin', 'exam_officer', 'teacher')),
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (school_id, user_id)
);

CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  academic_year text NOT NULL,
  UNIQUE (school_id, id),
  UNIQUE (school_id, name, academic_year)
);

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL,
  registration_number text NOT NULL,
  full_name text NOT NULL,
  result_pin_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, id),
  UNIQUE (school_id, registration_number),
  FOREIGN KEY (school_id, class_id) REFERENCES classes(school_id, id)
);

CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE (school_id, id),
  UNIQUE (school_id, name)
);

CREATE TABLE exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL,
  title text NOT NULL,
  academic_year text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, id),
  FOREIGN KEY (school_id, class_id) REFERENCES classes(school_id, id),
  CHECK ((status = 'published' AND published_at IS NOT NULL) OR (status <> 'published' AND published_at IS NULL))
);

CREATE TABLE exam_marks (
  school_id uuid NOT NULL,
  exam_id uuid NOT NULL,
  student_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  score numeric(6,2) NOT NULL CHECK (score >= 0),
  max_score numeric(6,2) NOT NULL CHECK (max_score > 0 AND score <= max_score),
  entered_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, exam_id, student_id, subject_id),
  FOREIGN KEY (school_id, exam_id) REFERENCES exams(school_id, id) ON DELETE CASCADE,
  FOREIGN KEY (school_id, student_id) REFERENCES students(school_id, id) ON DELETE CASCADE,
  FOREIGN KEY (school_id, subject_id) REFERENCES subjects(school_id, id)
);

CREATE INDEX idx_students_school_class ON students(school_id, class_id);
CREATE INDEX idx_exams_school_status ON exams(school_id, status);
CREATE INDEX idx_marks_exam_student ON exam_marks(school_id, exam_id, student_id);

-- Required before launch:
-- 1. Backend authorization on EVERY tenant-scoped operation (and ideally RLS).
-- 2. Hash passwords/PINs with a slow password hash (Argon2id preferred).
-- 3. Rate-limit PIN verification; never expose unpublished results.
-- 4. Verify student enrollment matches exam class before inserting marks.
-- 5. Enforce grading rules only after school owners approve the thresholds.
-- 6. Add audit logs, backups, secure session handling, and migration tooling.
