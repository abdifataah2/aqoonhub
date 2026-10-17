-- AqoonHub development migration 002: attendance and school fees
CREATE TABLE IF NOT EXISTS attendance (
 school_id uuid NOT NULL,
 student_id uuid NOT NULL,
 attendance_date date NOT NULL,
 status text NOT NULL CHECK(status IN ('present','absent','late','excused')),
 recorded_by uuid NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(school_id,student_id,attendance_date),
 FOREIGN KEY(school_id,student_id) REFERENCES students(school_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON attendance(school_id,attendance_date);
CREATE TABLE IF NOT EXISTS fee_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL,
 student_id uuid NOT NULL,
 amount numeric(12,2) NOT NULL CHECK(amount>0),
 currency text NOT NULL CHECK(currency IN ('USD','SOS')),
 reference text NOT NULL,
 paid_on date NOT NULL,
 recorded_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(school_id,reference),
 FOREIGN KEY(school_id,student_id) REFERENCES students(school_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fees_school_student ON fee_payments(school_id,student_id);
