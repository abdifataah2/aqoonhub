import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {pool} from './db.js';
const {SEED_SCHOOL_SLUG:slug,SEED_SCHOOL_NAME:name,SEED_ADMIN_EMAIL:email,SEED_ADMIN_PASSWORD:password}=process.env;
if(!slug||!name||!email||!password||password.length<12) throw new Error('Set seed variables and password >= 12 chars');
const client=await pool.connect();
try{
 await client.query('BEGIN');
 const school=(await client.query('INSERT INTO schools(slug,name) VALUES($1,$2) ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id',[slug,name])).rows[0];
 const hash=await bcrypt.hash(password,12);
 const user=(await client.query('INSERT INTO users(email,password_hash,full_name) VALUES(lower($1),$2,$3) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id',[email,hash,'Maamulaha Iskuulka'])).rows[0];
 await client.query("INSERT INTO school_memberships(school_id,user_id,role) VALUES($1,$2,'school_admin') ON CONFLICT(school_id,user_id) DO UPDATE SET role='school_admin',is_active=true",[school.id,user.id]);
 if(process.env.SEED_PLATFORM_EMAIL && process.env.SEED_PLATFORM_PASSWORD){
  if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(process.env.SEED_PLATFORM_EMAIL)||process.env.SEED_PLATFORM_PASSWORD.length<12)throw new Error('Platform admin email/password invalid');
  const platformHash=await bcrypt.hash(process.env.SEED_PLATFORM_PASSWORD,12);
  await client.query("INSERT INTO users(email,password_hash,full_name,is_platform_admin) VALUES(lower($1),$2,'AqoonHub Super Admin',true) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,is_platform_admin=true",[process.env.SEED_PLATFORM_EMAIL,platformHash]);
 }
 await client.query('COMMIT');
 console.log('Development school/admin ready:',slug,email);
}catch(e){await client.query('ROLLBACK');console.error(e);process.exitCode=1}finally{client.release();await pool.end()}
