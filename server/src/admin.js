import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
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
const studentInput=z.object({classId:uuid,registrationNumber:z.string().trim().min(1).max(100),fullName:z.string().trim().min(1).max(200),resultPin:z.string().min(6).max(128).optional()});
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
 const {rows}=await pool.query(`SELECT id,name,academic_year FROM classes WHERE school_id=$1 AND ($2 <> 'teacher' OR id IN (SELECT class_id FROM teacher_assignments WHERE school_id=$1 AND teacher_id=$3)) ORDER BY name`,[req.schoolId,req.role,req.userId]);
 res.json({classes:rows});
}));
adminRouter.post('/classes',roles('school_admin'),wrap(async(req,res)=>{
 const data=classInput.safeParse(req.body);if(!data.success)return error(res,400,'Xogta fasalka sax ma aha');
 const {rows}=await pool.query('INSERT INTO classes(school_id,name,academic_year) VALUES($1,$2,$3) RETURNING id,name,academic_year',[req.schoolId,data.data.name,data.data.academicYear]);
 res.status(201).json({class:rows[0]});
}));
adminRouter.get('/students',roles('school_admin','exam_officer','teacher'),wrap(async(req,res)=>{
 const {rows}=await pool.query(`SELECT id,class_id,registration_number,full_name,is_active FROM students WHERE school_id=$1 AND ($2 <> 'teacher' OR class_id IN (SELECT class_id FROM teacher_assignments WHERE school_id=$1 AND teacher_id=$3)) ORDER BY registration_number LIMIT 200`,[req.schoolId,req.role,req.userId]);
 res.json({students:rows});
}));
adminRouter.post('/students',roles('school_admin'),wrap(async(req,res)=>{
 const data=studentInput.safeParse(req.body);if(!data.success)return error(res,400,'Xogta ardayga sax ma aha; PIN-ku waa inuu leeyahay ugu yaraan 6 xaraf');
 const {classId,registrationNumber,fullName,resultPin}=data.data;
 const hash=await bcrypt.hash(resultPin||crypto.randomUUID(),12);
 const {rows}=await pool.query(`INSERT INTO students(school_id,class_id,registration_number,full_name,result_pin_hash)
 VALUES($1,$2,$3,$4,$5) RETURNING id,class_id,registration_number,full_name`,[req.schoolId,classId,registrationNumber,fullName,hash]);
 res.status(201).json({student:rows[0]});
}));
adminRouter.get('/subjects',wrap(async(req,res)=>{
 const {rows}=await pool.query(`SELECT id,name FROM subjects WHERE school_id=$1 AND ($2 <> 'teacher' OR id IN (SELECT subject_id FROM teacher_assignments WHERE school_id=$1 AND teacher_id=$3)) ORDER BY name`,[req.schoolId,req.role,req.userId]);
 res.json({subjects:rows});
}));
adminRouter.post('/subjects',roles('school_admin'),wrap(async(req,res)=>{
 const data=subjectInput.safeParse(req.body);if(!data.success)return error(res,400,'Xogta maaddada sax ma aha');
 const {rows}=await pool.query('INSERT INTO subjects(school_id,name) VALUES($1,$2) RETURNING id,name',[req.schoolId,data.data.name]);
 res.status(201).json({subject:rows[0]});
}));
adminRouter.get('/exams',wrap(async(req,res)=>{
 const {rows}=await pool.query(`SELECT id,class_id,title,academic_year,status,published_at FROM exams WHERE school_id=$1 AND ($2 <> 'teacher' OR class_id IN (SELECT class_id FROM teacher_assignments WHERE school_id=$1 AND teacher_id=$3)) ORDER BY created_at DESC`,[req.schoolId,req.role,req.userId]);
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
 AND EXISTS(SELECT 1 FROM class_subjects cs WHERE cs.school_id=e.school_id AND cs.class_id=e.class_id AND cs.subject_id=sub.id)
 AND ($8 <> 'teacher' OR EXISTS(SELECT 1 FROM teacher_assignments ta WHERE ta.school_id=e.school_id AND ta.class_id=e.class_id AND ta.subject_id=sub.id AND ta.teacher_id=$7))
 ON CONFLICT(school_id,exam_id,student_id,subject_id)
 DO UPDATE SET score=EXCLUDED.score,max_score=EXCLUDED.max_score,entered_by=EXCLUDED.entered_by,updated_at=now()
 RETURNING exam_id,student_id,subject_id,score,max_score`,[req.schoolId,id.data,studentId,subjectId,score,maxScore,req.userId,req.role]);
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
adminRouter.get('/attendance',roles('school_admin','exam_officer','teacher'),wrap(async(req,res)=>{
 const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(req.query.date);
 if(!date.success)return error(res,400,'Taariikh sax ah ayaa loo baahan yahay');
 const {rows}=await pool.query(`SELECT a.student_id,a.attendance_date,a.status,st.full_name FROM attendance a JOIN students st ON st.school_id=a.school_id AND st.id=a.student_id WHERE a.school_id=$1 AND a.attendance_date=$2 AND ($3 <> 'teacher' OR st.class_id IN (SELECT class_id FROM teacher_assignments WHERE school_id=$1 AND teacher_id=$4)) ORDER BY st.full_name LIMIT 500`,[req.schoolId,date.data,req.role,req.userId]);
 res.json({attendance:rows});
}));
adminRouter.post('/attendance',roles('school_admin','exam_officer','teacher'),wrap(async(req,res)=>{
 const parsed=attendanceInput.safeParse(req.body);if(!parsed.success)return error(res,400,'Xogta xaadirinta sax ma aha');
 const {studentId,date,status}=parsed.data;
 const {rows}=await pool.query(`INSERT INTO attendance(school_id,student_id,attendance_date,status,recorded_by)
 SELECT st.school_id,st.id,$3,$4,$5 FROM students st WHERE st.school_id=$1 AND st.id=$2 AND st.is_active=true AND ($6 <> 'teacher' OR st.class_id IN (SELECT class_id FROM teacher_assignments WHERE school_id=$1 AND teacher_id=$5))
 ON CONFLICT(school_id,student_id,attendance_date) DO UPDATE SET status=EXCLUDED.status,recorded_by=EXCLUDED.recorded_by,updated_at=now()
 RETURNING student_id,attendance_date,status`,[req.schoolId,studentId,date,status,req.userId,req.role]);
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

const assignment=z.object({classId:uuid,subjectId:uuid});
const teacherAssignment=assignment.extend({teacherId:uuid});
adminRouter.get('/class-subjects',wrap(async(req,res)=>{
 const {rows}=await pool.query(`SELECT class_id,subject_id FROM class_subjects WHERE school_id=$1 AND ($2 <> 'teacher' OR EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.school_id=$1 AND ta.class_id=class_subjects.class_id AND ta.subject_id=class_subjects.subject_id AND ta.teacher_id=$3)) ORDER BY class_id,subject_id`,[req.schoolId,req.role,req.userId]);res.json({assignments:rows});
}));
adminRouter.post('/class-subjects',roles('school_admin'),wrap(async(req,res)=>{
 const p=assignment.safeParse(req.body);if(!p.success)return error(res,400,'Fasalka ama maaddada sax ma aha');
 const {rows}=await pool.query(`INSERT INTO class_subjects(school_id,class_id,subject_id)
 SELECT c.school_id,c.id,s.id FROM classes c JOIN subjects s ON s.school_id=c.school_id
 WHERE c.school_id=$1 AND c.id=$2 AND s.id=$3 ON CONFLICT DO NOTHING RETURNING class_id,subject_id`,[req.schoolId,p.data.classId,p.data.subjectId]);
 if(!rows.length)return error(res,409,'Maaddadan waa la qoondeeyey ama fasalka lama helin');res.status(201).json({assignment:rows[0]});
}));
adminRouter.get('/teacher-assignments',wrap(async(req,res)=>{
 const {rows}=await pool.query('SELECT class_id,subject_id,teacher_id FROM teacher_assignments WHERE school_id=$1 AND ($2 <> \'teacher\' OR teacher_id=$3)',[req.schoolId,req.role,req.userId]);res.json({assignments:rows});
}));
adminRouter.post('/teacher-assignments',roles('school_admin'),wrap(async(req,res)=>{
 const p=teacherAssignment.safeParse(req.body);if(!p.success)return error(res,400,'Xogta macallinka sax ma aha');
 const {rows}=await pool.query(`INSERT INTO teacher_assignments(school_id,class_id,subject_id,teacher_id)
 SELECT cs.school_id,cs.class_id,cs.subject_id,m.user_id FROM class_subjects cs
 JOIN school_memberships m ON m.school_id=cs.school_id AND m.user_id=$4 AND m.role='teacher' AND m.is_active=true
 WHERE cs.school_id=$1 AND cs.class_id=$2 AND cs.subject_id=$3
 ON CONFLICT DO NOTHING RETURNING class_id,subject_id,teacher_id`,[req.schoolId,p.data.classId,p.data.subjectId,p.data.teacherId]);
 if(!rows.length)return error(res,409,'Macallinka lama helin ama horay ayaa loo qoondeeyey');res.status(201).json({assignment:rows[0]});
}));
adminRouter.get('/students/export',roles('school_admin'),wrap(async(req,res)=>{
 const {rows}=await pool.query(`SELECT st.registration_number,st.full_name,c.name AS class_name,c.academic_year FROM students st JOIN classes c ON c.id=st.class_id AND c.school_id=st.school_id WHERE st.school_id=$1 ORDER BY st.registration_number`,[req.schoolId]);
 res.json({students:rows});
}));
const bulkRows=z.array(z.object({registrationNumber:z.string().trim().min(1).max(100),fullName:z.string().trim().min(1).max(200),classId:uuid})).min(1).max(500);
async function importStudents(schoolId,students){
 const unique=new Set(students.map(s=>s.registrationNumber));if(unique.size!==students.length)throw new Error('Reg-Number isku mid ah ayaa faylka ku jira');
 const client=await pool.connect();
 try{await client.query('BEGIN');
 for(const st of students){
  const result=await client.query(`INSERT INTO students(school_id,class_id,registration_number,full_name,result_pin_hash)
 SELECT c.school_id,c.id,$3,$4,$5 FROM classes c WHERE c.school_id=$1 AND c.id=$2
 ON CONFLICT(school_id,registration_number) DO NOTHING RETURNING id`,[schoolId,st.classId,st.registrationNumber,st.fullName,await bcrypt.hash(crypto.randomUUID(),12)]);
  if(!result.rowCount)throw new Error('Fasal aan jirin ama Reg-Number hore loo isticmaalay: '+st.registrationNumber);
 }
 await client.query('COMMIT');return students.length;
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
adminRouter.get('/students/template.xlsx',roles('school_admin'),wrap(async(req,res)=>{
 const {rows}=await pool.query('SELECT id,name,academic_year FROM classes WHERE school_id=$1 ORDER BY name',[req.schoolId]);
 const workbook=new ExcelJS.Workbook();const students=workbook.addWorksheet('Students');
 students.columns=[{header:'registrationNumber',key:'registrationNumber',width:26},{header:'fullName',key:'fullName',width:40},{header:'classId',key:'classId',width:40}];
 students.getRow(1).font={bold:true};
 const classes=workbook.addWorksheet('Classes');classes.columns=[{header:'classId',key:'id',width:40},{header:'className',key:'name',width:30},{header:'academicYear',key:'academic_year',width:22}];classes.addRows(rows);classes.getRow(1).font={bold:true};
 res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 res.set('Content-Disposition','attachment; filename="aqoonhub-student-template.xlsx"');
 res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
}));
adminRouter.get('/students/export.xlsx',roles('school_admin'),wrap(async(req,res)=>{
 const {rows}=await pool.query('SELECT st.registration_number,st.full_name,st.class_id FROM students st WHERE st.school_id=$1 ORDER BY st.registration_number',[req.schoolId]);
 const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('Ardayda');
 ws.columns=[{header:'registrationNumber',key:'registration_number',width:24},{header:'fullName',key:'full_name',width:40},{header:'classId',key:'class_id',width:40}];
 ws.addRows(rows);ws.getRow(1).font={bold:true};const buffer=await wb.xlsx.writeBuffer();
 res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 res.set('Content-Disposition','attachment; filename="aqoonhub-students.xlsx"');res.send(Buffer.from(buffer));
}));
adminRouter.post('/students/import.xlsx',roles('school_admin'),wrap(async(req,res)=>{
 if(!Buffer.isBuffer(req.body)||req.body.length<10||req.body.length>2*1024*1024)return error(res,400,'Faylka Excel sax ma aha (ugu badnaan 2 MB)');
 let workbook;
 try{workbook=new ExcelJS.Workbook();await workbook.xlsx.load(req.body)}catch{return error(res,400,'Faylka .xlsx ma furmayo')}
 const sheet=workbook.worksheets[0];if(!sheet)return error(res,400,'Excel sheet ma jiro');
 const headers=[1,2,3].map(i=>String(sheet.getRow(1).getCell(i).text||'').trim());
 if(headers.join('|')!=='registrationNumber|fullName|classId')return error(res,400,'Excel columns waa inay noqdaan registrationNumber, fullName, classId');
 const students=[];for(let row=2;row<=sheet.rowCount;row++){
 const r=sheet.getRow(row);if([1,2,3].every(i=>!r.getCell(i).text.trim()))continue;
 students.push({registrationNumber:r.getCell(1).text.trim(),fullName:r.getCell(2).text.trim(),classId:r.getCell(3).text.trim()});
 if(students.length>500)return error(res,400,'Hal mar ugu badnaan 500 arday');
 }
 const parsed=bulkRows.safeParse(students);if(!parsed.success)return error(res,400,'Xogta Excel sax ma aha');
 try{const added=await importStudents(req.schoolId,parsed.data);res.status(201).json({added})}
 catch(e){return error(res,409,e.message)}
}));
const importSchema=z.object({students:bulkRows});
adminRouter.post('/students/import',roles('school_admin'),wrap(async(req,res)=>{
 const p=importSchema.safeParse(req.body);if(!p.success)return error(res,400,'Faylka ardayda sax ma aha (ugu badnaan 500)');
 try{const added=await importStudents(req.schoolId,p.data.students);res.status(201).json({added})}
 catch(e){return error(res,409,e.message)}
}));

const studentUpdate=z.object({fullName:z.string().trim().min(1).max(200).optional(),classId:uuid.optional(),registrationNumber:z.string().trim().min(1).max(100).optional(),isActive:z.boolean().optional()}).refine(x=>Object.keys(x).length>0);
adminRouter.patch('/students/:id',roles('school_admin'),wrap(async(req,res)=>{
 const id=uuid.safeParse(req.params.id),p=studentUpdate.safeParse(req.body);if(!id.success||!p.success)return error(res,400,'Xogta ardayga sax ma aha');
 const d=p.data;
 const {rows}=await pool.query(`UPDATE students st SET full_name=COALESCE($3,full_name),class_id=COALESCE($4,class_id),registration_number=COALESCE($5,registration_number),is_active=COALESCE($6,is_active)
 WHERE st.school_id=$1 AND st.id=$2 AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM classes c WHERE c.school_id=$1 AND c.id=$4))
 RETURNING id,full_name,class_id,registration_number,is_active`,[req.schoolId,id.data,d.fullName??null,d.classId??null,d.registrationNumber??null,d.isActive??null]);
 if(!rows.length)return error(res,404,'Ardayga ama fasalka lama helin');res.json({student:rows[0]});
}));
adminRouter.patch('/staff/:userId/password',roles('school_admin'),wrap(async(req,res)=>{
 const id=uuid.safeParse(req.params.userId),p=z.object({password:z.string().min(12).max(128)}).safeParse(req.body);
 if(!id.success||!p.success)return error(res,400,'Password-ku waa inuu leeyahay 12 xaraf ama ka badan');
 const hash=await bcrypt.hash(p.data.password,12);
 const {rows}=await pool.query(`UPDATE users u SET password_hash=$3 WHERE u.id=$2
 AND EXISTS(SELECT 1 FROM school_memberships m WHERE m.user_id=u.id AND m.school_id=$1 AND m.is_active=true)
 AND u.is_platform_admin=false RETURNING u.id`,[req.schoolId,id.data,hash]);
 if(!rows.length)return error(res,404,'Shaqaalaha lama helin');res.json({updated:true});
}));
