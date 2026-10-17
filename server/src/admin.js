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
adminRouter.get('/students',wrap(async(req,res)=>{
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
adminRouter.post('/exams/:examId/marks',roles('school_admin','exam_officer','teacher'),wrap(async(req,res)=>{
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
