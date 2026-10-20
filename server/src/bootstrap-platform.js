import bcrypt from 'bcryptjs';
import {pool} from './db.js';
const email=process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password=process.env.BOOTSTRAP_ADMIN_PASSWORD;
if(!email||!password||password.length<12)throw new Error('Provide BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (12+ characters)');
try{
 const existing=await pool.query('SELECT count(*)::int AS n FROM users WHERE is_platform_admin=true');
 if(existing.rows[0].n>0)throw new Error('Platform admin already exists. Bootstrap disabled.');
 const hash=await bcrypt.hash(password,12);
 await pool.query("INSERT INTO users(email,full_name,password_hash,is_platform_admin) VALUES($1,'Somskill Super Admin',$2,true)",[email,hash]);
 console.log('Super Admin created. Open /platform and sign in.');
}finally{await pool.end()}
