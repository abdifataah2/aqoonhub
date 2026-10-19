import {Router} from 'express';
import {z} from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {rateLimit} from 'express-rate-limit';
import {pool} from './db.js';
export const platformRouter=Router();
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const fail=(res,status,error)=>res.status(status).json({error});
const limit=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false});
const login=z.object({email:z.string().email(),password:z.string().min(1)});
const school=z.object({name:z.string().trim().min(2).max(200),slug:z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),adminName:z.string().trim().min(2).max(200),adminEmail:z.string().email(),adminPassword:z.string().min(12).max(128)});
platformRouter.post('/login',limit,wrap(async(req,res)=>{
 const parsed=login.safeParse(req.body);if(!parsed.success)return fail(res,400,'Xogta galitaanka sax ma aha');
 const {rows}=await pool.query('SELECT id,email,password_hash,full_name FROM users WHERE lower(email)=lower($1) AND is_platform_admin=true',[parsed.data.email]);
 const dummy='$2a$12$abcdefghijklmnopqrstuuIixDgIhvdf2b6f8wE8V4U9QKPMJYwYK';
 const ok=await bcrypt.compare(parsed.data.password,rows[0]?.password_hash||dummy);
 if(!ok||!rows.length)return fail(res,401,'Email ama password khaldan');
 const token=jwt.sign({sub:rows[0].id,platform:true},process.env.JWT_SECRET,{algorithm:'HS256',issuer:'aqoonhub',expiresIn:'2h'});
 res.set('Cache-Control','no-store').json({token,name:rows[0].full_name});
}));
platformRouter.use(wrap(async(req,res,next)=>{
 const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)return fail(res,401,'Fadlan soo gal');
 let claims;try{claims=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256'],issuer:'aqoonhub'})}catch{return fail(res,401,'Galitaankaagu wuu dhacay')}
 if(!claims.platform)return fail(res,403,'Ma tihid Super Admin');
 const {rows}=await pool.query('SELECT id FROM users WHERE id=$1 AND is_platform_admin=true',[claims.sub]);
 if(!rows.length)return fail(res,403,'Ma tihid Super Admin');req.platformId=rows[0].id;next();
}));
platformRouter.get('/schools',wrap(async(_req,res)=>{
 const {rows}=await pool.query('SELECT s.id,s.name,s.slug,s.is_active,count(m.user_id)::int AS staff_count FROM schools s LEFT JOIN school_memberships m ON m.school_id=s.id GROUP BY s.id ORDER BY s.created_at DESC');
 res.json({schools:rows});
}));
platformRouter.post('/schools',wrap(async(req,res)=>{
 const parsed=school.safeParse(req.body);if(!parsed.success)return fail(res,400,'Xogta iskuulka ama password-ka sax ma aha');
 const d=parsed.data;const hash=await bcrypt.hash(d.adminPassword,12);const client=await pool.connect();
 try{
 await client.query('BEGIN');
 const found=await client.query('SELECT id FROM users WHERE lower(email)=lower($1)',[d.adminEmail]);
 if(found.rows.length){await client.query('ROLLBACK');return fail(res,409,'Email-ka maamulaha hore ayaa loo isticmaalay')}
 const schoolRow=(await client.query('INSERT INTO schools(name,slug) VALUES($1,$2) RETURNING id,name,slug',[d.name,d.slug])).rows[0];
 const user=(await client.query('INSERT INTO users(email,full_name,password_hash) VALUES(lower($1),$2,$3) RETURNING id',[d.adminEmail,d.adminName,hash])).rows[0];
 await client.query("INSERT INTO school_memberships(school_id,user_id,role) VALUES($1,$2,'school_admin')",[schoolRow.id,user.id]);
 await client.query('COMMIT');res.status(201).json({school:schoolRow});
 }catch(e){await client.query('ROLLBACK');if(e.code==='23505')return fail(res,409,'Slug ama email-kan hore ayaa loo isticmaalay');throw e}finally{client.release()}
}));

platformRouter.patch('/schools/:id',wrap(async(req,res)=>{
 const id=z.string().uuid().safeParse(req.params.id);
 const input=z.object({isActive:z.boolean()}).safeParse(req.body);
 if(!id.success||!input.success)return fail(res,400,'Xogta iskuulka sax ma aha');
 const {rows}=await pool.query('UPDATE schools SET is_active=$2 WHERE id=$1 RETURNING id,name,slug,is_active',[id.data,input.data.isActive]);
 if(!rows.length)return fail(res,404,'Iskuulka lama helin');
 res.json({school:rows[0]});
}));
