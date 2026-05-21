import { useState, useEffect, useCallback } from "react";

// ── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://pnphjaudhrqdoucovwpf.supabase.co";
const SUPABASE_KEY = "sb_publishable_t8LjSUDffgcL3EOiBieaiw_lAtOdvbm";
const EMAILJS_SERVICE_ID  = "service_otrm554";
const EMAILJS_TEMPLATE_ID = "template_zgbs6vq";
const EMAILJS_PUBLIC_KEY  = "7JGYreAQOLQA5PEiP";
const MANAGER_EMAIL       = "david.russo94@gmail.com";
const CP_QUOTA            = 30;

const EMPLOYEES_DEFAULT = [
  { name: "Basma",  password: "basma123",  email: "basma.charif5@gmail.com"    },
  { name: "Lysa",   password: "lysa123",   email: "abboudlysa@gmail.com"        },
  { name: "Hanane", password: "hanane123", email: "hanane.handoura@hotmail.com" },
  { name: "Walid",  password: "walid123",  email: "walsfr@gmail.com"            },
  { name: "Billal", password: "billal123", email: "dahmanbillal@icloud.com"     },
  { name: "Jeiza",  password: "jeiza123",  email: "jeizasilvajei2000@gmail.com" },
];

const MANAGER_PASSWORD = "pharma2024";
const ALL_DAYS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
const DAY_JS_INDEX = {"Lundi":1,"Mardi":2,"Mercredi":3,"Jeudi":4,"Vendredi":5,"Samedi":6};
const DEFAULT_PLANNING = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

const STATUS_COLORS = {
  pending:  { bg:"#FFF3CD", text:"#856404", border:"#FFEAA7", label:"En attente" },
  approved: { bg:"#D4EDDA", text:"#155724", border:"#C3E6CB", label:"Approuvé"   },
  rejected: { bg:"#F8D7DA", text:"#721C24", border:"#F5C6CB", label:"Refusé"     },
};

const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const EMPLOYEE_COLORS = ["#4F6BED","#E85D75","#2DBBB6","#F4A62A","#8B5CF6","#EC6E3A"];

// ── SUPABASE API ─────────────────────────────────────────────────────────────
const sb = async (path, method="GET", body=null) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const dbGet    = (table, query="")         => sb(`${table}?${query}`);
const dbInsert = (table, data)             => sb(table, "POST", data);
const dbUpdate = (table, query, data)      => sb(`${table}?${query}`, "PATCH", data);
const dbUpsert = (table, data)             => sb(`${table}?on_conflict=employee`, "POST", {...data});
const dbDelete = (table, query)            => sb(`${table}?${query}`, "DELETE");

// ── HELPERS ──────────────────────────────────────────────────────────────────
function getFeries(year) {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  const p=new Date(year,month-1,day);
  const fmt=d=>d.toISOString().split("T")[0];
  const add=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  return new Set([`${year}-01-01`,`${year}-05-01`,`${year}-05-08`,`${year}-07-14`,
    `${year}-08-15`,`${year}-11-01`,`${year}-11-11`,`${year}-12-25`,
    fmt(add(p,1)),fmt(add(p,39)),fmt(add(p,49)),fmt(add(p,50))]);
}

function formatDate(d) {
  if(!d)return"";
  return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});
}
function initials(name){ return name.split(" ").map(n=>n[0]).join("").toUpperCase(); }
function empIdx(name){ return EMPLOYEES_DEFAULT.findIndex(e=>e.name===name); }
function empColor(name){ return EMPLOYEE_COLORS[empIdx(name)]??"#4F6BED"; }

function getWeekNumber(date) {
  const d=new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate()+3-(d.getDay()+6)%7);
  const w=new Date(d.getFullYear(),0,4);
  return 1+Math.round(((d-w)/86400000-3+(w.getDay()+6)%7)/7);
}
function isWeekA(date){ return getWeekNumber(date)%2===1; }

function calcCP(startDate, endDate, workedDays) {
  if(!startDate||!endDate||!workedDays?.length)return 0;
  const wi=workedDays.map(d=>DAY_JS_INDEX[d]);
  let count=0, firstDay=null;
  const end=new Date(endDate);
  for(let d=new Date(startDate);d<=end;d.setDate(d.getDate()+1)){
    if(wi.includes(d.getDay())){firstDay=new Date(d);break;}
  }
  if(!firstDay)return 0;
  const f1=getFeries(firstDay.getFullYear()),f2=getFeries(end.getFullYear());
  const allF=new Set([...f1,...f2]);
  for(let d=new Date(firstDay);d<=end;d.setDate(d.getDate()+1)){
    const ds=d.toISOString().split("T")[0];
    if(wi.includes(d.getDay())&&!allF.has(ds))count++;
  }
  return count;
}

function getSolde(empName, requests, plannings, soldesManuel) {
  const base=soldesManuel?.[empName]??CP_QUOTA;
  const pris=requests.filter(r=>r.employee===empName&&r.status==="approved").reduce((s,r)=>s+(r.cp||0),0);
  return Math.max(0,base-pris);
}

// ── EMAILJS ──────────────────────────────────────────────────────────────────
async function sendEmail({to_email,to_name,subject,message}) {
  try {
    await fetch("https://api.emailjs.com/api/v1.0/email/send",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({service_id:EMAILJS_SERVICE_ID,template_id:EMAILJS_TEMPLATE_ID,user_id:EMAILJS_PUBLIC_KEY,
        template_params:{to_email,to_name,subject,message}}),
    });
  } catch{}
}

async function notifyManager(employee,req){
  const urgent=req.urgent?"🚨 URGENT — ":"";
  await sendEmail({to_email:MANAGER_EMAIL,to_name:"David",
    subject:`${urgent}Nouvelle demande – ${employee.name}`,
    message:`${employee.name} a soumis une demande${req.urgent?" URGENTE":""}.\n\nType : ${req.type}\nDu : ${formatDate(req.start_date)}\nAu : ${formatDate(req.end_date)}\nJours CP : ${req.cp}\n${req.reason?`Commentaire : ${req.reason}`:""}`});
}

async function notifyEmployee(employee,req,status,motif){
  const ok=status==="approved";
  await sendEmail({to_email:employee.email,to_name:employee.name,
    subject:`Votre demande a été ${ok?"approuvée ✅":"refusée ❌"}`,
    message:`Bonjour ${employee.name},\n\nVotre demande a été ${ok?"approuvée":"refusée"}.\n\nType : ${req.type}\nDu : ${formatDate(req.start_date)}\nAu : ${formatDate(req.end_date)}\nJours CP : ${req.cp}\n${motif?`Motif : ${motif}`:""}\n\n${ok?"Bonnes vacances ! 🎉":"N'hésitez pas à soumettre une nouvelle demande."}`});
}

// ── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [view,setView]               = useState("home");
  const [employees,setEmployees]     = useState(EMPLOYEES_DEFAULT);
  const [selEmp,setSelEmp]           = useState(null);
  const [empPwInput,setEmpPwInput]   = useState("");
  const [empPwError,setEmpPwError]   = useState(false);
  const [pendingLogin,setPendingLogin] = useState(null);
  const [rememberMe,setRememberMe]   = useState(false);
  const [forgotMode,setForgotMode]   = useState(false);
  const [forgotStep,setForgotStep]   = useState(1); // 1=email, 2=code, 3=newpw
  const [forgotCode,setForgotCode]   = useState("");
  const [forgotCodeInput,setForgotCodeInput] = useState("");
  const [forgotNewPw,setForgotNewPw] = useState({new1:"",new2:""});
  const [forgotError,setForgotError] = useState("");
  const [forgotSuccess,setForgotSuccess] = useState("");
  const [forgotSending,setForgotSending] = useState(false);
  const [mgrUnlocked,setMgrUnlocked] = useState(false);
  const [mgrPwInput,setMgrPwInput]   = useState("");
  const [mgrPwError,setMgrPwError]   = useState(false);
  const [mgrRememberMe,setMgrRememberMe] = useState(false);
  const [requests,setRequests]       = useState([]);
  const [plannings,setPlannings]     = useState({});
  const [soldesManuel,setSoldesManuel] = useState({});
  const [activeTab,setActiveTab]     = useState("submit");
  const [mgrTab,setMgrTab]           = useState("requests");
  const [empCalMonth,setEmpCalMonth]   = useState(new Date().getMonth());
  const [empCalYear,setEmpCalYear]     = useState(new Date().getFullYear());
  const [calMonth,setCalMonth]       = useState(new Date().getMonth());
  const [calYear,setCalYear]         = useState(new Date().getFullYear());
  const [recapMonth,setRecapMonth]   = useState(new Date().getMonth());
  const [recapYear,setRecapYear]     = useState(new Date().getFullYear());
  const [form,setForm]               = useState({startDate:"",endDate:"",reason:"",type:"Congés payés",urgent:false});
  const [formError,setFormError]     = useState("");
  const [formSuccess,setFormSuccess] = useState(false);
  const [sending,setSending]         = useState(false);
  const [editingReq,setEditingReq]   = useState(null);
  const [motifRefus,setMotifRefus]   = useState("");
  const [motifModal,setMotifModal]   = useState(null);
  const [newPw,setNewPw]             = useState({old:"",new1:"",new2:""});
  const [newPwError,setNewPwError]   = useState("");
  const [newPwSuccess,setNewPwSuccess] = useState(false);
  const [notifBadge,setNotifBadge]   = useState([]);
  const [loading,setLoading]         = useState(true);
  const [installPrompt,setInstallPrompt] = useState(null);
  const [showInstall,setShowInstall] = useState(false);
  const [resetStep,setResetStep]     = useState(null); // null | 'choose' | 'code' | 'newpw'
  const [resetEmp,setResetEmp]       = useState(null);
  const [resetCode,setResetCode]     = useState("");
  const [resetCodeInput,setResetCodeInput] = useState("");
  const [resetNewPw,setResetNewPw]   = useState({new1:"",new2:""});
  const [resetError,setResetError]   = useState("");
  const [resetSuccess,setResetSuccess] = useState(false);
  const [resetSending,setResetSending] = useState(false);

  useEffect(()=>{
    window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();setInstallPrompt(e);setShowInstall(true);});
  },[]);

  // Load all data from Supabase
  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try {
        // Load requests
        const reqs = await dbGet("requests","order=submitted_at.desc");
        if(reqs) setRequests(reqs);

        // Load plannings
        const plans = await dbGet("plannings");
        if(plans && plans.length > 0){
          const p={};
          plans.forEach(pl=>{ p[pl.employee]={A:pl.days_a||DEFAULT_PLANNING,B:pl.days_b||DEFAULT_PLANNING}; });
          setPlannings(p);
        }

        // Load soldes
        const sols = await dbGet("soldes");
        if(sols && sols.length > 0){
          const s={};
          sols.forEach(sl=>{ s[sl.employee]=sl.base; });
          setSoldesManuel(s);
        }

        // Load employees (passwords)
        const emps = await dbGet("employees");
        if(emps && emps.length > 0) setEmployees(emps);
        else {
          // First time: insert default employees
          for(const emp of EMPLOYEES_DEFAULT){
            await dbInsert("employees",{name:emp.name,password:emp.password,email:emp.email});
          }
        }

        // Remember me
        try {
          const rm=localStorage.getItem("pharma_remember");
          if(rm){ const data=JSON.parse(rm); setSelEmp(data); setView("employee"); }
        } catch{}
        try {
          const rm2=localStorage.getItem("pharma_remember_mgr");
          if(rm2){ setMgrUnlocked(true); setView("manager"); }
        } catch{}

      } catch(e){ console.error(e); }
      setLoading(false);
    })();
  },[]);

  // Poll for new requests every 30s (for manager)
  useEffect(()=>{
    if(!mgrUnlocked) return;
    const interval = setInterval(async()=>{
      const reqs = await dbGet("requests","order=submitted_at.desc");
      if(reqs) setRequests(reqs);
    }, 30000);
    return ()=>clearInterval(interval);
  },[mgrUnlocked]);

  // Notifications for employee
  useEffect(()=>{
    if(!selEmp) return;
    const recent=requests.filter(r=>r.employee===selEmp.name&&(r.status==="approved"||r.status==="rejected")&&!r.notified);
    setNotifBadge(recent);
  },[selEmp,requests]);

  function getEmpPlanning(name,date){
    const plan=plannings[name]||{A:DEFAULT_PLANNING,B:DEFAULT_PLANNING};
    if(!date)return plan.A||DEFAULT_PLANNING;
    return isWeekA(date)?(plan.A||DEFAULT_PLANNING):(plan.B||DEFAULT_PLANNING);
  }

  async function markNotified(){
    const toMark=requests.filter(r=>r.employee===selEmp?.name&&(r.status==="approved"||r.status==="rejected")&&!r.notified);
    for(const r of toMark){ await dbUpdate("requests",`id=eq.${r.id}`,{notified:true}); }
    setRequests(prev=>prev.map(r=>r.employee===selEmp?.name?({...r,notified:true}):r));
    setNotifBadge([]);
  }

  async function sendForgotCode(emp) {
    setForgotSending(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setForgotCode(code);
    await sendEmail({
      to_email: emp.email,
      to_name: emp.name,
      subject: "Code de réinitialisation — Pharmacie RUSSO",
      message: `Bonjour ${emp.name},\n\nVoici votre code de réinitialisation de mot de passe :\n\n🔑 ${code}\n\nCe code est valable 10 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez ce message.`,
    });
    setForgotSending(false);
    setForgotStep(2);
  }

  async function submitRequest(){
    setFormError("");
    if(!form.startDate||!form.endDate) return setFormError("Veuillez choisir les dates.");
    if(form.endDate<form.startDate) return setFormError("La date de fin doit être après le début.");
    const planning=getEmpPlanning(selEmp.name,form.startDate);
    const cp=calcCP(form.startDate,form.endDate,planning);
    const solde=getSolde(selEmp.name,requests,plannings,soldesManuel);
    if(!editingReq && cp>solde) return setFormError(`Solde insuffisant : ${solde} jours restants.`);

    if(editingReq){
      await dbUpdate("requests",`id=eq.${editingReq}`,{
        start_date:form.startDate,end_date:form.endDate,type:form.type,
        reason:form.reason,urgent:form.urgent,cp,status:"pending",notified:false
      });
      setRequests(prev=>prev.map(r=>r.id===editingReq?{...r,start_date:form.startDate,end_date:form.endDate,type:form.type,reason:form.reason,urgent:form.urgent,cp,status:"pending",notified:false}:r));
      setEditingReq(null);
    } else {
      const req={
        id:Date.now().toString(),employee:selEmp.name,
        start_date:form.startDate,end_date:form.endDate,
        type:form.type,reason:form.reason,urgent:form.urgent,cp,
        status:"pending",submitted_at:new Date().toISOString(),notified:false
      };
      setSending(true);
      await dbInsert("requests",req);
      setRequests(prev=>[req,...prev]);
      await notifyManager(selEmp,req);
      setSending(false);
    }
    setForm({startDate:"",endDate:"",reason:"",type:"Congés payés",urgent:false});
    setFormSuccess(true);
    setTimeout(()=>setFormSuccess(false),4000);
  }

  async function handleStatus(id,status){
    if(status==="rejected"){ setMotifModal(id); return; }
    await dbUpdate("requests",`id=eq.${id}`,{status,notified:false});
    setRequests(prev=>prev.map(r=>r.id===id?{...r,status,notified:false}:r));
    const req=requests.find(r=>r.id===id);
    if(req){ const emp=employees.find(e=>e.name===req.employee); if(emp) await notifyEmployee(emp,req,status,""); }
  }

  async function confirmRefus(){
    const id=motifModal;
    await dbUpdate("requests",`id=eq.${id}`,{status:"rejected",notified:false});
    setRequests(prev=>prev.map(r=>r.id===id?{...r,status:"rejected",notified:false}:r));
    const req=requests.find(r=>r.id===id);
    if(req){ const emp=employees.find(e=>e.name===req.employee); if(emp) await notifyEmployee(emp,req,"rejected",motifRefus); }
    setMotifModal(null); setMotifRefus("");
  }

  async function deleteRequest(id){
    await dbDelete("requests",`id=eq.${id}`);
    setRequests(prev=>prev.filter(r=>r.id!==id));
  }

  async function toggleDay(empName,semaine,day){
    const current=plannings[empName]?.[semaine]||DEFAULT_PLANNING;
    const updated=current.includes(day)?current.filter(d=>d!==day):[...current,day];
    const newPlan={...plannings,[empName]:{...(plannings[empName]||{}),ab:undefined,[semaine]:updated}};
    const empPlan=newPlan[empName];
    setPlannings(newPlan);
    await sb(`plannings?employee=eq.${encodeURIComponent(empName)}`,"PATCH",{days_a:empPlan.A||DEFAULT_PLANNING,days_b:empPlan.B||DEFAULT_PLANNING});
    // Insert if not exists
    const check=await dbGet(`plannings?employee=eq.${encodeURIComponent(empName)}`);
    if(!check||check.length===0){
      await dbInsert("plannings",{employee:empName,days_a:empPlan.A||DEFAULT_PLANNING,days_b:empPlan.B||DEFAULT_PLANNING});
    }
  }

  async function updateSolde(empName,value){
    const v=parseInt(value)||0;
    setSoldesManuel(prev=>({...prev,[empName]:v}));
    const check=await dbGet(`soldes?employee=eq.${encodeURIComponent(empName)}`);
    if(check&&check.length>0){ await dbUpdate("soldes",`employee=eq.${encodeURIComponent(empName)}`,{base:v}); }
    else { await dbInsert("soldes",{employee:empName,base:v}); }
  }

  async function changePassword(){
    setNewPwError("");
    const emp=employees.find(e=>e.name===selEmp.name);
    if(newPw.old!==emp.password) return setNewPwError("Ancien mot de passe incorrect.");
    if(newPw.new1.length<4) return setNewPwError("Minimum 4 caractères.");
    if(newPw.new1!==newPw.new2) return setNewPwError("Les mots de passe ne correspondent pas.");
    await dbUpdate("employees",`name=eq.${encodeURIComponent(selEmp.name)}`,{password:newPw.new1});
    setEmployees(prev=>prev.map(e=>e.name===selEmp.name?{...e,password:newPw.new1}:e));
    setSelEmp(prev=>({...prev,password:newPw.new1}));
    setNewPw({old:"",new1:"",new2:""});
    setNewPwSuccess(true);
    setTimeout(()=>setNewPwSuccess(false),3000);
  }

  async function sendResetCode(emp) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setResetCode(code);
    setResetSending(true);
    await sendEmail({
      to_email: emp.email, to_name: emp.name,
      subject: "Code de réinitialisation — Pharmacie RUSSO",
      message: `Bonjour ${emp.name},\n\nVotre code de réinitialisation est :\n\n${code}\n\nCe code est valable 10 minutes.\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.`,
    });
    setResetSending(false);
    setResetStep("code");
  }

  async function confirmResetCode() {
    setResetError("");
    if (resetCodeInput !== resetCode) return setResetError("Code incorrect.");
    setResetStep("newpw");
  }

  async function confirmNewPassword() {
    setResetError("");
    if (resetNewPw.new1.length < 4) return setResetError("Minimum 4 caractères.");
    if (resetNewPw.new1 !== resetNewPw.new2) return setResetError("Les mots de passe ne correspondent pas.");
    await dbUpdate("employees", `name=eq.${encodeURIComponent(resetEmp.name)}`, {password: resetNewPw.new1});
    setEmployees(prev => prev.map(e => e.name === resetEmp.name ? {...e, password: resetNewPw.new1} : e));
    setResetSuccess(true);
    setTimeout(() => {
      setResetStep(null); setResetEmp(null); setResetCode(""); setResetCodeInput("");
      setResetNewPw({new1:"",new2:""}); setResetSuccess(false); setResetError("");
    }, 2000);
  }

  async function handleInstall(){
    if(!installPrompt)return;
    installPrompt.prompt();
    const{outcome}=await installPrompt.userChoice;
    if(outcome==="accepted")setShowInstall(false);
  }

  const myRequests=requests.filter(r=>r.employee===selEmp?.name);
  const pendingCount=requests.filter(r=>r.status==="pending").length;
  const solde=selEmp?getSolde(selEmp.name,requests,plannings,soldesManuel):0;

  function getCalendarDays(){
    const fd=new Date(calYear,calMonth,1).getDay();
    return{offset:fd===0?6:fd-1,daysInMonth:new Date(calYear,calMonth+1,0).getDate()};
  }
  function getAbsencesForDay(day){
    const date=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return requests.filter(r=>r.status==="approved"&&r.start_date<=date&&r.end_date>=date);
  }
  function getMonthlyRecap(){
    const first=`${recapYear}-${String(recapMonth+1).padStart(2,"0")}-01`;
    const last=`${recapYear}-${String(recapMonth+1).padStart(2,"0")}-${new Date(recapYear,recapMonth+1,0).getDate()}`;
    return employees.map(emp=>{
      const reqs=requests.filter(r=>r.employee===emp.name&&r.status==="approved"&&r.start_date<=last&&r.end_date>=first);
      const total=reqs.reduce((s,r)=>{
        const st=r.start_date<first?first:r.start_date;
        const en=r.end_date>last?last:r.end_date;
        return s+calcCP(st,en,getEmpPlanning(emp.name,st));
      },0);
      return{name:emp.name,total,count:reqs.length};
    });
  }
  function getChevauchements(){
    const approved=requests.filter(r=>r.status==="approved");
    const alerts=[];
    for(let i=0;i<approved.length;i++){
      for(let j=i+1;j<approved.length;j++){
        const a=approved[i],b=approved[j];
        if(a.start_date<=b.end_date&&b.start_date<=a.end_date){
          alerts.push(`${a.employee} & ${b.employee} se chevauchent`);
        }
      }
    }
    return[...new Set(alerts)];
  }

  const previewCP=form.startDate&&form.endDate&&form.endDate>=form.startDate
    ?calcCP(form.startDate,form.endDate,getEmpPlanning(selEmp?.name,form.startDate)):null;
  const{offset,daysInMonth}=getCalendarDays();
  const recap=getMonthlyRecap();
  const chevauchements=getChevauchements();

  // ── LOADING ─────────────────────────────────────────────────────────────
  if(loading) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0F2027,#203A43,#2C5364)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Georgia',serif"}}>
      <div style={{fontSize:"52px",marginBottom:"16px"}}>💊</div>
      <div style={{color:"#E8D5A3",fontSize:"18px",fontWeight:"700"}}>Pharmacie RUSSO</div>
      <div style={{color:"#94B4C8",fontSize:"14px",marginTop:"8px"}}>Chargement...</div>
    </div>
  );

  // ── HOME ─────────────────────────────────────────────────────────────────
  if(view==="home") return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0F2027,#203A43,#2C5364)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Georgia',serif",padding:"24px"}}>
      <div style={{textAlign:"center",marginBottom:"44px"}}>
        <div style={{fontSize:"52px",marginBottom:"8px"}}>💊</div>
        <h1 style={{color:"#E8D5A3",fontSize:"clamp(22px,5vw,34px)",fontWeight:"700",margin:"0 0 4px",letterSpacing:"0.04em"}}>Pharmacie RUSSO</h1>
        <p style={{color:"#94B4C8",fontSize:"14px",margin:0,fontStyle:"italic"}}>Gestion des congés payés</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"14px",width:"100%",maxWidth:"320px"}}>
        <button onClick={()=>setView("employee")}
          style={{background:"linear-gradient(135deg,#E8D5A3,#C9A84C)",border:"none",borderRadius:"14px",padding:"18px 24px",cursor:"pointer",fontSize:"16px",fontWeight:"700",color:"#1a1a1a",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"12px",boxShadow:"0 4px 20px rgba(200,168,76,0.3)"}}
          onMouseEnter={e=>e.currentTarget.style.opacity="0.9"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          <span style={{fontSize:"22px"}}>👤</span> Espace Employé
        </button>
        <button onClick={()=>setView("manager")}
          style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:"14px",padding:"18px 24px",cursor:"pointer",fontSize:"16px",fontWeight:"700",color:"#E8D5A3",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"12px",backdropFilter:"blur(10px)"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.14)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}>
          <span style={{fontSize:"22px"}}>🔐</span> Espace Gérant
          {pendingCount>0&&<span style={{marginLeft:"auto",background:"#E85D75",color:"white",borderRadius:"20px",padding:"2px 10px",fontSize:"12px"}}>{pendingCount}</span>}
        </button>
        {showInstall&&(
          <button onClick={handleInstall}
            style={{background:"rgba(255,255,255,0.06)",border:"1px dashed rgba(255,255,255,0.3)",borderRadius:"14px",padding:"12px 24px",cursor:"pointer",fontSize:"14px",fontWeight:"600",color:"#94B4C8",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"10px",justifyContent:"center"}}>
            📲 Installer l'app sur mon téléphone
          </button>
        )}
      </div>
    </div>
  );

  // ── EMPLOYEE — choose ────────────────────────────────────────────────────
  if(view==="employee"&&!selEmp&&!pendingLogin) return (
    <div style={{minHeight:"100vh",background:"#F5F3EF",fontFamily:"'Georgia',serif",padding:"24px"}}>
      <div style={{maxWidth:"440px",margin:"0 auto"}}>
        <button onClick={()=>setView("home")} style={{background:"none",border:"none",color:"#5A7A8A",cursor:"pointer",fontSize:"14px",marginBottom:"28px",fontFamily:"inherit"}}>← Retour</button>
        <h2 style={{color:"#1a2e38",fontSize:"24px",marginBottom:"6px"}}>Qui êtes-vous ?</h2>
        <p style={{color:"#6B8A99",fontSize:"13px",marginBottom:"22px"}}>Sélectionnez votre prénom</p>
        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {employees.map((emp,i)=>(
            <button key={emp.name} onClick={()=>{setPendingLogin(emp);setEmpPwInput("");setEmpPwError(false);}}
              style={{background:"white",border:"1px solid #E2DDD6",borderRadius:"12px",padding:"14px 18px",cursor:"pointer",textAlign:"left",fontSize:"15px",fontWeight:"600",color:"#1a2e38",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"14px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)",transition:"border-color 0.2s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=EMPLOYEE_COLORS[i]} onMouseLeave={e=>e.currentTarget.style.borderColor="#E2DDD6"}>
              <div style={{width:"40px",height:"40px",borderRadius:"50%",background:EMPLOYEE_COLORS[i],display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"15px",fontWeight:"700",flexShrink:0}}>{initials(emp.name)}</div>
              {emp.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── EMPLOYEE — password ──────────────────────────────────────────────────
  // ── RESET PASSWORD MODAL ──────────────────────────────────────────────────
  if(resetStep) {
    const color = resetEmp ? EMPLOYEE_COLORS[empIdx(resetEmp.name)] : "#4F6BED";
    return (
      <div style={{minHeight:"100vh",background:"#F5F3EF",fontFamily:"'Georgia',serif",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
        <div style={{background:"white",borderRadius:"20px",padding:"36px",width:"100%",maxWidth:"340px",boxShadow:"0 8px 32px rgba(0,0,0,0.08)"}}>
          <button onClick={()=>{setResetStep(null);setResetEmp(null);setResetCode("");setResetCodeInput("");setResetNewPw({new1:"",new2:""});setResetError("");}}
            style={{background:"none",border:"none",color:"#5A7A8A",cursor:"pointer",fontSize:"13px",marginBottom:"22px",fontFamily:"inherit"}}>← Retour</button>

          {resetStep==="choose" && (
            <>
              <h2 style={{color:"#1a2e38",fontSize:"20px",margin:"0 0 6px"}}>Mot de passe oublié</h2>
              <p style={{color:"#94B4C8",fontSize:"13px",marginBottom:"20px"}}>Sélectionnez votre prénom pour recevoir un code par email</p>
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {employees.map((emp,i)=>(
                  <button key={emp.name} onClick={async()=>{setResetEmp(emp);await sendResetCode(emp);}}
                    disabled={resetSending}
                    style={{background:"white",border:"1px solid #E2DDD6",borderRadius:"10px",padding:"12px 16px",cursor:"pointer",textAlign:"left",fontSize:"14px",fontWeight:"600",color:"#1a2e38",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"12px"}}>
                    <div style={{width:"32px",height:"32px",borderRadius:"50%",background:EMPLOYEE_COLORS[i],display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"12px",fontWeight:"700"}}>{initials(emp.name)}</div>
                    {emp.name}
                  </button>
                ))}
              </div>
              {resetSending && <div style={{color:"#94B4C8",fontSize:"13px",marginTop:"12px",textAlign:"center"}}>Envoi du code...</div>}
            </>
          )}

          {resetStep==="code" && (
            <>
              <div style={{textAlign:"center",marginBottom:"24px"}}>
                <div style={{width:"56px",height:"56px",borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"20px",fontWeight:"700",margin:"0 auto 12px"}}>{resetEmp&&initials(resetEmp.name)}</div>
                <h2 style={{color:"#1a2e38",fontSize:"18px",margin:"0 0 6px"}}>Code envoyé !</h2>
                <p style={{color:"#94B4C8",fontSize:"13px",margin:0}}>Vérifiez votre email <strong>{resetEmp?.email}</strong></p>
              </div>
              <input type="text" value={resetCodeInput} onChange={e=>{setResetCodeInput(e.target.value);setResetError("");}}
                placeholder="Entrez le code à 6 chiffres"
                style={{width:"100%",padding:"12px",border:`1px solid ${resetError?"#E85D75":"#E2DDD6"}`,borderRadius:"10px",fontSize:"18px",fontFamily:"monospace",boxSizing:"border-box",outline:"none",marginBottom:"10px",textAlign:"center",letterSpacing:"6px"}} />
              {resetError&&<div style={{color:"#E85D75",fontSize:"13px",marginBottom:"10px"}}>{resetError}</div>}
              <button onClick={confirmResetCode}
                style={{width:"100%",padding:"13px",background:color,color:"white",border:"none",borderRadius:"10px",fontSize:"15px",fontWeight:"700",cursor:"pointer",fontFamily:"inherit",marginBottom:"10px"}}>
                Valider le code
              </button>
              <button onClick={async()=>{setResetCodeInput("");setResetError("");await sendResetCode(resetEmp);}}
                style={{width:"100%",padding:"10px",background:"none",color:"#94B4C8",border:"1px solid #E2DDD6",borderRadius:"10px",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>
                Renvoyer le code
              </button>
            </>
          )}

          {resetStep==="newpw" && (
            <>
              <div style={{textAlign:"center",marginBottom:"24px"}}>
                <h2 style={{color:"#1a2e38",fontSize:"18px",margin:"0 0 6px"}}>Nouveau mot de passe</h2>
                <p style={{color:"#94B4C8",fontSize:"13px",margin:0}}>Choisissez un nouveau mot de passe</p>
              </div>
              {[["new1","Nouveau mot de passe"],["new2","Confirmer"]].map(([f,l])=>(
                <div key={f} style={{marginBottom:"12px"}}>
                  <label style={{display:"block",fontSize:"13px",fontWeight:"600",color:"#5A7A8A",marginBottom:"6px"}}>{l}</label>
                  <input type="password" value={resetNewPw[f]} onChange={e=>{setResetNewPw({...resetNewPw,[f]:e.target.value});setResetError("");}}
                    style={{width:"100%",padding:"12px",border:`1px solid ${resetError?"#E85D75":"#E2DDD6"}`,borderRadius:"10px",fontSize:"15px",fontFamily:"inherit",boxSizing:"border-box",outline:"none"}} />
                </div>
              ))}
              {resetError&&<div style={{color:"#E85D75",fontSize:"13px",marginBottom:"10px"}}>{resetError}</div>}
              {resetSuccess&&<div style={{color:"#16A34A",fontSize:"13px",marginBottom:"10px",fontWeight:"600"}}>✅ Mot de passe modifié !</div>}
              <button onClick={confirmNewPassword}
                style={{width:"100%",padding:"13px",background:color,color:"white",border:"none",borderRadius:"10px",fontSize:"15px",fontWeight:"700",cursor:"pointer",fontFamily:"inherit"}}>
                Confirmer
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if(view==="employee"&&!selEmp&&pendingLogin){
    const i=empIdx(pendingLogin.name);
    const color=EMPLOYEE_COLORS[i];
    const tryLogin=async()=>{
      const currentEmp=employees.find(e=>e.name===pendingLogin.name);
      if(empPwInput===currentEmp.password){
        setSelEmp(currentEmp);setPendingLogin(null);setEmpPwInput("");
        if(rememberMe){try{localStorage.setItem("pharma_remember",JSON.stringify({name:currentEmp.name,password:currentEmp.password,email:currentEmp.email}));}catch{}}
      } else setEmpPwError(true);
    };
    return (
      <div style={{minHeight:"100vh",background:"#F5F3EF",fontFamily:"'Georgia',serif",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
        <div style={{background:"white",borderRadius:"20px",padding:"36px",width:"100%",maxWidth:"340px",boxShadow:"0 8px 32px rgba(0,0,0,0.08)"}}>
          <button onClick={()=>{setPendingLogin(null);setEmpPwError(false);}} style={{background:"none",border:"none",color:"#5A7A8A",cursor:"pointer",fontSize:"13px",marginBottom:"22px",fontFamily:"inherit"}}>← Changer</button>
          <div style={{textAlign:"center",marginBottom:"26px"}}>
            <div style={{width:"64px",height:"64px",borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"22px",fontWeight:"700",margin:"0 auto 12px"}}>{initials(pendingLogin.name)}</div>
            <h2 style={{color:"#1a2e38",fontSize:"20px",margin:"0 0 4px"}}>Bonjour, {pendingLogin.name} !</h2>
            <p style={{color:"#94B4C8",fontSize:"13px",margin:0}}>Entrez votre mot de passe</p>
          </div>
          <input type="password" value={empPwInput} onChange={e=>{setEmpPwInput(e.target.value);setEmpPwError(false);}} onKeyDown={e=>e.key==="Enter"&&tryLogin()} placeholder="Mot de passe..."
            style={{width:"100%",padding:"12px",border:`1px solid ${empPwError?"#E85D75":"#E2DDD6"}`,borderRadius:"10px",fontSize:"15px",fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:"10px"}} />
          {empPwError&&<div style={{color:"#E85D75",fontSize:"13px",marginBottom:"10px"}}>Mot de passe incorrect</div>}
          <label style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:"#6B8A99",marginBottom:"14px",cursor:"pointer"}}>
            <input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)} />
            Se souvenir de moi
          </label>
          <button onClick={tryLogin} style={{width:"100%",padding:"13px",background:color,color:"white",border:"none",borderRadius:"10px",fontSize:"15px",fontWeight:"700",cursor:"pointer",fontFamily:"inherit"}}>Se connecter</button>
          <button onClick={()=>{setPendingLogin(null);setResetEmp(pendingLogin);setResetStep("choose");}}
            style={{width:"100%",marginTop:"10px",padding:"10px",background:"none",color:"#94B4C8",border:"none",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>
            Mot de passe oublié ?
          </button>
        </div>
      </div>
    );
  }

  // ── EMPLOYEE DASHBOARD ───────────────────────────────────────────────────
  if(view==="employee"&&selEmp){
    const i=empIdx(selEmp.name);
    const color=EMPLOYEE_COLORS[i];
    return (
      <div style={{minHeight:"100vh",background:"#F5F3EF",fontFamily:"'Georgia',serif"}}>
        {notifBadge.length>0&&(
          <div style={{background:"#1a2e38",color:"white",padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:"13px"}}>
            <span>🔔 {notifBadge.length} demande{notifBadge.length>1?"s":""} traitée{notifBadge.length>1?"s":""}!</span>
            <button onClick={()=>{setActiveTab("my-requests");markNotified();}} style={{background:"#E8D5A3",color:"#1a1a1a",border:"none",borderRadius:"6px",padding:"4px 12px",cursor:"pointer",fontSize:"12px",fontWeight:"700",fontFamily:"inherit"}}>Voir</button>
          </div>
        )}
        <div style={{background:color,padding:"22px 24px",color:"white"}}>
          <div style={{maxWidth:"600px",margin:"0 auto"}}>
            <button onClick={async()=>{setSelEmp(null);setActiveTab("submit");try{localStorage.removeItem("pharma_remember");}catch{}}}
              style={{background:"rgba(255,255,255,0.2)",border:"none",color:"white",borderRadius:"8px",padding:"6px 14px",cursor:"pointer",fontSize:"13px",marginBottom:"18px",fontFamily:"inherit"}}>
              ← Déconnexion
            </button>
            <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
              <div style={{width:"54px",height:"54px",borderRadius:"50%",background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",fontWeight:"700"}}>{initials(selEmp.name)}</div>
              <div>
                <div style={{fontSize:"20px",fontWeight:"700"}}>{selEmp.name}</div>
                <div style={{opacity:0.8,fontSize:"13px"}}>Solde CP : <strong>{solde}</strong> / {CP_QUOTA} jours</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{maxWidth:"600px",margin:"0 auto",padding:"24px"}}>
          <div style={{display:"flex",gap:"4px",background:"white",borderRadius:"12px",padding:"4px",marginBottom:"22px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",overflowX:"auto"}}>
            {[["submit","✏️ Demander"],["my-requests","📋 Historique"],["calendar","📅 Calendrier"],["change-pw","🔑 Mot de passe"]].map(([tab,label])=>(
              <button key={tab} onClick={()=>setActiveTab(tab)}
                style={{flex:1,padding:"10px",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:"600",fontFamily:"inherit",background:activeTab===tab?color:"transparent",color:activeTab===tab?"white":"#6B8A99",whiteSpace:"nowrap"}}>
                {label}
              </button>
            ))}
          </div>

          {activeTab==="submit"&&(
            <div style={{background:"white",borderRadius:"16px",padding:"24px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
              <h3 style={{margin:"0 0 4px",color:"#1a2e38",fontSize:"17px"}}>{editingReq?"Modifier":"Nouvelle demande"}</h3>
              {editingReq&&<p style={{color:"#E85D75",fontSize:"12px",marginBottom:"16px"}}>⚠️ La demande sera remise en attente</p>}
              <label style={{display:"block",fontSize:"13px",fontWeight:"600",color:"#5A7A8A",marginBottom:"6px"}}>Type</label>
              <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}
                style={{width:"100%",padding:"11px",border:"1px solid #E2DDD6",borderRadius:"10px",fontSize:"14px",fontFamily:"inherit",marginBottom:"14px",background:"white",color:"#1a2e38"}}>
                <option>Congés payés</option><option>RTT</option><option>Congé sans solde</option><option>Congé maladie</option><option>Autre</option>
              </select>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px"}}>
                {[["startDate","1er jour"],["endDate","Dernier jour"]].map(([f,l])=>(
                  <div key={f}>
                    <label style={{display:"block",fontSize:"13px",fontWeight:"600",color:"#5A7A8A",marginBottom:"6px"}}>{l}</label>
                    <input type="date" value={form[f]} onChange={e=>setForm({...form,[f]:e.target.value})}
                      style={{width:"100%",padding:"11px",border:"1px solid #E2DDD6",borderRadius:"10px",fontSize:"14px",fontFamily:"inherit",boxSizing:"border-box",color:"#1a2e38"}} />
                  </div>
                ))}
              </div>
              {previewCP!==null&&(
                <div style={{background:previewCP>solde?"#F8D7DA":"#EBF5FB",borderRadius:"8px",padding:"10px 14px",marginBottom:"14px",fontSize:"13px",color:previewCP>solde?"#721C24":"#2980B9",fontWeight:"600"}}>
                  📅 {previewCP} jour{previewCP>1?"s":""} CP{previewCP>solde?` — ⚠️ solde insuffisant (${solde}j)`:""}
                </div>
              )}
              <label style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:"#E85D75",marginBottom:"14px",cursor:"pointer",fontWeight:"600"}}>
                <input type="checkbox" checked={form.urgent} onChange={e=>setForm({...form,urgent:e.target.checked})} />
                🚨 Demande urgente
              </label>
              <label style={{display:"block",fontSize:"13px",fontWeight:"600",color:"#5A7A8A",marginBottom:"6px"}}>Commentaire (optionnel)</label>
              <textarea value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} rows={3} placeholder="Ex : vacances, rendez-vous médical..."
                style={{width:"100%",padding:"11px",border:"1px solid #E2DDD6",borderRadius:"10px",fontSize:"14px",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",color:"#1a2e38"}} />
              {formError&&<div style={{color:"#E85D75",fontSize:"13px",marginTop:"8px"}}>{formError}</div>}
              {formSuccess&&<div style={{background:"#D4EDDA",borderRadius:"8px",padding:"12px",marginTop:"10px",fontSize:"13px",color:"#155724",fontWeight:"600"}}>✅ Demande envoyée !</div>}
              <div style={{display:"flex",gap:"10px",marginTop:"18px"}}>
                <button onClick={submitRequest} disabled={sending}
                  style={{flex:1,padding:"13px",background:sending?"#ccc":color,color:"white",border:"none",borderRadius:"10px",fontSize:"15px",fontWeight:"700",cursor:sending?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {sending?"Envoi...":editingReq?"Modifier":"Envoyer"}
                </button>
                {editingReq&&(
                  <button onClick={()=>{setEditingReq(null);setForm({startDate:"",endDate:"",reason:"",type:"Congés payés",urgent:false});}}
                    style={{padding:"13px 18px",background:"#F5F3EF",color:"#6B8A99",border:"none",borderRadius:"10px",fontSize:"14px",cursor:"pointer",fontFamily:"inherit"}}>
                    Annuler
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab==="my-requests"&&(
            myRequests.length===0
              ?<div style={{textAlign:"center",padding:"60px 24px",color:"#94B4C8"}}><div style={{fontSize:"44px",marginBottom:"12px"}}>📭</div><p>Aucune demande</p></div>
              :<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                {[...myRequests].map(req=>{
                  const s=STATUS_COLORS[req.status];
                  return(
                    <div key={req.id} style={{background:"white",borderRadius:"14px",padding:"16px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",borderLeft:`4px solid ${s.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                        <div style={{fontWeight:"700",color:"#1a2e38",fontSize:"14px"}}>{req.urgent&&"🚨 "}{req.type}</div>
                        <span style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`,borderRadius:"20px",padding:"3px 10px",fontSize:"11px",fontWeight:"600"}}>{s.label}</span>
                      </div>
                      <div style={{color:"#6B8A99",fontSize:"12px",marginBottom:"4px"}}>📅 {formatDate(req.start_date)} → {formatDate(req.end_date)} · <strong style={{color:"#2980B9"}}>{req.cp} j CP</strong></div>
                      {req.reason&&<div style={{color:"#94B4C8",fontSize:"12px",fontStyle:"italic"}}>"{req.reason}"</div>}
                      {req.status==="pending"&&(
                        <div style={{display:"flex",gap:"8px",marginTop:"10px"}}>
                          <button onClick={()=>{setEditingReq(req.id);setForm({startDate:req.start_date,endDate:req.end_date,reason:req.reason||"",type:req.type,urgent:req.urgent||false});setActiveTab("submit");}}
                            style={{background:"#EBF5FB",color:"#2980B9",border:"1px solid #BDE0F5",borderRadius:"8px",padding:"6px 12px",cursor:"pointer",fontSize:"12px",fontFamily:"inherit"}}>
                            ✏️ Modifier
                          </button>
                          <button onClick={()=>deleteRequest(req.id)}
                            style={{background:"none",border:"1px solid #F5C6CB",color:"#E85D75",borderRadius:"8px",padding:"6px 12px",cursor:"pointer",fontSize:"12px",fontFamily:"inherit"}}>
                            Annuler
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
          )}

          {activeTab==="calendar"&&(
            <div style={{background:"white",borderRadius:"16px",padding:"20px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}}>
                <h3 style={{margin:0,color:"#1a2e38",fontSize:"16px"}}>Absences approuvées</h3>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <button onClick={()=>{const d=new Date(empCalYear,empCalMonth-1);setEmpCalMonth(d.getMonth());setEmpCalYear(d.getFullYear());}} style={{background:"#F5F3EF",border:"none",borderRadius:"8px",padding:"5px 10px",cursor:"pointer",fontSize:"16px"}}>‹</button>
                  <span style={{fontWeight:"700",color:"#1a2e38",minWidth:"120px",textAlign:"center",fontSize:"13px"}}>{MONTH_NAMES[empCalMonth]} {empCalYear}</span>
                  <button onClick={()=>{const d=new Date(empCalYear,empCalMonth+1);setEmpCalMonth(d.getMonth());setEmpCalYear(d.getFullYear());}} style={{background:"#F5F3EF",border:"none",borderRadius:"8px",padding:"5px 10px",cursor:"pointer",fontSize:"16px"}}>›</button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"2px",marginBottom:"2px"}}>
                {["L","M","M","J","V","S","D"].map((d,i)=>(
                  <div key={i} style={{textAlign:"center",fontSize:"11px",fontWeight:"700",color:"#94B4C8",padding:"3px"}}>{d}</div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"2px"}}>
                {(()=>{
                  const fd=new Date(empCalYear,empCalMonth,1).getDay();
                  const off=fd===0?6:fd-1;
                  const dim=new Date(empCalYear,empCalMonth+1,0).getDate();
                  const feries=getFeries(empCalYear);
                  const cells=[];
                  for(let i=0;i<off;i++) cells.push(<div key={`e${i}`}/>);
                  for(let day=1;day<=dim;day++){
                    const dateStr=`${empCalYear}-${String(empCalMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                    const abs=requests.filter(r=>r.status==="approved"&&r.start_date<=dateStr&&r.end_date>=dateStr);
                    const today=new Date();
                    const isToday=today.getDate()===day&&today.getMonth()===empCalMonth&&today.getFullYear()===empCalYear;
                    const isFerie=feries.has(dateStr);
                    const isMe=abs.some(r=>r.employee===selEmp.name);
                    cells.push(
                      <div key={day} style={{minHeight:"44px",padding:"2px",borderRadius:"6px",background:isFerie?"#F0F4F8":isToday?"#EBF5FB":abs.length>0?"#FFF9F0":"#F9F8F6",border:isMe?`2px solid ${color}`:(isToday?"1px solid #2980B9":"1px solid transparent")}}>
                        <div style={{fontSize:"10px",fontWeight:isToday?"700":"500",color:isFerie?"#94B4C8":isToday?"#2980B9":"#1a2e38",marginBottom:"2px"}}>{day}</div>
                        {abs.slice(0,3).map(a=>(<div key={a.id} style={{width:"100%",height:"4px",borderRadius:"2px",background:empColor(a.employee),marginBottom:"1px"}} title={a.employee}/>))}
                        {abs.length>3&&<div style={{fontSize:"8px",color:"#94B4C8"}}>+{abs.length-3}</div>}
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
              <div style={{marginTop:"12px",display:"flex",flexWrap:"wrap",gap:"8px"}}>
                {employees.map((emp,i)=>(<div key={emp.name} style={{display:"flex",alignItems:"center",gap:"4px",fontSize:"11px",color:emp.name===selEmp.name?"#1a2e38":"#5A7A8A",fontWeight:emp.name===selEmp.name?"700":"400"}}><div style={{width:"10px",height:"10px",borderRadius:"2px",background:EMPLOYEE_COLORS[i]}}/>{emp.name}{emp.name===selEmp.name?" (moi)":""}</div>))}
              </div>
            </div>
          )}

          {activeTab==="change-pw"&&(
            <div style={{background:"white",borderRadius:"16px",padding:"24px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
              <h3 style={{margin:"0 0 18px",color:"#1a2e38",fontSize:"17px"}}>🔑 Changer mon mot de passe</h3>
              {[["old","Ancien mot de passe"],["new1","Nouveau mot de passe"],["new2","Confirmer"]].map(([f,l])=>(
                <div key={f} style={{marginBottom:"12px"}}>
                  <label style={{display:"block",fontSize:"13px",fontWeight:"600",color:"#5A7A8A",marginBottom:"6px"}}>{l}</label>
                  <input type="password" value={newPw[f]} onChange={e=>setNewPw({...newPw,[f]:e.target.value})}
                    style={{width:"100%",padding:"11px",border:"1px solid #E2DDD6",borderRadius:"10px",fontSize:"14px",fontFamily:"inherit",boxSizing:"border-box",color:"#1a2e38"}} />
                </div>
              ))}
              {newPwError&&<div style={{color:"#E85D75",fontSize:"13px",marginBottom:"10px"}}>{newPwError}</div>}
              {newPwSuccess&&<div style={{color:"#16A34A",fontSize:"13px",marginBottom:"10px",fontWeight:"600"}}>✅ Mot de passe modifié !</div>}
              <button onClick={changePassword} style={{width:"100%",padding:"13px",background:color,color:"white",border:"none",borderRadius:"10px",fontSize:"15px",fontWeight:"700",cursor:"pointer",fontFamily:"inherit"}}>Modifier</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── MANAGER LOCK ─────────────────────────────────────────────────────────
  if(view==="manager"&&!mgrUnlocked){
    const tryMgr=async()=>{
      if(mgrPwInput===MANAGER_PASSWORD){
        setMgrUnlocked(true);setMgrPwInput("");
        if(mgrRememberMe){try{localStorage.setItem("pharma_remember_mgr","true");}catch{}}
      } else setMgrPwError(true);
    };
    return (
      <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0F2027,#203A43,#2C5364)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Georgia',serif",padding:"24px"}}>
        <div style={{background:"rgba(255,255,255,0.06)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"20px",padding:"40px",width:"100%",maxWidth:"340px"}}>
          <button onClick={()=>setView("home")} style={{background:"none",border:"none",color:"#94B4C8",cursor:"pointer",fontSize:"13px",marginBottom:"22px",fontFamily:"inherit"}}>← Retour</button>
          <div style={{textAlign:"center",marginBottom:"26px"}}>
            <div style={{fontSize:"40px",marginBottom:"10px"}}>🔐</div>
            <h2 style={{color:"#E8D5A3",fontSize:"20px",margin:"0 0 6px"}}>Accès Gérant</h2>
          </div>
          <input type="password" value={mgrPwInput} onChange={e=>{setMgrPwInput(e.target.value);setMgrPwError(false);}} onKeyDown={e=>e.key==="Enter"&&tryMgr()} placeholder="Mot de passe..."
            style={{width:"100%",padding:"13px",background:"rgba(255,255,255,0.08)",border:`1px solid ${mgrPwError?"#E85D75":"rgba(255,255,255,0.15)"}`,borderRadius:"10px",color:"white",fontSize:"15px",fontFamily:"inherit",marginBottom:"10px",boxSizing:"border-box",outline:"none"}} />
          {mgrPwError&&<div style={{color:"#E85D75",fontSize:"13px",marginBottom:"10px"}}>Mot de passe incorrect</div>}
          <label style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:"#94B4C8",marginBottom:"14px",cursor:"pointer"}}>
            <input type="checkbox" checked={mgrRememberMe} onChange={e=>setMgrRememberMe(e.target.checked)} />
            Se souvenir de moi
          </label>
          <button onClick={tryMgr} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#E8D5A3,#C9A84C)",border:"none",borderRadius:"10px",fontSize:"15px",fontWeight:"700",cursor:"pointer",color:"#1a1a1a",fontFamily:"inherit"}}>Accéder</button>
        </div>
      </div>
    );
  }

  // ── MANAGER DASHBOARD ────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"#F5F3EF",fontFamily:"'Georgia',serif"}}>
      {motifModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"24px"}}>
          <div style={{background:"white",borderRadius:"16px",padding:"28px",width:"100%",maxWidth:"380px"}}>
            <h3 style={{margin:"0 0 14px",color:"#1a2e38"}}>Motif du refus</h3>
            <textarea value={motifRefus} onChange={e=>setMotifRefus(e.target.value)} rows={4} placeholder="Expliquez le motif (optionnel)..."
              style={{width:"100%",padding:"11px",border:"1px solid #E2DDD6",borderRadius:"10px",fontSize:"14px",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}} />
            <div style={{display:"flex",gap:"10px",marginTop:"16px"}}>
              <button onClick={confirmRefus} style={{flex:1,padding:"12px",background:"#E85D75",color:"white",border:"none",borderRadius:"10px",fontSize:"14px",fontWeight:"700",cursor:"pointer",fontFamily:"inherit"}}>Confirmer le refus</button>
              <button onClick={()=>{setMotifModal(null);setMotifRefus("");}} style={{padding:"12px 16px",background:"#F5F3EF",color:"#6B8A99",border:"none",borderRadius:"10px",cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      <div style={{background:"linear-gradient(135deg,#1a2e38,#2C5364)",padding:"18px 24px",color:"white"}}>
        <div style={{maxWidth:"900px",margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <h1 style={{margin:0,fontSize:"18px",color:"#E8D5A3"}}>💊 Pharmacie RUSSO — Gérant</h1>
            <p style={{margin:"3px 0 0",fontSize:"12px",color:"#94B4C8"}}>Données en temps réel 🟢</p>
          </div>
          <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
            {pendingCount>0&&<span style={{background:"#E85D75",color:"white",borderRadius:"20px",padding:"4px 12px",fontSize:"13px",fontWeight:"700"}}>{pendingCount} en attente</span>}
            <button onClick={async()=>{setMgrUnlocked(false);setView("home");try{localStorage.removeItem("pharma_remember_mgr");}catch{}}}
              style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"white",borderRadius:"8px",padding:"7px 14px",cursor:"pointer",fontSize:"13px",fontFamily:"inherit"}}>
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      <div style={{background:"white",borderBottom:"1px solid #E8E4DC",overflowX:"auto"}}>
        <div style={{maxWidth:"900px",margin:"0 auto",display:"flex"}}>
          {[["requests","📋 Demandes"],["calendar","📅 Calendrier"],["recap","📊 Récap"],["soldes","🏦 Soldes CP"],["planning","⚙️ Plannings"]].map(([tab,label])=>(
            <button key={tab} onClick={()=>setMgrTab(tab)}
              style={{padding:"14px 18px",border:"none",borderBottom:`3px solid ${mgrTab===tab?"#2C5364":"transparent"}`,background:"none",cursor:"pointer",fontSize:"13px",fontWeight:"600",fontFamily:"inherit",color:mgrTab===tab?"#1a2e38":"#94B4C8",whiteSpace:"nowrap"}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:"900px",margin:"0 auto",padding:"24px"}}>

        {chevauchements.length>0&&mgrTab==="requests"&&(
          <div style={{background:"#FFF3CD",border:"1px solid #FFEAA7",borderRadius:"12px",padding:"14px 18px",marginBottom:"20px"}}>
            <div style={{fontWeight:"700",color:"#856404",marginBottom:"8px"}}>⚠️ Chevauchements</div>
            {chevauchements.map((c,i)=><div key={i} style={{color:"#856404",fontSize:"13px"}}>• {c}</div>)}
          </div>
        )}

        {mgrTab==="requests"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px",marginBottom:"24px"}}>
              {[
                {label:"En attente",count:requests.filter(r=>r.status==="pending").length,color:"#F4A62A",icon:"⏳"},
                {label:"Approuvées",count:requests.filter(r=>r.status==="approved").length,color:"#16A34A",icon:"✅"},
                {label:"Refusées",count:requests.filter(r=>r.status==="rejected").length,color:"#E85D75",icon:"❌"},
              ].map(s=>(
                <div key={s.label} style={{background:"white",borderRadius:"14px",padding:"16px",textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",borderTop:`3px solid ${s.color}`}}>
                  <div style={{fontSize:"22px"}}>{s.icon}</div>
                  <div style={{fontSize:"26px",fontWeight:"700",color:s.color}}>{s.count}</div>
                  <div style={{fontSize:"12px",color:"#94B4C8"}}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{background:"white",borderRadius:"16px",padding:"22px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
              <h3 style={{margin:"0 0 18px",color:"#1a2e38",fontSize:"17px"}}>Toutes les demandes</h3>
              {requests.length===0
                ?<div style={{textAlign:"center",padding:"40px",color:"#94B4C8"}}><div style={{fontSize:"40px"}}>📭</div><p>Aucune demande</p></div>
                :<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                  {[...requests].sort((a,b)=>a.status==="pending"?-1:1).map(req=>{
                    const color=empColor(req.employee);const s=STATUS_COLORS[req.status];
                    return(
                      <div key={req.id} style={{border:`1px solid ${req.urgent?"#F5C6CB":"#E8E4DC"}`,borderRadius:"12px",padding:"14px 16px",display:"flex",flexWrap:"wrap",gap:"10px",alignItems:"center",background:req.urgent?"#FFF5F5":"white"}}>
                        <div style={{width:"38px",height:"38px",borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"13px",fontWeight:"700",flexShrink:0}}>{initials(req.employee)}</div>
                        <div style={{flex:1,minWidth:"120px"}}>
                          <div style={{fontWeight:"700",color:"#1a2e38",fontSize:"14px"}}>{req.urgent&&"🚨 "}{req.employee}</div>
                          <div style={{color:"#6B8A99",fontSize:"12px"}}>{req.type} · <strong style={{color:"#2980B9"}}>{req.cp} j CP</strong></div>
                          <div style={{color:"#94B4C8",fontSize:"12px"}}>{formatDate(req.start_date)} → {formatDate(req.end_date)}</div>
                          {req.reason&&<div style={{color:"#94B4C8",fontSize:"11px",fontStyle:"italic"}}>"{req.reason}"</div>}
                        </div>
                        <div style={{display:"flex",gap:"6px",alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
                          <span style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`,borderRadius:"20px",padding:"3px 10px",fontSize:"11px",fontWeight:"600"}}>{s.label}</span>
                          {req.status==="pending"&&<>
                            <button onClick={()=>handleStatus(req.id,"approved")} style={{background:"#D4EDDA",color:"#155724",border:"1px solid #C3E6CB",borderRadius:"8px",padding:"6px 14px",cursor:"pointer",fontSize:"14px",fontWeight:"700",fontFamily:"inherit"}}>✓</button>
                            <button onClick={()=>handleStatus(req.id,"rejected")} style={{background:"#F8D7DA",color:"#721C24",border:"1px solid #F5C6CB",borderRadius:"8px",padding:"6px 14px",cursor:"pointer",fontSize:"14px",fontWeight:"700",fontFamily:"inherit"}}>✗</button>
                          </>}
                          {req.status!=="pending"&&(
                            <button onClick={()=>handleStatus(req.id,"pending")} style={{background:"#fff3cd",color:"#856404",border:"1px solid #ffeaa7",borderRadius:"8px",padding:"5px 10px",cursor:"pointer",fontSize:"11px",fontFamily:"inherit"}}>Remettre</button>
                          )}
                          <button onClick={()=>deleteRequest(req.id)} style={{background:"none",border:"1px solid #E2DDD6",color:"#94B4C8",borderRadius:"8px",padding:"6px 10px",cursor:"pointer",fontSize:"13px"}}>🗑</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              }
            </div>
          </>
        )}

        {mgrTab==="calendar"&&(
          <div style={{background:"white",borderRadius:"16px",padding:"22px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"18px",flexWrap:"wrap",gap:"10px"}}>
              <h3 style={{margin:0,color:"#1a2e38",fontSize:"17px"}}>Absences approuvées</h3>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <button onClick={()=>{const d=new Date(calYear,calMonth-1);setCalMonth(d.getMonth());setCalYear(d.getFullYear());}} style={{background:"#F5F3EF",border:"none",borderRadius:"8px",padding:"6px 12px",cursor:"pointer",fontSize:"16px"}}>‹</button>
                <span style={{fontWeight:"700",color:"#1a2e38",minWidth:"130px",textAlign:"center",fontSize:"14px"}}>{MONTH_NAMES[calMonth]} {calYear}</span>
                <button onClick={()=>{const d=new Date(calYear,calMonth+1);setCalMonth(d.getMonth());setCalYear(d.getFullYear());}} style={{background:"#F5F3EF",border:"none",borderRadius:"8px",padding:"6px 12px",cursor:"pointer",fontSize:"16px"}}>›</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"3px",marginBottom:"3px"}}>
              {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d=>(
                <div key={d} style={{textAlign:"center",fontSize:"11px",fontWeight:"700",color:"#94B4C8",padding:"4px"}}>{d}</div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"3px"}}>
              {Array(offset).fill(null).map((_,i)=><div key={`e${i}`}/>)}
              {Array(daysInMonth).fill(null).map((_,i)=>{
                const day=i+1;
                const dateStr=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const absences=getAbsencesForDay(day);
                const today=new Date();
                const isToday=today.getDate()===day&&today.getMonth()===calMonth&&today.getFullYear()===calYear;
                const isFerie=getFeries(calYear).has(dateStr);
                return(
                  <div key={day} style={{minHeight:"52px",padding:"3px",borderRadius:"7px",background:isFerie?"#F0F4F8":isToday?"#EBF5FB":absences.length>0?"#FFF9F0":"#F9F8F6",border:isToday?"1px solid #2980B9":"1px solid transparent"}}>
                    <div style={{fontSize:"11px",fontWeight:isToday?"700":"500",color:isFerie?"#94B4C8":isToday?"#2980B9":"#1a2e38",marginBottom:"2px"}}>{day}{isFerie&&" 🎉"}</div>
                    {absences.slice(0,3).map(a=>(<div key={a.id} style={{width:"100%",height:"5px",borderRadius:"3px",background:empColor(a.employee),marginBottom:"2px"}} title={a.employee}/>))}
                    {absences.length>3&&<div style={{fontSize:"9px",color:"#94B4C8"}}>+{absences.length-3}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:"14px",display:"flex",flexWrap:"wrap",gap:"10px"}}>
              {employees.map((emp,i)=>(<div key={emp.name} style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"12px",color:"#5A7A8A"}}><div style={{width:"11px",height:"11px",borderRadius:"3px",background:EMPLOYEE_COLORS[i]}}/>{emp.name}</div>))}
            </div>
          </div>
        )}

        {mgrTab==="recap"&&(
          <div style={{background:"white",borderRadius:"16px",padding:"22px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"22px",flexWrap:"wrap",gap:"10px"}}>
              <h3 style={{margin:0,color:"#1a2e38",fontSize:"17px"}}>📊 Récapitulatif mensuel</h3>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <button onClick={()=>{const d=new Date(recapYear,recapMonth-1);setRecapMonth(d.getMonth());setRecapYear(d.getFullYear());}} style={{background:"#F5F3EF",border:"none",borderRadius:"8px",padding:"6px 12px",cursor:"pointer",fontSize:"16px"}}>‹</button>
                <span style={{fontWeight:"700",color:"#1a2e38",minWidth:"130px",textAlign:"center",fontSize:"14px"}}>{MONTH_NAMES[recapMonth]} {recapYear}</span>
                <button onClick={()=>{const d=new Date(recapYear,recapMonth+1);setRecapMonth(d.getMonth());setRecapYear(d.getFullYear());}} style={{background:"#F5F3EF",border:"none",borderRadius:"8px",padding:"6px 12px",cursor:"pointer",fontSize:"16px"}}>›</button>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {recap.map((emp,i)=>(
                <div key={emp.name} style={{display:"flex",alignItems:"center",gap:"14px",padding:"14px 16px",background:"#F9F8F6",borderRadius:"12px",borderLeft:`4px solid ${EMPLOYEE_COLORS[i]}`}}>
                  <div style={{width:"40px",height:"40px",borderRadius:"50%",background:EMPLOYEE_COLORS[i],display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"14px",fontWeight:"700",flexShrink:0}}>{initials(emp.name)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"700",color:"#1a2e38",fontSize:"14px"}}>{emp.name}</div>
                    <div style={{color:"#6B8A99",fontSize:"12px"}}>{emp.count} période{emp.count>1?"s":""}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:"24px",fontWeight:"700",color:emp.total>0?"#E85D75":"#16A34A"}}>{emp.total}</div>
                    <div style={{fontSize:"11px",color:"#94B4C8"}}>j CP</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:"16px",padding:"12px 16px",background:"#F0F4F8",borderRadius:"10px",fontSize:"13px",color:"#5A7A8A"}}>
              <strong>Total {MONTH_NAMES[recapMonth]} :</strong> {recap.reduce((s,e)=>s+e.total,0)} jours CP pris
            </div>
          </div>
        )}

        {mgrTab==="soldes"&&(
          <div style={{background:"white",borderRadius:"16px",padding:"22px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
            <h3 style={{margin:"0 0 6px",color:"#1a2e38",fontSize:"17px"}}>🏦 Soldes de départ CP</h3>
            <p style={{color:"#94B4C8",fontSize:"13px",marginBottom:"22px"}}>Modifiez le solde de départ pour chaque employé. L'app déduit automatiquement les congés approuvés.</p>
            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
              {employees.map((emp,i)=>{
                const pris=requests.filter(r=>r.employee===emp.name&&r.status==="approved").reduce((s,r)=>s+(r.cp||0),0);
                const base=soldesManuel[emp.name]??CP_QUOTA;
                const restant=Math.max(0,base-pris);
                return(
                  <div key={emp.name} style={{display:"flex",alignItems:"center",gap:"14px",padding:"16px",background:"#F9F8F6",borderRadius:"12px",borderLeft:`4px solid ${EMPLOYEE_COLORS[i]}`}}>
                    <div style={{width:"40px",height:"40px",borderRadius:"50%",background:EMPLOYEE_COLORS[i],display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"14px",fontWeight:"700",flexShrink:0}}>{initials(emp.name)}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:"700",color:"#1a2e38",fontSize:"14px",marginBottom:"4px"}}>{emp.name}</div>
                      <div style={{fontSize:"12px",color:"#6B8A99"}}>Pris : <strong>{pris} j</strong> · Restant : <strong style={{color:restant<5?"#E85D75":"#16A34A"}}>{restant} j</strong></div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
                      <input type="number" min="0" max="60" value={base}
                        onChange={e=>updateSolde(emp.name,e.target.value)}
                        style={{width:"60px",padding:"8px",border:"1px solid #E2DDD6",borderRadius:"8px",fontSize:"15px",fontWeight:"700",textAlign:"center",color:"#1a2e38",fontFamily:"inherit"}} />
                      <span style={{fontSize:"12px",color:"#94B4C8"}}>jours</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {mgrTab==="planning"&&(
          <div style={{background:"white",borderRadius:"16px",padding:"22px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
            <h3 style={{margin:"0 0 6px",color:"#1a2e38",fontSize:"17px"}}>⚙️ Plannings — Semaines A & B</h3>
            <p style={{color:"#94B4C8",fontSize:"13px",marginBottom:"22px"}}>Semaines impaires = A, paires = B.</p>
            <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
              {employees.map((emp,i)=>{
                const pA=plannings[emp.name]?.A||DEFAULT_PLANNING;
                const pB=plannings[emp.name]?.B||DEFAULT_PLANNING;
                return(
                  <div key={emp.name} style={{padding:"16px",background:"#F9F8F6",borderRadius:"12px",borderLeft:`4px solid ${EMPLOYEE_COLORS[i]}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px"}}>
                      <div style={{width:"36px",height:"36px",borderRadius:"50%",background:EMPLOYEE_COLORS[i],display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"13px",fontWeight:"700"}}>{initials(emp.name)}</div>
                      <div style={{fontWeight:"700",color:"#1a2e38",fontSize:"14px"}}>{emp.name}</div>
                    </div>
                    {[["A",pA],["B",pB]].map(([sem,days])=>(
                      <div key={sem} style={{marginBottom:"10px"}}>
                        <div style={{fontSize:"12px",fontWeight:"700",color:"#5A7A8A",marginBottom:"6px"}}>Semaine {sem}</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                          {ALL_DAYS.map(day=>{
                            const active=days.includes(day);
                            return(
                              <button key={day} onClick={()=>toggleDay(emp.name,sem,day)}
                                style={{padding:"5px 10px",borderRadius:"8px",border:`1px solid ${active?EMPLOYEE_COLORS[i]:"#E2DDD6"}`,background:active?EMPLOYEE_COLORS[i]:"white",color:active?"white":"#6B8A99",fontSize:"12px",fontWeight:"600",cursor:"pointer",fontFamily:"inherit"}}>
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
