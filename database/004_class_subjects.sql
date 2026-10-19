-- AqoonHub phase 3: class-subject mapping, teacher assignments.
CREATE TABLE IF NOT EXISTS class_subjects (
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 class_id uuid NOT NULL,
 subject_id uuid NOT NULL,
 PRIMARY KEY(school_id,class_id,subject_id),
 FOREIGN KEY(school_id,class_id) REFERENCES classes(school_id,id) ON DELETE CASCADE,
 FOREIGN KEY(school_id,subject_id) REFERENCES subjects(school_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS teacher_assignments (
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 class_id uuid NOT NULL,
 subject_id uuid NOT NULL,
 teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(school_id,class_id,subject_id,teacher_id),
 FOREIGN KEY(school_id,class_id,subject_id) REFERENCES class_subjects(school_id,class_id,subject_id) ON DELETE CASCADE,
 FOREIGN KEY(school_id,teacher_id) REFERENCES school_memberships(school_id,user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON teacher_assignments(school_id,teacher_id);
