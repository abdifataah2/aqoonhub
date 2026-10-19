import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import {pool} from './db.js';
import {adminRouter} from './admin.js';
import {platformRouter} from './platform.js';

if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32) throw new Error('JWT_SECRET must be at least 32 characters');
const app=express();
app.disable('x-powered-by');
app.use(cors({origin:process.env.FRONTEND_ORIGIN||'http://localhost:5173'}));
app.use(express.json({limit:'256kb'}));
const authLimit=rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-7',legacyHeaders:false});
const resultLimit=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false});
const fail=(res,code,message)=>res.status(code).json({error:message});
const handler=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const slugSchema=z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const loginSchema=z.object({email:z.string().email().max(254),password:z.string().min(1).max(1024)});
const resultSchema=z.object({registrationNumber:z.string().trim().min(1).max(100),pin:z.string().min(1).max(128)});
function bearer(req,res,next){
 const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
 if(!token)return fail(res,401,'Fadlan soo gal');
 try{req.user=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256'],issuer:'aqoonhub'});next()}
 catch{return fail(res,401,'Galitaankaagu wuu dhacay')}
}
async function membership(req,res,next){
 const schoolId=req.school.id;
 if(req.user.schoolId!==schoolId)return fail(res,403,'Koontadani iskuulkan ma laha');
 const {rows}=await pool.query('SELECT role FROM school_memberships WHERE school_id=$1 AND user_id=$2 AND is_active=true',[schoolId,req.user.sub]);
 if(!rows.length)return fail(res,403,'Uma lihid oggolaansho iskuulkan');
 req.role=rows[0].role;next();
}
const school=handler(async(req,res,next)=>{
 const parsed=slugSchema.safeParse(req.params.slug);
 if(!parsed.success)return fail(res,404,'Iskuulka lama helin');
 const {rows}=await pool.query('SELECT id,slug,name,logo_url,brand_color FROM schools WHERE slug=$1 AND is_active=true',[parsed.data]);
 if(!rows.length)return fail(res,404,'Iskuulka lama helin');
 req.school=rows[0];next();
});
app.get('/api/health',(_req,res)=>res.json({status:'ok'}));
app.get('/api/schools',handler(async(_req,res)=>{
 const {rows}=await pool.query('SELECT slug,name,logo_url,brand_color FROM schools WHERE is_active=true ORDER BY name');
 res.json({schools:rows});
}));
app.get('/api/schools/:slug',school,(req,res)=>res.json({school:req.school}));
app.post('/api/schools/:slug/login',authLimit,school,handler(async(req,res)=>{
 const parsed=loginSchema.safeParse(req.body);
 if(!parsed.success)return fail(res,400,'Xogta galitaanka sax ma aha');
 const {email,password}=parsed.data;
 const {rows}=await pool.query(`SELECT u.id,u.email,u.full_name,u.password_hash,m.role
 FROM users u JOIN school_memberships m ON m.user_id=u.id
 WHERE lower(u.email)=lower($1) AND m.school_id=$2 AND m.is_active=true`,[email,req.school.id]);
 // Same cost for unknown users; do not leak account existence.
 const dummy='$2a$12$abcdefghijklmnopqrstuuIixDgIhvdf2b6f8wE8V4U9QKPMJYwYK';
 const valid=await bcrypt.compare(password,rows[0]?.password_hash||dummy);
 if(!rows.length||!valid)return fail(res,401,'Iimaylka ama furaha sirta waa khalad');
 const user=rows[0];
 const token=jwt.sign({sub:user.id,schoolId:req.school.id,role:user.role},process.env.JWT_SECRET,{algorithm:'HS256',issuer:'aqoonhub',expiresIn:'2h'});
 res.json({token,user:{id:user.id,email:user.email,name:user.full_name,role:user.role},school:req.school});
}));
app.get('/api/schools/:slug/me',school,bearer,handler(membership),(req,res)=>{
 if(req.user.schoolId!==req.school.id)return fail(res,403,'Koontadani iskuulkan ma laha');
 res.json({school:req.school,role:req.role,userId:req.user.sub});
});
app.post('/api/schools/:slug/results/verify',resultLimit,school,handler(async(req,res)=>{
 const parsed=resultSchema.safeParse(req.body);
 if(!parsed.success)return fail(res,400,'Xogta natiijada sax ma aha');
 const {registrationNumber,pin}=parsed.data;
 const {rows}=await pool.query('SELECT id,full_name,result_pin_hash FROM students WHERE school_id=$1 AND registration_number=$2 AND is_active=true',[req.school.id,registrationNumber]);
 const dummy='$2a$12$abcdefghijklmnopqrstuuIixDgIhvdf2b6f8wE8V4U9QKPMJYwYK';
 const valid=await bcrypt.compare(pin,rows[0]?.result_pin_hash||dummy);
 if(!rows.length||!valid)return fail(res,404,'Natiijo la heli karo ma jirto');
 const student=rows[0];
 const exams=await pool.query(`SELECT e.id,e.title,e.academic_year,m.subject_id,sub.name AS subject,m.score,m.max_score
 FROM exams e JOIN exam_marks m ON m.school_id=e.school_id AND m.exam_id=e.id
 JOIN subjects sub ON sub.school_id=m.school_id AND sub.id=m.subject_id
 JOIN students st ON st.id=m.student_id AND st.school_id=m.school_id
 WHERE e.school_id=$1 AND st.id=$2 AND e.status='published' AND e.published_at IS NOT NULL
 AND e.class_id=st.class_id ORDER BY e.published_at DESC,sub.name`,[req.school.id,student.id]);
 if(!exams.rows.length)return fail(res,404,'Natiijo la heli karo ma jirto');
 const grouped=new Map();
 for(const r of exams.rows){
  if(!grouped.has(r.id))grouped.set(r.id,{id:r.id,title:r.title,academicYear:r.academic_year,marks:[]});
  grouped.get(r.id).marks.push({subject:r.subject,score:Number(r.score),maxScore:Number(r.max_score)});
 }
 res.set('Cache-Control','no-store');
 res.json({student:{name:student.full_name,registrationNumber:registrationNumber},exams:[...grouped.values()]});
}));
app.post('/api/schools/:slug/student-login',resultLimit,school,handler(async(req,res)=>{
 const p=z.object({registrationNumber:z.string().trim().min(1).max(100)}).safeParse(req.body);
 if(!p.success)return fail(res,400,'Reg-Number sax ah geli');
 const {rows}=await pool.query('SELECT id,full_name,registration_number,class_id FROM students WHERE school_id=$1 AND registration_number=$2 AND is_active=true',[req.school.id,p.data.registrationNumber]);
 if(!rows.length)return fail(res,404,'Ardayga lama helin');
 const student=rows[0];
 const exams=await pool.query(`SELECT e.id,e.title,e.academic_year,sub.name AS subject,m.score,m.max_score
 FROM exams e JOIN exam_marks m ON m.school_id=e.school_id AND m.exam_id=e.id AND m.student_id=$2
 JOIN subjects sub ON sub.school_id=m.school_id AND sub.id=m.subject_id
 WHERE e.school_id=$1 AND e.class_id=$3 AND e.status='published' AND e.published_at IS NOT NULL
 ORDER BY e.published_at DESC,sub.name`,[req.school.id,student.id,student.class_id]);
 const grouped=new Map();
 for(const row of exams.rows){if(!grouped.has(row.id))grouped.set(row.id,{id:row.id,title:row.title,academicYear:row.academic_year,marks:[]});
 grouped.get(row.id).marks.push({subject:row.subject,score:Number(row.score),maxScore:Number(row.max_score)});}
 res.set('Cache-Control','no-store').json({student:{name:student.full_name,registrationNumber:student.registration_number},exams:[...grouped.values()]});
}));
app.use('/api/schools/:slug/admin/students/import.xlsx',express.raw({type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',limit:'2mb'}));
app.use('/api/schools/:slug/admin',adminRouter);
app.use('/api/platform',platformRouter);
app.use((err,_req,res,_next)=>{console.error(err);fail(res,500,'Cilad server ayaa dhacday')});
app.listen(Number(process.env.PORT||4000),()=>console.log('AqoonHub API listening'));
