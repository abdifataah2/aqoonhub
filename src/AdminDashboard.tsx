import React from 'react';
import {Link,useParams} from 'react-router-dom';
type LoginReply={token:string;user:{name:string;role:string;email:string};school:{name:string;slug:string}};
type Data={summary:{students:number;classes:number;exams:number;teachers:number};classes:{id:string;name:string;academic_year:string}[];students:{id:string;full_name:string;registration_number:string;class_id:string}[];subjects:{id:string;name:string}[];exams:{id:string;title:string;status:string;class_id:string}[]};
const base=(slug:string)=>`/api/schools/${encodeURIComponent(slug)}/admin`;
export function AdminDashboard({session,onLogout}:{session:LoginReply;onLogout:()=>void}){
 const {slug}=useParams();const [data,setData]=React.useState<Data|null>(null);
 const [error,setError]=React.useState('');const [message,setMessage]=React.useState('');
 const [busy,setBusy]=React.useState(false);
 const logoutRef=React.useRef(onLogout);logoutRef.current=onLogout;
 const [section,setSection]=React.useState<'classes'|'students'|'subjects'|'exams'|'attendance'|'fees'|'staff'|'audit'>('classes');
 const [date,setDate]=React.useState(new Date().toISOString().slice(0,10));const [attendanceStatus,setAttendanceStatus]=React.useState('present');
 const [amount,setAmount]=React.useState('');const [currency,setCurrency]=React.useState('USD');const [reference,setReference]=React.useState('');
 const [name,setName]=React.useState('');const [year,setYear]=React.useState('2026-2027');
 const [classId,setClassId]=React.useState('');const [registration,setRegistration]=React.useState('');const [pin,setPin]=React.useState('');
 const [subjectId,setSubjectId]=React.useState('');const [studentId,setStudentId]=React.useState('');
 const [score,setScore]=React.useState('');const [maxScore,setMaxScore]=React.useState('100');
 const [examId,setExamId]=React.useState('');
 const [staff,setStaff]=React.useState<{id:string;email:string;full_name:string;role:string;is_active:boolean}[]>([]);
 const [audit,setAudit]=React.useState<{id:string;action:string;entity_type:string;created_at:string}[]>([]);
 const [staffEmail,setStaffEmail]=React.useState('');const [staffPassword,setStaffPassword]=React.useState('');const [staffRole,setStaffRole]=React.useState('teacher');
 const isAdmin=session.user.role==='school_admin';
 const canExam=isAdmin||session.user.role==='exam_officer';
 const api=React.useCallback(async(path:string,init?:RequestInit)=>{
  const response=await fetch(base(slug||'')+path,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.token}`,...init?.headers},cache:'no-store'});
  const body=await response.json().catch(()=>({}));
  if(response.status===401){logoutRef.current();throw new Error('Fadhigaagu wuu dhacay; fadlan mar kale soo gal')}
  if(!response.ok)throw new Error(body.error||'Codsiga wuu fashilmay');
  return body;
 },[slug,session.token]);
 const refresh=React.useCallback(async()=>{
  const [a,b,c,d,e]=await Promise.all([api('/summary'),api('/classes'),session.user.role==='teacher'?Promise.resolve({students:[]}):api('/students'),api('/subjects'),api('/exams')]);
  if(session.user.role==='school_admin'){const [staffReply,auditReply]=await Promise.all([api('/staff'),api('/audit')]);setStaff(staffReply.staff);setAudit(auditReply.events)}
  setData({summary:a.summary,classes:b.classes,students:c.students,subjects:d.subjects,exams:e.exams});
 },[api,session.user.role]);
 React.useEffect(()=>{refresh().catch(e=>setError(e.message))},[refresh]);
 async function send(path:string,body?:object){
  setBusy(true);setError('');setMessage('');
  try{await api(path,{method:'POST',body:JSON.stringify(body||{})});await refresh();setMessage('Xogta waa la kaydiyey');setName('');setRegistration('');setPin('');setScore('')}
  catch(e){setError(e instanceof Error?e.message:'Cilad ayaa dhacday')}
  finally{setBusy(false)}
 }
 return <main className="form-area"><div className="form-card" style={{maxWidth:900,width:'100%'}}>
 <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><h1>Maamulka {session.school.name}</h1><p>{session.user.name} · {session.user.role}</p></div><div><Link to={`/s/${slug}`}>Bogga iskuulka</Link> · <button onClick={onLogout}>Ka bax</button></div></div>
 <div className="notice">Nidaamkan weli waa horumarin. Ha gelin xogta dhabta ah ee ardayda.</div>
 {error&&<div role="alert" className="notice">{error}</div>}{message&&<p role="status">{message}</p>}
 {data?<><div className="metric-grid">{[['Arday',data.summary.students],['Fasallo',data.summary.classes],['Imtixaanno',data.summary.exams],['Macallimiin',data.summary.teachers]].map(([label,count])=><div className="metric" key={label}><p>{label}</p><strong>{count}</strong></div>)}</div>
 <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'22px 0'}}>{([['classes','Fasallada'],['students','Ardayda'],['subjects','Maaddooyinka'],['exams','Imtixaannada'],['attendance','Xaadirinta'],['fees','Maaliyadda'],...(isAdmin?[['staff','Shaqaalaha'],['audit','Diiwaanka isbeddellada']] as const:[])] as const).map(([key,label])=><button key={key} className={section===key?'primary':''} onClick={()=>setSection(key)}>{label}</button>)}</div>
 {section==='classes'&&<><h2>Fasallada</h2>{data.classes.map(c=><p key={c.id}>{c.name} — {c.academic_year}</p>)}{isAdmin&&<form onSubmit={e=>{e.preventDefault();send('/classes',{name,academicYear:year})}}><label>Magaca fasalka<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Sanad dugsiyeed<input required value={year} onChange={e=>setYear(e.target.value)}/></label><button className="primary" disabled={busy}>Ku dar fasal</button></form>}</>}
 {section==='students'&&<><h2>Ardayda</h2>{data.students.map(s=><p key={s.id}>{s.registration_number} — {s.full_name}</p>)}{isAdmin&&<form onSubmit={e=>{e.preventDefault();send('/students',{classId,registrationNumber:registration,fullName:name,resultPin:pin})}}><label>Fasalka<select required value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Dooro fasal</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Lambarka diiwaangelinta<input required value={registration} onChange={e=>setRegistration(e.target.value)}/></label><label>Magaca ardayga<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>PIN gaar ah (ugu yaraan 6 xaraf)<input type="password" minLength={6} required value={pin} onChange={e=>setPin(e.target.value)}/></label><button className="primary" disabled={busy}>Diiwaangeli arday</button></form>}</>}
 {section==='subjects'&&<><h2>Maaddooyinka</h2>{data.subjects.map(s=><p key={s.id}>{s.name}</p>)}{isAdmin&&<form onSubmit={e=>{e.preventDefault();send('/subjects',{name})}}><label>Magaca maaddada<input required value={name} onChange={e=>setName(e.target.value)}/></label><button className="primary" disabled={busy}>Ku dar maaddo</button></form>}</>}
 {section==='exams'&&<><h2>Imtixaannada</h2>{data.exams.map(ex=><p key={ex.id}>{ex.title} — {ex.status} {canExam&&ex.status==='draft'&&<button disabled={busy} onClick={()=>send(`/exams/${ex.id}/submit`)}>Gudbi review</button>} {canExam&&ex.status==='review'&&<button disabled={busy} onClick={()=>send(`/exams/${ex.id}/publish`)}>Daabac</button>}</p>)}{canExam&&<form onSubmit={e=>{e.preventDefault();send('/exams',{classId,title:name,academicYear:year})}}><label>Fasalka<select required value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Dooro fasal</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Magaca imtixaanka<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Sanad dugsiyeed<input required value={year} onChange={e=>setYear(e.target.value)}/></label><button className="primary" disabled={busy}>Abuur imtixaan</button></form>}
 {canExam&&<><h3>Geli dhibcaha imtixaan draft ah</h3><form onSubmit={e=>{e.preventDefault();send(`/exams/${examId}/marks`,{studentId,subjectId,score:Number(score),maxScore:Number(maxScore)})}}>
 <label>Imtixaanka<select required value={examId} onChange={e=>setExamId(e.target.value)}><option value="">Dooro imtixaan</option>{data.exams.filter(e=>e.status==='draft').map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
 <label>Ardayga<select required value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Dooro arday</option>{data.students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label>
 <label>Maaddada<select required value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">Dooro maaddo</option>{data.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 <label>Dhibcaha<input type="number" min="0" step="0.01" required value={score} onChange={e=>setScore(e.target.value)}/></label><label>Dhibcaha ugu badan<input type="number" min="0.01" step="0.01" required value={maxScore} onChange={e=>setMaxScore(e.target.value)}/></label><button className="primary" disabled={busy}>Kaydi dhibcaha</button></form></>}</>}

 {section==='attendance'&&<><h2>Xaadirinta</h2>{!canExam?<p>Maamulka ayaa geli kara xaadirinta.</p>:<form onSubmit={e=>{e.preventDefault();send('/attendance',{studentId,date,status:attendanceStatus})}}><label>Ardayga<select required value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Dooro arday</option>{data.students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label>Taariikh<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label>Xaaladda<select value={attendanceStatus} onChange={e=>setAttendanceStatus(e.target.value)}><option value="present">Jooga</option><option value="absent">Maqan</option><option value="late">Soo daahay</option><option value="excused">Fasax</option></select></label><button className="primary" disabled={busy}>Kaydi xaadirinta</button></form>}</>}
 {section==='fees'&&<><h2>Maaliyadda</h2>{!isAdmin?<p>Maamulka iskuulka oo keliya ayaa diiwaangelin kara lacagaha.</p>:<form onSubmit={e=>{e.preventDefault();send('/fees',{studentId,amount:Number(amount),currency,reference,paidOn:date})}}><label>Ardayga<select required value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Dooro arday</option>{data.students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label>Qadarka<input type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Lacagta<select value={currency} onChange={e=>setCurrency(e.target.value)}><option value="USD">USD</option><option value="SOS">SOS</option></select></label><label>Tixraaca lacag bixinta<input required value={reference} onChange={e=>setReference(e.target.value)}/></label><label>Taariikh<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><button className="primary" disabled={busy}>Kaydi lacag bixinta</button></form>}</>}
 {section==='staff'&&isAdmin&&<><h2>Shaqaalaha</h2>{staff.map(u=><p key={u.id}>{u.full_name} — {u.email} — {u.role} — {u.is_active?'Shaqaynaya':'La joojiyey'}</p>)}<form onSubmit={e=>{e.preventDefault();send('/staff',{email:staffEmail,fullName:name,password:staffPassword,role:staffRole})}}><label>Magaca<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Email<input type="email" required value={staffEmail} onChange={e=>setStaffEmail(e.target.value)}/></label><label>Password (12 xaraf ama ka badan)<input type="password" required minLength={12} value={staffPassword} onChange={e=>setStaffPassword(e.target.value)}/></label><label>Doorka<select value={staffRole} onChange={e=>setStaffRole(e.target.value)}><option value="teacher">Macallin</option><option value="exam_officer">Masuulka imtixaanka</option><option value="school_admin">Maamule</option></select></label><button className="primary" disabled={busy}>Ku dar shaqaale</button></form></>}
 {section==='audit'&&isAdmin&&<><h2>Diiwaanka isbeddellada</h2>{audit.map(a=><p key={a.id}>{a.action} — {a.entity_type} — {new Date(a.created_at).toLocaleString()}</p>)}</>}
 </>:<p>Waa la soo rarayaa xogta...</p>}
 </div></main>;
}
