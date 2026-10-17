-- Append-only audit events for school administrative changes.
CREATE TABLE IF NOT EXISTS audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL,
 entity_type text NOT NULL,
 entity_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_school_created ON audit_events(school_id,created_at DESC);

CREATE OR REPLACE FUNCTION audit_school_changes() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid; actor uuid; obj uuid;
BEGIN
 IF TG_TABLE_NAME='school_memberships' THEN
  sid:=COALESCE(NEW.school_id,OLD.school_id);
  obj:=COALESCE(NEW.user_id,OLD.user_id);
 ELSIF TG_TABLE_NAME='exam_marks' THEN
  sid:=COALESCE(NEW.school_id,OLD.school_id);
  obj:=COALESCE(NEW.exam_id,OLD.exam_id);
 ELSIF TG_TABLE_NAME='attendance' THEN
  sid:=COALESCE(NEW.school_id,OLD.school_id);
  obj:=COALESCE(NEW.student_id,OLD.student_id);
 ELSE
  sid:=COALESCE(NEW.school_id,OLD.school_id);
  obj:=COALESCE(NEW.id,OLD.id);
 END IF;
 BEGIN
  actor:=NULLIF(current_setting('aqoonhub.actor_user_id',true),'')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN actor:=NULL;
 END;
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM schools WHERE id=sid) THEN RETURN OLD; END IF;
 INSERT INTO audit_events(school_id,actor_user_id,action,entity_type,entity_id)
 VALUES(sid,actor,TG_OP,TG_TABLE_NAME,obj);
 RETURN COALESCE(NEW,OLD);
END $$;

DO $$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['school_memberships','classes','students','subjects','exams','exam_marks','attendance','fee_payments']
 LOOP
  IF tbl='exam_marks' THEN
   EXECUTE format('DROP TRIGGER IF EXISTS audit_changes ON %I',tbl);
   EXECUTE format('CREATE TRIGGER audit_changes AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_school_changes()',tbl);
  ELSE
   EXECUTE format('DROP TRIGGER IF EXISTS audit_changes ON %I',tbl);
   EXECUTE format('CREATE TRIGGER audit_changes AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_school_changes()',tbl);
  END IF;
 END LOOP;
END $$;
