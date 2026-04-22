import { useState, useEffect, useCallback } from "react";

// ── CONFIG ──────────────────────────────────────────────────────────────────
const EMAILJS_SERVICE_ID  = "service_otrm554";
const EMAILJS_TEMPLATE_ID = "template_zgbs6vq";
const EMAILJS_PUBLIC_KEY  = "7JGYreAQOLQA5PEiP";
const MANAGER_EMAIL       = "david.russo94@gmail.com";

const EMPLOYEES = [
  { name: "Basma",  password: "basma123",  email: "basma.charif5@gmail.com"       },
  { name: "Lysa",   password: "lysa123",   email: "abboudlysa@gmail.com"           },
  { name: "Hanane", password: "hanane123", email: "hanane.handoura@hotmail.com"    },
  { name: "Walid",  password: "walid123",  email: "walsfr@gmail.com"               },
  { name: "Billal", password: "billal123", email: "dahmanbillal@icloud.com"        },
  { name: "Jeiza",  password: "jeiza123",  email: "jeizasilvajei2000@gmail.com"    },
];

const MANAGER_PASSWORD = "pharma2024";

const ALL_DAYS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
// 0=Mon,1=Tue,2=Wed,3=Thu,4=Fri,5=Sat (we ignore Sunday)
const DAY_JS_INDEX = { "Lundi":1,"Mardi":2,"Mercredi":3,"Jeudi":4,"Vendredi":5,"Samedi":6 };

const DEFAULT_PLANNING = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

const STATUS_COLORS = {
  pending:  { bg: "#FFF3CD", text: "#856404", border: "#FFEAA7", label: "En attente" },
  approved: { bg: "#D4EDDA", text: "#155724", border: "#C3E6CB", label: "Approuvé"   },
  rejected: { bg: "#F8D7DA", text: "#721C24", border: "#F5C6CB", label: "Refusé"     },
};

const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const EMPLOYEE_COLORS = ["#4F6BED","#E85D75","#2DBBB6","#F4A62A","#8B5CF6","#EC6E3A"];

// ── HELPERS ─────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function initials(name) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase();
}

function empColor(name) {
  const idx = EMPLOYEES.findIndex(e => e.name === name);
  return EMPLOYEE_COLORS[idx] ?? "#4F6BED";
}

// Calcul CP pharmacie : on compte les jours travaillés du premier jour travaillé
// jusqu'à la veille du retour (inclus)
function calcCP(startDate, endDate, workedDays) {
  if (!startDate || !endDate || !workedDays || workedDays.length === 0) return 0;
  const workedJsIndices = workedDays.map(d => DAY_JS_INDEX[d]);
  let count = 0;
  const start = new Date(startDate);
  const end   = new Date(endDate);
  // find first worked day >= start
  let cur = new Date(start);
  // find actual first day to count from
  let firstDay = null;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (workedJsIndices.includes(d.getDay())) { firstDay = new Date(d); break; }
  }
  if (!firstDay) return 0;
  // count worked days from firstDay to end (= veille de la reprise)
  for (let d = new Date(firstDay); d <= end; d.setDate(d.getDate() + 1)) {
    if (workedJsIndices.includes(d.getDay())) count++;
  }
  return count;
}

// ── EMAILJS ─────────────────────────────────────────────────────────────────
async function sendEmail({ to_email, to_name, subject, message }) {
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID, template_id: EMAILJS_TEMPLATE_ID, user_id: EMAILJS_PUBLIC_KEY,
        template_params: { to_email, to_name, subject, message },
      }),
    });
    return res.ok;
  } catch { return false; }
}

async function notifyManagerNewRequest(employee, req, cp) {
  return sendEmail({
    to_email: MANAGER_EMAIL, to_name: "David",
    subject: `Nouvelle demande de congé – ${employee.name}`,
    message: `${employee.name} a soumis une demande de congé.\n\nType : ${req.type}\nDu : ${formatDate(req.startDate)}\nAu : ${formatDate(req.endDate)}\nJours CP comptés : ${cp}\n${req.reason ? `Commentaire : ${req.reason}` : ""}\n\nConnectez-vous à l'application pour valider ou refuser.`,
  });
}

async function notifyEmployeeDecision(employee, req, status) {
  const approved = status === "approved";
  return sendEmail({
    to_email: employee.email, to_name: employee.name,
    subject: `Votre demande de congé a été ${approved ? "approuvée ✅" : "refusée ❌"}`,
    message: `Bonjour ${employee.name},\n\nVotre demande de congé a été ${approved ? "approuvée" : "refusée"}.\n\nType : ${req.type}\nDu : ${formatDate(req.startDate)}\nAu : ${formatDate(req.endDate)}\nJours CP : ${req.cp}\n\n${approved ? "Bonnes vacances ! 🎉" : "N'hésitez pas à soumettre une nouvelle demande."}`,
  });
}

// ── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]                         = useState("home");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [empPasswordInput, setEmpPasswordInput] = useState("");
  const [empPasswordError, setEmpPasswordError] = useState(false);
  const [pendingLogin, setPendingLogin]         = useState(null);
  const [managerUnlocked, setManagerUnlocked]   = useState(false);
  const [managerPwInput, setManagerPwInput]     = useState("");
  const [managerPwError, setManagerPwError]     = useState(false);
  const [requests, setRequests]                 = useState([]);
  const [plannings, setPlannings]               = useState(() => {
    const p = {};
    EMPLOYEES.forEach(e => p[e.name] = [...DEFAULT_PLANNING]);
    return p;
  });
  const [activeTab, setActiveTab]               = useState("submit");
  const [managerTab, setManagerTab]             = useState("requests"); // requests | calendar | recap | planning
  const [calendarMonth, setCalendarMonth]       = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear]         = useState(new Date().getFullYear());
  const [recapMonth, setRecapMonth]             = useState(new Date().getMonth());
  const [recapYear, setRecapYear]               = useState(new Date().getFullYear());
  const [form, setForm]                         = useState({ startDate: "", endDate: "", reason: "", type: "Congés payés" });
  const [formError, setFormError]               = useState("");
  const [formSuccess, setFormSuccess]           = useState(false);
  const [sendingEmail, setSendingEmail]         = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("pharma_requests");
        if (r) setRequests(JSON.parse(r.value));
      } catch {}
      try {
        const p = await window.storage.get("pharma_plannings");
        if (p) setPlannings(JSON.parse(p.value));
      } catch {}
    })();
  }, []);

  const saveRequests = useCallback(async (reqs) => {
    setRequests(reqs);
    try { await window.storage.set("pharma_requests", JSON.stringify(reqs)); } catch {}
  }, []);

  const savePlannings = useCallback(async (p) => {
    setPlannings(p);
    try { await window.storage.set("pharma_plannings", JSON.stringify(p)); } catch {}
  }, []);

  function toggleDay(empName, day) {
    const current = plannings[empName] || [];
    const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    savePlannings({ ...plannings, [empName]: updated });
  }

  async function submitRequest() {
    setFormError("");
    if (!form.startDate || !form.endDate) return setFormError("Veuillez choisir les dates.");
    if (form.endDate < form.startDate) return setFormError("La date de fin doit être après le début.");
    const empPlanning = plannings[selectedEmployee.name] || DEFAULT_PLANNING;
    const cp = calcCP(form.startDate, form.endDate, empPlanning);
    const req = {
      id: Date.now().toString(),
      employee: selectedEmployee.name,
      startDate: form.startDate, endDate: form.endDate,
      type: form.type, reason: form.reason, cp,
      status: "pending", submittedAt: new Date().toISOString(),
    };
    await saveRequests([...requests, req]);
    setForm({ startDate: "", endDate: "", reason: "", type: "Congés payés" });
    setSendingEmail(true);
    await notifyManagerNewRequest(selectedEmployee, req, cp);
    setSendingEmail(false);
    setFormSuccess(true);
    setTimeout(() => setFormSuccess(false), 4000);
  }

  async function updateStatus(id, status) {
    const updated = requests.map(r => r.id === id ? { ...r, status } : r);
    await saveRequests(updated);
    if (status === "approved" || status === "rejected") {
      const req = requests.find(r => r.id === id);
      if (req) {
        const emp = EMPLOYEES.find(e => e.name === req.employee);
        if (emp) await notifyEmployeeDecision(emp, req, status);
      }
    }
  }

  function deleteRequest(id) { saveRequests(requests.filter(r => r.id !== id)); }

  const myRequests   = requests.filter(r => r.employee === selectedEmployee?.name);
  const pendingCount = requests.filter(r => r.status === "pending").length;

  function getCalendarDays() {
    const firstDay    = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    return { offset: firstDay === 0 ? 6 : firstDay - 1, daysInMonth };
  }

  function getAbsencesForDay(day) {
    const date = `${calendarYear}-${String(calendarMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return requests.filter(r => r.status === "approved" && r.startDate <= date && r.endDate >= date);
  }

  // Recap mensuel
  function getMonthlyRecap() {
    const firstDay = `${recapYear}-${String(recapMonth+1).padStart(2,"0")}-01`;
    const lastDay  = `${recapYear}-${String(recapMonth+1).padStart(2,"0")}-${new Date(recapYear, recapMonth+1, 0).getDate()}`;
    return EMPLOYEES.map(emp => {
      const empReqs = requests.filter(r =>
        r.employee === emp.name &&
        r.status === "approved" &&
        r.startDate <= lastDay &&
        r.endDate >= firstDay
      );
      const totalCP = empReqs.reduce((s, r) => {
        // recalculate CP overlap with the month
        const start = r.startDate < firstDay ? firstDay : r.startDate;
        const end   = r.endDate   > lastDay  ? lastDay  : r.endDate;
        return s + calcCP(start, end, plannings[emp.name] || DEFAULT_PLANNING);
      }, 0);
      return { name: emp.name, totalCP, count: empReqs.length };
    });
  }

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (view === "home") return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0F2027,#203A43,#2C5364)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Georgia',serif", padding:"24px" }}>
      <div style={{ textAlign:"center", marginBottom:"44px" }}>
        <div style={{ fontSize:"52px", marginBottom:"8px" }}>💊</div>
        <h1 style={{ color:"#E8D5A3", fontSize:"clamp(22px,5vw,34px)", fontWeight:"700", margin:"0 0 4px", letterSpacing:"0.04em" }}>Pharmacie RUSSO</h1>
        <p style={{ color:"#94B4C8", fontSize:"14px", margin:0, fontStyle:"italic" }}>Gestion des congés payés</p>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:"14px", width:"100%", maxWidth:"320px" }}>
        <button onClick={() => setView("employee")}
          style={{ background:"linear-gradient(135deg,#E8D5A3,#C9A84C)", border:"none", borderRadius:"14px", padding:"18px 24px", cursor:"pointer", fontSize:"16px", fontWeight:"700", color:"#1a1a1a", fontFamily:"inherit", display:"flex", alignItems:"center", gap:"12px", boxShadow:"0 4px 20px rgba(200,168,76,0.3)" }}
          onMouseEnter={e => e.currentTarget.style.opacity="0.9"} onMouseLeave={e => e.currentTarget.style.opacity="1"}>
          <span style={{ fontSize:"22px" }}>👤</span> Espace Employé
        </button>
        <button onClick={() => setView("manager")}
          style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:"14px", padding:"18px 24px", cursor:"pointer", fontSize:"16px", fontWeight:"700", color:"#E8D5A3", fontFamily:"inherit", display:"flex", alignItems:"center", gap:"12px", backdropFilter:"blur(10px)" }}
          onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.14)"} onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.08)"}>
          <span style={{ fontSize:"22px" }}>🔐</span> Espace Gérant
          {pendingCount > 0 && <span style={{ marginLeft:"auto", background:"#E85D75", color:"white", borderRadius:"20px", padding:"2px 10px", fontSize:"12px" }}>{pendingCount}</span>}
        </button>
      </div>
    </div>
  );

  // ── EMPLOYEE — choose name ─────────────────────────────────────────────────
  if (view === "employee" && !selectedEmployee && !pendingLogin) return (
    <div style={{ minHeight:"100vh", background:"#F5F3EF", fontFamily:"'Georgia',serif", padding:"24px" }}>
      <div style={{ maxWidth:"440px", margin:"0 auto" }}>
        <button onClick={() => setView("home")} style={{ background:"none", border:"none", color:"#5A7A8A", cursor:"pointer", fontSize:"14px", marginBottom:"28px", fontFamily:"inherit" }}>← Retour</button>
        <h2 style={{ color:"#1a2e38", fontSize:"24px", marginBottom:"6px" }}>Qui êtes-vous ?</h2>
        <p style={{ color:"#6B8A99", fontSize:"13px", marginBottom:"22px" }}>Sélectionnez votre prénom</p>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {EMPLOYEES.map((emp, i) => (
            <button key={emp.name} onClick={() => { setPendingLogin(emp); setEmpPasswordInput(""); setEmpPasswordError(false); }}
              style={{ background:"white", border:"1px solid #E2DDD6", borderRadius:"12px", padding:"14px 18px", cursor:"pointer", textAlign:"left", fontSize:"15px", fontWeight:"600", color:"#1a2e38", fontFamily:"inherit", display:"flex", alignItems:"center", gap:"14px", boxShadow:"0 2px 8px rgba(0,0,0,0.04)", transition:"border-color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor=EMPLOYEE_COLORS[i]} onMouseLeave={e => e.currentTarget.style.borderColor="#E2DDD6"}>
              <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:EMPLOYEE_COLORS[i], display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"15px", fontWeight:"700", flexShrink:0 }}>
                {initials(emp.name)}
              </div>
              {emp.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── EMPLOYEE — password ────────────────────────────────────────────────────
  if (view === "employee" && !selectedEmployee && pendingLogin) {
    const idx = EMPLOYEES.findIndex(e => e.name === pendingLogin.name);
    const color = EMPLOYEE_COLORS[idx];
    const tryLogin = () => {
      if (empPasswordInput === pendingLogin.password) { setSelectedEmployee(pendingLogin); setPendingLogin(null); setEmpPasswordInput(""); }
      else setEmpPasswordError(true);
    };
    return (
      <div style={{ minHeight:"100vh", background:"#F5F3EF", fontFamily:"'Georgia',serif", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
        <div style={{ background:"white", borderRadius:"20px", padding:"36px", width:"100%", maxWidth:"340px", boxShadow:"0 8px 32px rgba(0,0,0,0.08)" }}>
          <button onClick={() => { setPendingLogin(null); setEmpPasswordError(false); }} style={{ background:"none", border:"none", color:"#5A7A8A", cursor:"pointer", fontSize:"13px", marginBottom:"22px", fontFamily:"inherit" }}>← Changer</button>
          <div style={{ textAlign:"center", marginBottom:"26px" }}>
            <div style={{ width:"64px", height:"64px", borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"22px", fontWeight:"700", margin:"0 auto 12px" }}>
              {initials(pendingLogin.name)}
            </div>
            <h2 style={{ color:"#1a2e38", fontSize:"20px", margin:"0 0 4px" }}>Bonjour, {pendingLogin.name} !</h2>
            <p style={{ color:"#94B4C8", fontSize:"13px", margin:0 }}>Entrez votre mot de passe</p>
          </div>
          <input type="password" value={empPasswordInput}
            onChange={e => { setEmpPasswordInput(e.target.value); setEmpPasswordError(false); }}
            onKeyDown={e => e.key === "Enter" && tryLogin()}
            placeholder="Mot de passe..."
            style={{ width:"100%", padding:"12px", border:`1px solid ${empPasswordError ? "#E85D75" : "#E2DDD6"}`, borderRadius:"10px", fontSize:"15px", fontFamily:"inherit", boxSizing:"border-box", outline:"none", marginBottom:"10px" }} />
          {empPasswordError && <div style={{ color:"#E85D75", fontSize:"13px", marginBottom:"10px" }}>Mot de passe incorrect</div>}
          <button onClick={tryLogin}
            style={{ width:"100%", padding:"13px", background:color, color:"white", border:"none", borderRadius:"10px", fontSize:"15px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  // ── EMPLOYEE DASHBOARD ─────────────────────────────────────────────────────
  if (view === "employee" && selectedEmployee) {
    const idx   = EMPLOYEES.findIndex(e => e.name === selectedEmployee.name);
    const color = EMPLOYEE_COLORS[idx];
    const totalCP = myRequests.filter(r => r.status === "approved").reduce((s, r) => s + (r.cp || 0), 0);
    const empPlanning = plannings[selectedEmployee.name] || DEFAULT_PLANNING;
    const previewCP = form.startDate && form.endDate && form.endDate >= form.startDate
      ? calcCP(form.startDate, form.endDate, empPlanning) : null;

    return (
      <div style={{ minHeight:"100vh", background:"#F5F3EF", fontFamily:"'Georgia',serif" }}>
        <div style={{ background:color, padding:"22px 24px", color:"white" }}>
          <div style={{ maxWidth:"600px", margin:"0 auto" }}>
            <button onClick={() => { setSelectedEmployee(null); setActiveTab("submit"); }}
              style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"white", borderRadius:"8px", padding:"6px 14px", cursor:"pointer", fontSize:"13px", marginBottom:"18px", fontFamily:"inherit" }}>
              ← Changer de compte
            </button>
            <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
              <div style={{ width:"54px", height:"54px", borderRadius:"50%", background:"rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", fontWeight:"700" }}>
                {initials(selectedEmployee.name)}
              </div>
              <div>
                <div style={{ fontSize:"20px", fontWeight:"700" }}>{selectedEmployee.name}</div>
                <div style={{ opacity:0.8, fontSize:"13px" }}>{totalCP} jour{totalCP>1?"s":""} CP approuvé{totalCP>1?"s":""}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth:"600px", margin:"0 auto", padding:"24px" }}>
          <div style={{ display:"flex", gap:"4px", background:"white", borderRadius:"12px", padding:"4px", marginBottom:"22px", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
            {[["submit","✏️ Demander"],["my-requests","📋 Mes demandes"]].map(([tab,label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex:1, padding:"10px", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"14px", fontWeight:"600", fontFamily:"inherit", background:activeTab===tab ? color:"transparent", color:activeTab===tab ? "white":"#6B8A99", transition:"all 0.2s" }}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === "submit" && (
            <div style={{ background:"white", borderRadius:"16px", padding:"24px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin:"0 0 18px", color:"#1a2e38", fontSize:"17px" }}>Nouvelle demande</h3>
              <label style={{ display:"block", fontSize:"13px", fontWeight:"600", color:"#5A7A8A", marginBottom:"6px" }}>Type</label>
              <select value={form.type} onChange={e => setForm({...form,type:e.target.value})}
                style={{ width:"100%", padding:"11px", border:"1px solid #E2DDD6", borderRadius:"10px", fontSize:"14px", fontFamily:"inherit", marginBottom:"14px", background:"white", color:"#1a2e38" }}>
                <option>Congés payés</option><option>RTT</option><option>Congé sans solde</option><option>Congé maladie</option><option>Autre</option>
              </select>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"14px" }}>
                {[["startDate","1er jour de congé"],["endDate","Dernier jour de congé"]].map(([field,label]) => (
                  <div key={field}>
                    <label style={{ display:"block", fontSize:"13px", fontWeight:"600", color:"#5A7A8A", marginBottom:"6px" }}>{label}</label>
                    <input type="date" value={form[field]} onChange={e => setForm({...form,[field]:e.target.value})}
                      style={{ width:"100%", padding:"11px", border:"1px solid #E2DDD6", borderRadius:"10px", fontSize:"14px", fontFamily:"inherit", boxSizing:"border-box", color:"#1a2e38" }} />
                  </div>
                ))}
              </div>
              {previewCP !== null && (
                <div style={{ background:"#EBF5FB", borderRadius:"8px", padding:"10px 14px", marginBottom:"14px", fontSize:"13px", color:"#2980B9", fontWeight:"600" }}>
                  📅 {previewCP} jour{previewCP>1?"s":""} CP décomptés (selon votre planning)
                </div>
              )}
              <label style={{ display:"block", fontSize:"13px", fontWeight:"600", color:"#5A7A8A", marginBottom:"6px" }}>Commentaire (optionnel)</label>
              <textarea value={form.reason} onChange={e => setForm({...form,reason:e.target.value})} rows={3} placeholder="Ex : vacances, rendez-vous médical..."
                style={{ width:"100%", padding:"11px", border:"1px solid #E2DDD6", borderRadius:"10px", fontSize:"14px", fontFamily:"inherit", resize:"vertical", boxSizing:"border-box", color:"#1a2e38" }} />
              {formError && <div style={{ color:"#E85D75", fontSize:"13px", marginTop:"8px" }}>{formError}</div>}
              {formSuccess && (
                <div style={{ background:"#D4EDDA", borderRadius:"8px", padding:"12px", marginTop:"10px", fontSize:"13px", color:"#155724", fontWeight:"600" }}>
                  ✅ Demande envoyée ! David a été notifié par email.
                </div>
              )}
              <button onClick={submitRequest} disabled={sendingEmail}
                style={{ width:"100%", marginTop:"18px", padding:"13px", background:sendingEmail?"#ccc":color, color:"white", border:"none", borderRadius:"10px", fontSize:"15px", fontWeight:"700", cursor:sendingEmail?"not-allowed":"pointer", fontFamily:"inherit" }}>
                {sendingEmail ? "Envoi en cours..." : "Envoyer la demande"}
              </button>
            </div>
          )}

          {activeTab === "my-requests" && (
            myRequests.length === 0
              ? <div style={{ textAlign:"center", padding:"60px 24px", color:"#94B4C8" }}><div style={{ fontSize:"44px", marginBottom:"12px" }}>📭</div><p>Aucune demande pour le moment</p></div>
              : <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                  {[...myRequests].reverse().map(req => {
                    const s = STATUS_COLORS[req.status];
                    return (
                      <div key={req.id} style={{ background:"white", borderRadius:"14px", padding:"16px", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", borderLeft:`4px solid ${s.border}` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                          <div style={{ fontWeight:"700", color:"#1a2e38", fontSize:"14px" }}>{req.type}</div>
                          <span style={{ background:s.bg, color:s.text, border:`1px solid ${s.border}`, borderRadius:"20px", padding:"3px 10px", fontSize:"11px", fontWeight:"600" }}>{s.label}</span>
                        </div>
                        <div style={{ color:"#6B8A99", fontSize:"12px", marginBottom:"4px" }}>
                          📅 {formatDate(req.startDate)} → {formatDate(req.endDate)}
                        </div>
                        <div style={{ color:"#2980B9", fontSize:"12px", fontWeight:"600", marginBottom:"4px" }}>
                          {req.cp} jour{req.cp>1?"s":""} CP décomptés
                        </div>
                        {req.reason && <div style={{ color:"#94B4C8", fontSize:"12px", fontStyle:"italic" }}>"{req.reason}"</div>}
                        {req.status === "pending" && (
                          <button onClick={() => deleteRequest(req.id)}
                            style={{ marginTop:"10px", background:"none", border:"1px solid #F5C6CB", color:"#E85D75", borderRadius:"8px", padding:"6px 12px", cursor:"pointer", fontSize:"12px", fontFamily:"inherit" }}>
                            Annuler la demande
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
          )}
        </div>
      </div>
    );
  }

  // ── MANAGER LOCK ───────────────────────────────────────────────────────────
  if (view === "manager" && !managerUnlocked) {
    const tryManager = () => {
      if (managerPwInput === MANAGER_PASSWORD) { setManagerUnlocked(true); setManagerPwInput(""); }
      else setManagerPwError(true);
    };
    return (
      <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0F2027,#203A43,#2C5364)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Georgia',serif", padding:"24px" }}>
        <div style={{ background:"rgba(255,255,255,0.06)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"20px", padding:"40px", width:"100%", maxWidth:"340px" }}>
          <button onClick={() => setView("home")} style={{ background:"none", border:"none", color:"#94B4C8", cursor:"pointer", fontSize:"13px", marginBottom:"22px", fontFamily:"inherit" }}>← Retour</button>
          <div style={{ textAlign:"center", marginBottom:"26px" }}>
            <div style={{ fontSize:"40px", marginBottom:"10px" }}>🔐</div>
            <h2 style={{ color:"#E8D5A3", fontSize:"20px", margin:"0 0 6px" }}>Accès Gérant</h2>
            <p style={{ color:"#94B4C8", fontSize:"13px", margin:0 }}>Entrez le mot de passe</p>
          </div>
          <input type="password" value={managerPwInput}
            onChange={e => { setManagerPwInput(e.target.value); setManagerPwError(false); }}
            onKeyDown={e => e.key === "Enter" && tryManager()}
            placeholder="Mot de passe..."
            style={{ width:"100%", padding:"13px", background:"rgba(255,255,255,0.08)", border:`1px solid ${managerPwError?"#E85D75":"rgba(255,255,255,0.15)"}`, borderRadius:"10px", color:"white", fontSize:"15px", fontFamily:"inherit", marginBottom:"10px", boxSizing:"border-box", outline:"none" }} />
          {managerPwError && <div style={{ color:"#E85D75", fontSize:"13px", marginBottom:"10px" }}>Mot de passe incorrect</div>}
          <button onClick={tryManager}
            style={{ width:"100%", padding:"13px", background:"linear-gradient(135deg,#E8D5A3,#C9A84C)", border:"none", borderRadius:"10px", fontSize:"15px", fontWeight:"700", cursor:"pointer", color:"#1a1a1a", fontFamily:"inherit" }}>
            Accéder
          </button>
        </div>
      </div>
    );
  }

  // ── MANAGER DASHBOARD ──────────────────────────────────────────────────────
  const { offset, daysInMonth } = getCalendarDays();
  const monthlyRecap = getMonthlyRecap();

  return (
    <div style={{ minHeight:"100vh", background:"#F5F3EF", fontFamily:"'Georgia',serif" }}>
      <div style={{ background:"linear-gradient(135deg,#1a2e38,#2C5364)", padding:"18px 24px", color:"white" }}>
        <div style={{ maxWidth:"900px", margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ margin:0, fontSize:"18px", color:"#E8D5A3" }}>💊 Pharmacie RUSSO — Gérant</h1>
            <p style={{ margin:"3px 0 0", fontSize:"12px", color:"#94B4C8" }}>Gestion des congés</p>
          </div>
          <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
            {pendingCount > 0 && <span style={{ background:"#E85D75", color:"white", borderRadius:"20px", padding:"4px 12px", fontSize:"13px", fontWeight:"700" }}>{pendingCount} en attente</span>}
            <button onClick={() => { setManagerUnlocked(false); setView("home"); }}
              style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", color:"white", borderRadius:"8px", padding:"7px 14px", cursor:"pointer", fontSize:"13px", fontFamily:"inherit" }}>
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Manager tabs */}
      <div style={{ background:"white", borderBottom:"1px solid #E8E4DC" }}>
        <div style={{ maxWidth:"900px", margin:"0 auto", display:"flex", gap:"0" }}>
          {[["requests","📋 Demandes"],["calendar","📅 Calendrier"],["recap","📊 Récapitulatif"],["planning","⚙️ Plannings"]].map(([tab,label]) => (
            <button key={tab} onClick={() => setManagerTab(tab)}
              style={{ padding:"14px 20px", border:"none", borderBottom:`3px solid ${managerTab===tab?"#2C5364":"transparent"}`, background:"none", cursor:"pointer", fontSize:"13px", fontWeight:"600", fontFamily:"inherit", color:managerTab===tab?"#1a2e38":"#94B4C8", transition:"all 0.2s" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:"900px", margin:"0 auto", padding:"24px" }}>

        {/* ── DEMANDES ── */}
        {managerTab === "requests" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"12px", marginBottom:"24px" }}>
              {[
                { label:"En attente", count:requests.filter(r=>r.status==="pending").length,  color:"#F4A62A", icon:"⏳" },
                { label:"Approuvées", count:requests.filter(r=>r.status==="approved").length, color:"#16A34A", icon:"✅" },
                { label:"Refusées",   count:requests.filter(r=>r.status==="rejected").length, color:"#E85D75", icon:"❌" },
              ].map(s => (
                <div key={s.label} style={{ background:"white", borderRadius:"14px", padding:"16px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", borderTop:`3px solid ${s.color}` }}>
                  <div style={{ fontSize:"22px" }}>{s.icon}</div>
                  <div style={{ fontSize:"26px", fontWeight:"700", color:s.color }}>{s.count}</div>
                  <div style={{ fontSize:"12px", color:"#94B4C8" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background:"white", borderRadius:"16px", padding:"22px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin:"0 0 18px", color:"#1a2e38", fontSize:"17px" }}>Toutes les demandes</h3>
              {requests.length === 0
                ? <div style={{ textAlign:"center", padding:"40px", color:"#94B4C8" }}><div style={{ fontSize:"40px", marginBottom:"10px" }}>📭</div><p>Aucune demande reçue</p></div>
                : <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                    {[...requests].sort((a,b) => a.status==="pending"?-1:1).map(req => {
                      const color = empColor(req.employee);
                      const s = STATUS_COLORS[req.status];
                      return (
                        <div key={req.id} style={{ border:"1px solid #E8E4DC", borderRadius:"12px", padding:"14px 16px", display:"flex", flexWrap:"wrap", gap:"10px", alignItems:"center" }}>
                          <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"13px", fontWeight:"700", flexShrink:0 }}>
                            {initials(req.employee)}
                          </div>
                          <div style={{ flex:1, minWidth:"120px" }}>
                            <div style={{ fontWeight:"700", color:"#1a2e38", fontSize:"14px" }}>{req.employee}</div>
                            <div style={{ color:"#6B8A99", fontSize:"12px" }}>{req.type} · <strong style={{ color:"#2980B9" }}>{req.cp} jour{req.cp>1?"s":""} CP</strong></div>
                            <div style={{ color:"#94B4C8", fontSize:"12px" }}>{formatDate(req.startDate)} → {formatDate(req.endDate)}</div>
                            {req.reason && <div style={{ color:"#94B4C8", fontSize:"11px", fontStyle:"italic" }}>"{req.reason}"</div>}
                          </div>
                          <div style={{ display:"flex", gap:"6px", alignItems:"center", flexShrink:0, flexWrap:"wrap" }}>
                            <span style={{ background:s.bg, color:s.text, border:`1px solid ${s.border}`, borderRadius:"20px", padding:"3px 10px", fontSize:"11px", fontWeight:"600" }}>{s.label}</span>
                            {req.status === "pending" && <>
                              <button onClick={() => updateStatus(req.id,"approved")}
                                style={{ background:"#D4EDDA", color:"#155724", border:"1px solid #C3E6CB", borderRadius:"8px", padding:"6px 14px", cursor:"pointer", fontSize:"14px", fontWeight:"700", fontFamily:"inherit" }}>✓</button>
                              <button onClick={() => updateStatus(req.id,"rejected")}
                                style={{ background:"#F8D7DA", color:"#721C24", border:"1px solid #F5C6CB", borderRadius:"8px", padding:"6px 14px", cursor:"pointer", fontSize:"14px", fontWeight:"700", fontFamily:"inherit" }}>✗</button>
                            </>}
                            {req.status !== "pending" && (
                              <button onClick={() => updateStatus(req.id,"pending")}
                                style={{ background:"#fff3cd", color:"#856404", border:"1px solid #ffeaa7", borderRadius:"8px", padding:"5px 10px", cursor:"pointer", fontSize:"11px", fontFamily:"inherit" }}>
                                Remettre en attente
                              </button>
                            )}
                            <button onClick={() => deleteRequest(req.id)}
                              style={{ background:"none", border:"1px solid #E2DDD6", color:"#94B4C8", borderRadius:"8px", padding:"6px 10px", cursor:"pointer", fontSize:"13px" }}>🗑</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              }
            </div>
          </>
        )}

        {/* ── CALENDRIER ── */}
        {managerTab === "calendar" && (
          <div style={{ background:"white", borderRadius:"16px", padding:"22px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px", flexWrap:"wrap", gap:"10px" }}>
              <h3 style={{ margin:0, color:"#1a2e38", fontSize:"17px" }}>Absences approuvées</h3>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <button onClick={() => { const d=new Date(calendarYear,calendarMonth-1); setCalendarMonth(d.getMonth()); setCalendarYear(d.getFullYear()); }}
                  style={{ background:"#F5F3EF", border:"none", borderRadius:"8px", padding:"6px 12px", cursor:"pointer", fontSize:"16px" }}>‹</button>
                <span style={{ fontWeight:"700", color:"#1a2e38", minWidth:"130px", textAlign:"center", fontSize:"14px" }}>{MONTH_NAMES[calendarMonth]} {calendarYear}</span>
                <button onClick={() => { const d=new Date(calendarYear,calendarMonth+1); setCalendarMonth(d.getMonth()); setCalendarYear(d.getFullYear()); }}
                  style={{ background:"#F5F3EF", border:"none", borderRadius:"8px", padding:"6px 12px", cursor:"pointer", fontSize:"16px" }}>›</button>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"3px", marginBottom:"3px" }}>
              {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d => (
                <div key={d} style={{ textAlign:"center", fontSize:"11px", fontWeight:"700", color:"#94B4C8", padding:"4px" }}>{d}</div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"3px" }}>
              {Array(offset).fill(null).map((_,i) => <div key={`e${i}`} />)}
              {Array(daysInMonth).fill(null).map((_,i) => {
                const day = i + 1;
                const absences = getAbsencesForDay(day);
                const today = new Date();
                const isToday = today.getDate()===day && today.getMonth()===calendarMonth && today.getFullYear()===calendarYear;
                return (
                  <div key={day} style={{ minHeight:"52px", padding:"3px", borderRadius:"7px", background:isToday?"#EBF5FB":absences.length>0?"#FFF9F0":"#F9F8F6", border:isToday?"1px solid #2980B9":"1px solid transparent" }}>
                    <div style={{ fontSize:"11px", fontWeight:isToday?"700":"500", color:isToday?"#2980B9":"#1a2e38", marginBottom:"2px" }}>{day}</div>
                    {absences.slice(0,3).map(a => (
                      <div key={a.id} style={{ width:"100%", height:"5px", borderRadius:"3px", background:empColor(a.employee), marginBottom:"2px" }} title={a.employee} />
                    ))}
                    {absences.length > 3 && <div style={{ fontSize:"9px", color:"#94B4C8" }}>+{absences.length-3}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:"14px", display:"flex", flexWrap:"wrap", gap:"10px" }}>
              {EMPLOYEES.map((emp, i) => (
                <div key={emp.name} style={{ display:"flex", alignItems:"center", gap:"5px", fontSize:"12px", color:"#5A7A8A" }}>
                  <div style={{ width:"11px", height:"11px", borderRadius:"3px", background:EMPLOYEE_COLORS[i] }} />
                  {emp.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RÉCAPITULATIF ── */}
        {managerTab === "recap" && (
          <div style={{ background:"white", borderRadius:"16px", padding:"22px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"22px", flexWrap:"wrap", gap:"10px" }}>
              <h3 style={{ margin:0, color:"#1a2e38", fontSize:"17px" }}>📊 Récapitulatif mensuel</h3>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <button onClick={() => { const d=new Date(recapYear,recapMonth-1); setRecapMonth(d.getMonth()); setRecapYear(d.getFullYear()); }}
                  style={{ background:"#F5F3EF", border:"none", borderRadius:"8px", padding:"6px 12px", cursor:"pointer", fontSize:"16px" }}>‹</button>
                <span style={{ fontWeight:"700", color:"#1a2e38", minWidth:"130px", textAlign:"center", fontSize:"14px" }}>{MONTH_NAMES[recapMonth]} {recapYear}</span>
                <button onClick={() => { const d=new Date(recapYear,recapMonth+1); setRecapMonth(d.getMonth()); setRecapYear(d.getFullYear()); }}
                  style={{ background:"#F5F3EF", border:"none", borderRadius:"8px", padding:"6px 12px", cursor:"pointer", fontSize:"16px" }}>›</button>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {monthlyRecap.map((emp, i) => (
                <div key={emp.name} style={{ display:"flex", alignItems:"center", gap:"14px", padding:"14px 16px", background:"#F9F8F6", borderRadius:"12px", borderLeft:`4px solid ${EMPLOYEE_COLORS[i]}` }}>
                  <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:EMPLOYEE_COLORS[i], display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"14px", fontWeight:"700", flexShrink:0 }}>
                    {initials(emp.name)}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:"700", color:"#1a2e38", fontSize:"14px" }}>{emp.name}</div>
                    <div style={{ color:"#6B8A99", fontSize:"12px" }}>{emp.count} période{emp.count>1?"s":""} de congé</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:"24px", fontWeight:"700", color: emp.totalCP > 0 ? "#E85D75" : "#16A34A" }}>{emp.totalCP}</div>
                    <div style={{ fontSize:"11px", color:"#94B4C8" }}>jour{emp.totalCP>1?"s":""} CP</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:"16px", padding:"12px 16px", background:"#F0F4F8", borderRadius:"10px", fontSize:"13px", color:"#5A7A8A" }}>
              <strong>Total {MONTH_NAMES[recapMonth]} :</strong> {monthlyRecap.reduce((s,e) => s+e.totalCP, 0)} jours CP pris par l'équipe
            </div>
          </div>
        )}

        {/* ── PLANNINGS ── */}
        {managerTab === "planning" && (
          <div style={{ background:"white", borderRadius:"16px", padding:"22px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin:"0 0 6px", color:"#1a2e38", fontSize:"17px" }}>⚙️ Plannings hebdomadaires</h3>
            <p style={{ color:"#94B4C8", fontSize:"13px", marginBottom:"22px" }}>Cochez les jours travaillés par chaque employé. Le calcul des CP se fera automatiquement.</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
              {EMPLOYEES.map((emp, i) => {
                const empDays = plannings[emp.name] || DEFAULT_PLANNING;
                return (
                  <div key={emp.name} style={{ padding:"16px", background:"#F9F8F6", borderRadius:"12px", borderLeft:`4px solid ${EMPLOYEE_COLORS[i]}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
                      <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:EMPLOYEE_COLORS[i], display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"13px", fontWeight:"700" }}>
                        {initials(emp.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight:"700", color:"#1a2e38", fontSize:"14px" }}>{emp.name}</div>
                        <div style={{ fontSize:"12px", color:"#94B4C8" }}>{empDays.length} jour{empDays.length>1?"s":""}/semaine</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
                      {ALL_DAYS.map(day => {
                        const active = empDays.includes(day);
                        return (
                          <button key={day} onClick={() => toggleDay(emp.name, day)}
                            style={{ padding:"6px 12px", borderRadius:"8px", border:`1px solid ${active ? EMPLOYEE_COLORS[i] : "#E2DDD6"}`, background:active ? EMPLOYEE_COLORS[i] : "white", color:active ? "white" : "#6B8A99", fontSize:"12px", fontWeight:"600", cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>
                            {day}
                          </button>
                        );
                      })}
                    </div>
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
