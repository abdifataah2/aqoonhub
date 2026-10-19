import {AdminDashboard} from './AdminDashboard';
import React from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,GraduationCap,LockKeyhole,FileText} from 'lucide-react';

type School={id:string;slug:string;name:string;logo_url:string|null;brand_color:string};
type LoginReply={token:string;user:{name:string;role:string;email:string};school:School};
type Exam={id:string;title:string;academicYear:string;marks:{subject:string;score:number;maxScore:number}[]};
type ResultReply={student:{name:string;registrationNumber:string};exams:Exam[]};
const errorText=(err:unknown)=>err instanceof Error?err.message:'Cilad ayaa dhacday';
async function request<T>(path:string,init?:RequestInit):Promise<T>{
 let response:Response;
 try{response=await fetch(path,{...init,headers:{'Content-Type':'application/json',...init?.headers},cache:'no-store'})}
 catch{throw new Error('Server-ka lama xiriiri karo. Hubi in backend-ku shaqaynayo.')}
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof body.error==='string'?body.error:'Codsigu ma guulaysan');
 return body as T;
}
function useSchoolInfo(slug:string|undefined){
 const [school,setSchool]=React.useState<School|null>(null);
 const [error,setError]=React.useState('');
 React.useEffect(()=>{
  if(!slug)return;
  let active=true;
  request<{school:School}>(`/api/schools/${encodeURIComponent(slug)}`)
   .then(r=>{if(active)setSchool(r.school)})
   .catch(e=>{if(active)setError(errorText(e))});
  return()=>{active=false};
 },[slug]);
 return {school,error};
}
function Frame({school,title,subtitle,children}:{school:School|null;title:string;subtitle:string;children:React.ReactNode}){
 return <><header className="top"><div className="wrap top-inner"><Link to={school?`/s/${school.slug}`:'/'} className="brand"><span className="brand-icon" style={{background:school?.brand_color||'#2563eb'}}><GraduationCap size={24}/></span><span><b>{school?.name||'Somskill'}</b><small>Nidaamka Maamulka Iskuulka</small></span></Link><Link className="top-link" to={school?`/s/${school.slug}`:'/'}><ArrowLeft size={16}/> Dib u noqo</Link></div></header><main className="form-area"><div className="form-card"><h1>{title}</h1><p>{subtitle}</p>{children}</div></main><footer>© {new Date().getFullYear()} Somskill</footer></>;
}
export function LiveLogin(){
 const {slug}=useParams();const {school,error:schoolError}=useSchoolInfo(slug);
 const [email,setEmail]=React.useState('');const [password,setPassword]=React.useState('');
 const [busy,setBusy]=React.useState(false);const [error,setError]=React.useState('');
 const [logged,setLogged]=React.useState<LoginReply|null>(null);
 async function submit(e:React.FormEvent){e.preventDefault();if(!slug||busy)return;setBusy(true);setError('');
  try{const data=await request<LoginReply>(`/api/schools/${encodeURIComponent(slug)}/login`,{method:'POST',body:JSON.stringify({email,password})});setLogged(data);setPassword('')}
  catch(err){setError(errorText(err))}finally{setBusy(false)}
 }
 if(logged)return <AdminDashboard session={logged} onLogout={()=>setLogged(null)}/>;
 return <Frame school={school} title="Galitaanka Maamulka" subtitle="Geli iimaylka iyo furaha sirta ee iskuulkaaga.">
 {schoolError&&<div className="notice" role="alert">{schoolError}</div>}
 <form onSubmit={submit}><label>Cinwaanka Iimaylka<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="magac@iskuul.com"/></label><label>Furaha Sirta<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label><button className="primary full" disabled={busy||!school}>{busy?'Fadlan sug...':'Soo Gal'} <LockKeyhole size={17}/></button>{error&&<div className="notice" role="alert">{error}</div>}</form>
 </Frame>;
}
export function LiveResults(){
 const {slug}=useParams();const {school,error:schoolError}=useSchoolInfo(slug);
 const [registrationNumber,setRegistrationNumber]=React.useState('');
 const [busy,setBusy]=React.useState(false);const [error,setError]=React.useState('');
 const [result,setResult]=React.useState<ResultReply|null>(null);
 async function submit(e:React.FormEvent){e.preventDefault();if(!slug||busy)return;setBusy(true);setError('');setResult(null);
  try{const data=await request<ResultReply>(`/api/schools/${encodeURIComponent(slug)}/student-login`,{method:'POST',body:JSON.stringify({registrationNumber})});setResult(data)}
  catch(err){setError(errorText(err))}finally{setBusy(false)}
 }
 return <Frame school={school} title="Hubinta Natiijada" subtitle="Geli Reg-Number-kaaga si aad u aragto natiijooyinka la daabacay.">
 {schoolError&&<div className="notice" role="alert">{schoolError}</div>}
 <form onSubmit={submit}><label>Lambarka Diiwaangelinta<input required value={registrationNumber} onChange={e=>setRegistrationNumber(e.target.value)} placeholder="Tusaale: 2026-001"/></label><button className="primary full" disabled={busy||!school}>{busy?'Fadlan sug...':'Eeg Natiijada'} <FileText size={17}/></button>{error&&<div className="notice" role="alert">{error}</div>}</form>
 {result&&<section aria-live="polite"><h2>{result.student.name}</h2><p>Diiwaangelin: {result.student.registrationNumber}</p>{result.exams.map(exam=><div className="panel" key={exam.id}><h3>{exam.title} — {exam.academicYear}</h3><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={{textAlign:'left'}}>Maaddada</th><th>Dhibcaha</th></tr></thead><tbody>{exam.marks.map(m=><tr key={m.subject}><td>{m.subject}</td><td style={{textAlign:'center'}}>{m.score} / {m.maxScore}</td></tr>)}</tbody></table></div>)}<button className="primary full" type="button" onClick={()=>window.print()}>Daabac Natiijada <ArrowRight size={17}/></button></section>}
 </Frame>;
}
