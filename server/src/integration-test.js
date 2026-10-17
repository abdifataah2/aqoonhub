import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {randomUUID} from 'node:crypto';
import {pool} from './db.js';

const origin=process.env.API_ORIGIN||'http://localhost:4000';
const suffix=randomUUID().slice(0,8);
const a='ci-a-'+suffix,b='ci-b-'+suffix;
const password='test-password-very-long';
const hash=await bcrypt.hash(password,10);
let schoolA,schoolB;
const call=async(path,body,token)=>{
 const res=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 return {status:res.status,data:await res.json()};
};
try{
 const created=await pool.query("INSERT INTO schools(slug,name) VALUES($1,'Test A'),($2,'Test B') RETURNING id,slug",[a,b]);
 schoolA=created.rows.find(x=>x.slug===a).id;schoolB=created.rows.find(x=>x.slug===b).id;
 const user=(await pool.query("INSERT INTO users(email,password_hash,full_name) VALUES($1,$2,'Test Admin') RETURNING id",['ci-'+suffix+'@example.test',hash])).rows[0];
 await pool.query("INSERT INTO school_memberships(school_id,user_id,role) VALUES($1,$2,'school_admin')",[schoolA,user.id]);
 const login=await call('/api/schools/'+a+'/login',{email:'ci-'+suffix+'@example.test',password});
 assert.equal(login.status,200,'valid credentials should login');
 const token=login.data.token;
 assert.ok(token);
 const invalid=await call('/api/schools/'+a+'/login',{email:'ci-'+suffix+'@example.test',password:'incorrect'});
 assert.equal(invalid.status,401,'wrong password must be rejected');
 const other=await fetch(origin+'/api/schools/'+b+'/admin/summary',{headers:{Authorization:'Bearer '+token}});
 assert.equal(other.status,403,'tenant A token must not access tenant B');
 const own=await fetch(origin+'/api/schools/'+a+'/admin/summary',{headers:{Authorization:'Bearer '+token}});
 assert.equal(own.status,200,'school admin should access own school');
 const klass=await call('/api/schools/'+a+'/admin/classes',{name:'Class 1',academicYear:'2026'},token);
 assert.equal(klass.status,201);
 const foreign=await fetch(origin+'/api/schools/'+b+'/admin/classes',{headers:{Authorization:'Bearer '+token}});
 assert.equal(foreign.status,403);
 const ownClasses=await fetch(origin+'/api/schools/'+a+'/admin/classes',{headers:{Authorization:'Bearer '+token}});
 assert.equal(ownClasses.status,200);
 assert.ok((await ownClasses.json()).classes.some(x=>x.id===klass.data.class.id));

 const staff=await call('/api/schools/'+a+'/admin/staff',{email:'staff-'+suffix+'@example.test',fullName:'Test Teacher',password,role:'teacher'},token);
 assert.equal(staff.status,201,'admin should create teacher');
 const staffLogin=await call('/api/schools/'+a+'/login',{email:'staff-'+suffix+'@example.test',password});
 assert.equal(staffLogin.status,200,'teacher can login');
 const forbidden=await call('/api/schools/'+a+'/admin/classes',{name:'Forbidden',academicYear:'2026'},staffLogin.data.token);
 assert.equal(forbidden.status,403,'teacher must not create classes');
 const deactivate=await fetch(origin+'/api/schools/'+a+'/admin/staff/'+staff.data.staff.id,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({isActive:false})});
 assert.equal(deactivate.status,200,'admin can deactivate staff');
 const revoked=await fetch(origin+'/api/schools/'+a+'/admin/summary',{headers:{Authorization:'Bearer '+staffLogin.data.token}});
 assert.equal(revoked.status,403,'deactivated staff token must be denied');
 console.log('Login, authorization, tenant isolation, staff permissions and revocation passed');
}finally{
 if(schoolA)await pool.query('DELETE FROM schools WHERE id=$1',[schoolA]);
 if(schoolB)await pool.query('DELETE FROM schools WHERE id=$1',[schoolB]);
 await pool.query('DELETE FROM users WHERE email=ANY($1)',[['ci-'+suffix+'@example.test','staff-'+suffix+'@example.test']]);
 await pool.end();
}
