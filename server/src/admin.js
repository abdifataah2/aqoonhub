import {Router} from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {pool} from './db.js';

export const adminRouter=Router({mergeParams:true});
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const error=(res,status,message)=>res.status(status).json({error:message});
const uuid=z.string().uuid();
const classInput=z.object({name:z.string().trim().min(1).max(100),academicYear:z.string().trim().min(1).max(30)});
const studentInput=z.object({classId:uuid,registrationNumber:z.string().trim().min(1).max(100),fullName:z.string().trim().min(1).max(200),resultPin:z.string().min(6).max(128)});
const subjectInput=z.object({name:z.string().trim().min(1).max(100)});
const examInput=z.object({classId:uuid,title:z.string().trim().min(1).max(200),academicYear:z.string().trim().min(1).max(30)});
const markInput=z.object({studentId:uuid,subjectId:uuid,score:z.number().finite().min(0),maxScore:z.number().finite().positive()}).refine(x=>x.score<=x.maxScore);
const roles=(...allowed)=>(req,res,next)=>allowed.includes(req.role)?next():error(res,403,'Oggolaansho kuma lihid');

adminRouter.use(wrap(async(req,res,next)=>{
 const slug=req.params.slug;
 if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))return error(res,404,'Iskuulka lama helin');
 const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
 if(!token)return error(res,401,'Fadlan soo gal');
 let claims;
 try{claims=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256'],issuer:'aqoonhub'})}
 catch{return error(res,401,'Galitaankaagu wuu dhacay')}
 const {rows}=await pool.query(`SELECT s.id,m.role FROM schools s JOIN school_memberships m ON m.school_id=s.id
 WHERE s.slug=$1 AND s.is_active=true AND m.user_id=$2 AND m.is_active=true`,[slug,claims.sub]);
 if(!rows.length||claims.schoolId!==rows[0].id)return error(res,403,'Uma lihid oggolaansho iskuulkan');
 req.schoolId=rows[0].id;req.userId=claims.sub;req.role=rows[0].role;
 next();
}));

adminRouter.get('/summary',wrap(async(req,res)=>{
 const {rows}=await pool.query(`SELECT
 (SELECT count(*)::int FROM students WHERE school_id=$1 AND is_active=true) AS students,
 (SELECT count(*)::int FROM classes WHERE school_id=$1) AS classes,
 (SELECT count(*)::int FROM exams WHERE school_id=$1) AS exams,
 (SELECT count(*)::int FROM school_memberships WHERE school_id=$1 AND is_active=true AND role='teacher') AS teachers`,[req.schoolId]);
 res.json({summary:rows[0]});
}));
adminRouter.get('/classes',wrap(async(req,res)=>{
 const {rows}=await pool.query('SELECT id,name,academic_year FROM classes WHERE school_id=$1 ORDER BY name',[req.schoolId]);
 res.json({classes:rows});
}));
adminRouter.post('/classes',roles('school_admin'),wrap(async(req,res)=>{
 const data=classInput.safeParse(req.body);if(!data.success)return error(res,400,'Xogta fasalka sax ma aha');
 const {rows}=await pool.query('INSERT INTO classes(school_id,name,academic_year) VALUES($1,$2,$3) RETURNING id,name,academic_year',[req.schoolId,data.data.name,data.data.academicYear]);
 res.status(201).json({class:rows[0]});
}));
adminRouter.get('/students',roles('school_admin','exam_officer'),wrap(async(req,res)=>{
 const {rows}=await pool.query('SELECT id,class_id,registration_number,full_name,is_active FROM students WHERE school_id=$1 ORDER BY registration_number LIMIT 200',[req.schoolId]);
 res.json({students:rows});
}));
adminRouter.post('/students',roles('school_admin'),wrap(async(req,res)=>{
 const data=studentInput.safeParse(req.body);if(!data.success)return error(res,400,'Xogta ardayga sax ma aha; PIN-ku waa inuu leeyahay ugu yaraan 6 xaraf');
 const {classId,registrationNumber,fullName,resultPin}=data.data;
 const hash=await bcrypt.hash(resultPin,12);
 const {rows}=await pool.query(`INSERT INTO students(school_id,class_id,registration_number,full_name,result_pin_hash)
 VALUES($1,$2,$3,$4,$5) RETURNING id,class_id,registration_number,full_name`,[req.schoolId,classId,registrationNumber,fullName,hash]);
 res.status(201).json({student:rows[0]});
}));
adminRouter.get('/subjects',wrap(async(req,res)=>{
 const {rows}=await pool.query('SELECT id,name FROM subjects WHERE school_id=$1 ORDER BY name',[req.schoolId]);
 res.json({subjects:rows});
}));
adminRouter.post('/subjects',roles('school_admin'),wrap(async(req,res)=>{
 const data=subjectInput.safeParse(req.body);if(!data.success)return error(res,400,'Xogta maaddada sax ma aha');
 const {rows}=await pool.query('INSERT INTO subjects(school_id,name) VALUES($1,$2) RETURNING id,name',[req.schoolId,data.data.name]);
 res.status(201).json({subject:rows[0]});
}));
adminRouter.get('/exams',wrap(async(req,res)=>{
 const {rows}=await pool.query('SELECT id,class_id,title,academic_year,status,published_at FROM exams WHERE school_id=$1 ORDER BY created_at DESC',[req.schoolId]);
 res.json({exams:rows});
}));
adminRouter.post('/exams',roles('school_admin','exam_officer'),wrap(async(req,res)=>{
 const data=examInput.safeParse(req.body);if(!data.success)return error(res,400,'Xogta imtixaanka sax ma aha');
 const {rows}=await pool.query('INSERT INTO exams(school_id,class_id,title,academic_year) VALUES($1,$2,$3,$4) RETURNING id,class_id,title,academic_year,status',[req.schoolId,data.data.classId,data.data.title,data.data.academicYear]);
 res.status(201).json({exam:rows[0]});
}));
adminRouter.post('/exams/:examId/marks',roles('school_admin','exam_officer'),wrap(async(req,res)=>{
 const id=uuid.safeParse(req.params.examId),data=markInput.safeParse(req.body);
 if(!id.success||!data.success)return error(res,400,'Dhibcaha ama aqoonsiga sax ma aha');
 const {studentId,subjectId,score,maxScore}=data.data;
 const {rows}=await pool.query(`INSERT INTO exam_marks(school_id,exam_id,student_id,subject_id,score,max_score,entered_by)
 SELECT e.school_id,e.id,st.id,sub.id,$5,$6,$7 FROM exams e
 JOIN students st ON st.school_id=e.school_id AND st.class_id=e.class_id AND st.id=$3 AND st.is_active=true
 JOIN subjects sub ON sub.school_id=e.school_id AND sub.id=$4
 WHERE e.school_id=$1 AND e.id=$2 AND e.status='draft'
 ON CONFLICT(school_id,exam_id,student_id,subject_id)
 DO UPDATE SET score=EXCLUDED.score,max_score=EXCLUDED.max_score,entered_by=EXCLUDED.entered_by,updated_at=now()
 RETURNING exam_id,student_id,subject_id,score,max_score`,[req.schoolId,id.data,studentId,subjectId,score,maxScore,req.userId]);
 if(!rows.length)return error(res,409,'Imtixaanka waa xiran yahay ama ardayga/maaddada ma waafaqsana');
 res.json({mark:rows[0]});
}));
adminRouter.post('/exams/:examId/submit',roles('school_admin','exam_officer'),wrap(async(req,res)=>{
 const id=uuid.safeParse(req.params.examId);if(!id.success)return error(res,400,'Aqoonsiga sax ma aha');
 const {rows}=await pool.query("UPDATE exams SET status='review' WHERE school_id=$1 AND id=$2 AND status='draft' RETURNING id,status",[req.schoolId,id.data]);
 if(!rows.length)return error(res,409,'Imtixaanka lama gudbin karo');
 res.json({exam:rows[0]});
}));
adminRouter.post('/exams/:examId/publish',roles('school_admin','exam_officer'),wrap(async(req,res)=>{
 const id=uuid.safeParse(req.params.examId);if(!id.success)return error(res,400,'Aqoonsiga sax ma aha');
 const {rows}=await pool.query(`UPDATE exams e SET status='published',published_at=now()
 WHERE e.school_id=$1 AND e.id=$2 AND e.status='review'
 AND EXISTS (SELECT 1 FROM exam_marks m WHERE m.school_id=e.school_id AND m.exam_id=e.id)
 RETURNING e.id,e.status,e.published_at`,[req.schoolId,id.data]);
 if(!rows.length)return error(res,409,'Imtixaanka waa inuu ku jiraa review oo dhibco leeyahay');
 res.json({exam:rows[0]});
}));

const attendanceInput=z.object({studentId:uuid,date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),status:z.enum(['present','absent','late','excused'])});
const feeInput=z.object({studentId:uuid,amount:z.number().positive().max(999999999),currency:z.enum(['USD','SOS']),reference:z.string().trim().min(1).max(120),paidOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
adminRouter.get('/attendance',roles('school_admin','exam_officer'),wrap(async(req,res)=>{
 const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(req.query.date);
 if(!date.success)return error(res,400,'Taariikh sax ah ayaa loo baahan yahay');
 const {rows}=await pool.query('SELECT a.student_id,a.attendance_date,a.status,st.full_name FROM attendance a JOIN students st ON st.school_id=a.school_id AND st.id=a.student_id WHERE a.school_id=$1 AND a.attendance_date=$2 ORDER BY st.full_name LIMIT 500',[req.schoolId,date.data]);
 res.json({attendance:rows});
}));
adminRouter.post('/attendance',roles('school_admin','exam_officer'),wrap(async(req,res)=>{
 const parsed=attendanceInput.safeParse(req.body);if(!parsed.success)return error(res,400,'Xogta xaadirinta sax ma aha');
 const {studentId,date,status}=parsed.data;
 const {rows}=await pool.query(`INSERT INTO attendance(school_id,student_id,attendance_date,status,recorded_by)
 SELECT st.school_id,st.id,$3,$4,$5 FROM students st WHERE st.school_id=$1 AND st.id=$2 AND st.is_active=true
 ON CONFLICT(school_id,student_id,attendance_date) DO UPDATE SET status=EXCLUDED.status,recorded_by=EXCLUDED.recorded_by,updated_at=now()
 RETURNING student_id,attendance_date,status`,[req.schoolId,studentId,date,status,req.userId]);
 if(!rows.length)return error(res,404,'Ardayga lama helin');
 res.json({attendance:rows[0]});
}));
adminRouter.get('/fees',roles('school_admin'),wrap(async(req,res)=>{
 const {rows}=await pool.query('SELECT id,student_id,amount,currency,reference,paid_on,created_at FROM fee_payments WHERE school_id=$1 ORDER BY created_at DESC LIMIT 200',[req.schoolId]);
 res.json({payments:rows});
}));
adminRouter.post('/fees',roles('school_admin'),wrap(async(req,res)=>{
 const parsed=feeInput.safeParse(req.body);if(!parsed.success)return error(res,400,'Xogta lacagta sax ma aha');
 const {studentId,amount,currency,reference,paidOn}=parsed.data;
 const {rows}=await pool.query(`INSERT INTO fee_payments(school_id,student_id,amount,currency,reference,paid_on,recorded_by)
 SELECT st.school_id,st.id,$3,$4,$5,$6,$7 FROM students st WHERE st.school_id=$1 AND st.id=$2 AND st.is_active=true
 RETURNING id,student_id,amount,currency,reference,paid_on`,[req.schoolId,studentId,amount,currency,reference,paidOn,req.userId]);
 if(!rows.length)return error(res,404,'Ardayga lama helin');
 res.status(201).json({payment:rows[0]});
}));

const staffInput=z.object({email:z.string().email().max(254),fullName:z.string().trim().min(2).max(200),password:z.string().min(12).max(128),role:z.enum(['school_admin','exam_officer','teacher'])});
adminRouter.get('/staff',roles('school_admin'),wrap(async(req,res)=>{
 const {rows}=await pool.query(`SELECT u.id,u.email,u.full_name,m.role,m.is_active FROM school_memberships m JOIN users u ON u.id=m.user_id WHERE m.school_id=$1 ORDER BY u.full_name`,[req.schoolId]);
 res.json({staff:rows});
}));
adminRouter.post('/staff',roles('school_admin'),wrap(async(req,res)=>{
 const parsed=staffInput.safeParse(req.body);if(!parsed.success)return error(res,400,'Xogta shaqaalaha sax ma aha');
 const {email,fullName,password,role}=parsed.data;
 const hash=await bcrypt.hash(password,12);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const existing=await client.query('SELECT id FROM users WHERE lower(email)=lower($1)',[email]);
  if(existing.rows.length){await client.query('ROLLBACK');return error(res,409,'Iimaylkan hore ayaa loo diiwaangeliyey')}
  const user=(await client.query('INSERT INTO users(email,password_hash,full_name) VALUES(lower($1),$2,$3) RETURNING id,email,full_name',[email,hash,fullName])).rows[0];
  await client.query('INSERT INTO school_memberships(school_id,user_id,role) VALUES($1,$2,$3)',[req.schoolId,user.id,role]);
  await client.query('COMMIT');
  res.status(201).json({staff:{...user,role,is_active:true}});
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}));
adminRouter.patch('/staff/:userId',roles('school_admin'),wrap(async(req,res)=>{
 const id=uuid.safeParse(req.params.userId);
 const input=z.object({role:z.enum(['school_admin','exam_officer','teacher']).optional(),isActive:z.boolean().optional()}).refine(x=>x.role!==undefined||x.isActive!==undefined).safeParse(req.body);
 if(!id.success||!input.success)return error(res,400,'Xogta shaqaalaha sax ma aha');
 if(id.data===req.userId&&input.data.isActive===false)return error(res,409,'Naftaada ma joojin kartid');
 const {rows}=await pool.query('UPDATE school_memberships SET role=COALESCE($3,role),is_active=COALESCE($4,is_active) WHERE school_id=$1 AND user_id=$2 RETURNING user_id,role,is_active',[req.schoolId,id.data,input.data.role??null,input.data.isActive??null]);
 if(!rows.length)return error(res,404,'Shaqaalaha lama helin');
 res.json({staff:rows[0]});
}));

adminRouter.get('/audit',roles('school_admin'),wrap(async(req,res)=>{
 const {rows}=await pool.query('SELECT id,actor_user_id,action,entity_type,entity_id,created_at FROM audit_events WHERE school_id=$1 ORDER BY created_at DESC LIMIT 200',[req.schoolId]);
 res.json({events:rows});
}));
