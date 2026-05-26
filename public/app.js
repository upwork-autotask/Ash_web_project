const INSTALMENT_STATUSES = ['Upcoming', 'Due', 'Overdue', 'Reminder sent', 'Received'];
const STORAGE_KEY = 'uw007-commission-tracker-v1';
const REMINDER_WINDOW_DAYS = 30;
const seedStudents = [
  {id:'E001', name:'Maya Chen', course:'Business Analytics', college:'Monash University Malaysia', owner:'Ash', enrolledDate:'2025-09-12', startTerm:'Sep 2025', notes:'3-year programme. First instalment received.',
    instalments:[
      {no:1, dueDate:'2025-10-15', amount:1850, received:'2025-10-18', status:'Received'},
      {no:2, dueDate:'2026-03-15', amount:1850, received:'', status:'Overdue', lastReminder:'2026-04-22'},
      {no:3, dueDate:'2026-09-15', amount:1850, received:'', status:'Upcoming'},
      {no:4, dueDate:'2027-03-15', amount:1850, received:'', status:'Upcoming'},
      {no:5, dueDate:'2027-09-15', amount:1850, received:'', status:'Upcoming'},
      {no:6, dueDate:'2028-03-15', amount:1850, received:'', status:'Upcoming'},
    ]},
  {id:'E002', name:'Ravi Patel', course:'Computer Science', college:'Asia Pacific University', owner:'Team', enrolledDate:'2025-08-05', startTerm:'Sep 2025', notes:'Annual instalment cycle.',
    instalments:[
      {no:1, dueDate:'2025-09-30', amount:2200, received:'2025-10-04', status:'Received'},
      {no:2, dueDate:'2026-05-30', amount:2200, received:'', status:'Due'},
      {no:3, dueDate:'2027-05-30', amount:2200, received:'', status:'Upcoming'},
    ]},
  {id:'E003', name:'Sofia Lim', course:'Hospitality Management', college:'Taylor’s University', owner:'Ash', enrolledDate:'2026-01-20', startTerm:'Feb 2026', notes:'New enrolment, awaiting first commission.',
    instalments:[
      {no:1, dueDate:'2026-04-30', amount:1031, received:'', status:'Overdue', lastReminder:'2026-05-09'},
      {no:2, dueDate:'2026-10-30', amount:1031, received:'', status:'Upcoming'},
      {no:3, dueDate:'2027-04-30', amount:1031, received:'', status:'Upcoming'},
      {no:4, dueDate:'2027-10-30', amount:1031, received:'', status:'Upcoming'},
    ]},
  {id:'E004', name:'Daniel Wong', course:'Engineering', college:'University of Nottingham Malaysia', owner:'Team', enrolledDate:'2026-02-10', startTerm:'Feb 2026', notes:'Bursar confirmed schedule.',
    instalments:[
      {no:1, dueDate:'2026-05-25', amount:1170, received:'', status:'Due'},
      {no:2, dueDate:'2026-11-25', amount:1170, received:'', status:'Upcoming'},
      {no:3, dueDate:'2027-05-25', amount:1170, received:'', status:'Upcoming'},
    ]},
  {id:'E005', name:'Anika Rao', course:'Finance', college:'Sunway University', owner:'Ash', enrolledDate:'2025-09-01', startTerm:'Sep 2025', notes:'Two-year programme.',
    instalments:[
      {no:1, dueDate:'2025-11-01', amount:1073, received:'2025-11-03', status:'Received'},
      {no:2, dueDate:'2026-05-01', amount:1073, received:'', status:'Reminder sent', lastReminder:'2026-05-12'},
      {no:3, dueDate:'2026-11-01', amount:1073, received:'', status:'Upcoming'},
      {no:4, dueDate:'2027-05-01', amount:1073, received:'', status:'Upcoming'},
    ]},
  {id:'E006', name:'Liam Tan', course:'Business Analytics', college:'HELP University', owner:'Team', enrolledDate:'2024-09-12', startTerm:'Sep 2024', notes:'Final instalment pending.',
    instalments:[
      {no:1, dueDate:'2024-11-01', amount:725, received:'2024-11-05', status:'Received'},
      {no:2, dueDate:'2025-05-01', amount:725, received:'2025-05-12', status:'Received'},
      {no:3, dueDate:'2025-11-01', amount:725, received:'', status:'Overdue', lastReminder:'2026-03-08'},
    ]},
];
let state = loadState();
let currentView = 'dashboard';
let cloudReady = false;
function freshState(){const fresh={students:JSON.parse(JSON.stringify(seedStudents)), activity:[]}; recomputeStatuses(fresh.students); return fresh;}
function loadState(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)); if(saved?.students){recomputeStatuses(saved.students); return {...saved, activity:saved.activity||[]};} return freshState();}catch{return freshState();}}
function saveState(){localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); if(cloudReady) syncStateToCloud();}
async function loadCloudState(){try{const res=await fetch('/api/state',{cache:'no-store'}); if(!res.ok) throw new Error('Cloud sync unavailable'); const data=await res.json(); if(data.state?.students){state={...data.state, activity:data.state.activity||[]}; recomputeStatuses(state.students); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); renderOwnerFilter(); render();} else {await syncStateToCloud();} cloudReady=true;}catch(error){console.warn(error.message); cloudReady=false;}}
async function syncStateToCloud(){try{await fetch('/api/state',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(state)});}catch(error){console.warn('Cloud save failed', error.message);}}
function today(){return new Date().toISOString().slice(0,10);}
function daysUntil(date){return Math.ceil((new Date(date+'T00:00:00')-new Date(today()+'T00:00:00'))/86400000);}
function money(v){return '$'+Math.round(Number(v||0)).toLocaleString();}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function statusClass(status){return status.split(' ')[0];}
function recomputeStatuses(students){for(const s of students){for(const i of (s.instalments||[])){if(i.received){i.status='Received'; continue;} const d=daysUntil(i.dueDate); if(d<0){i.status='Overdue';} else if(d<=REMINDER_WINDOW_DAYS){i.status=i.lastReminder?'Reminder sent':'Due';} else {i.status='Upcoming';}}}}
function flatInstalments(){return state.students.flatMap(s=>(s.instalments||[]).map(i=>({...i, studentId:s.id, studentName:s.name, college:s.college, owner:s.owner, course:s.course})));}
function totalExpected(s){return (s.instalments||[]).filter(i=>i.status!=='Received').reduce((a,b)=>a+Number(b.amount||0),0);}
function totalReceived(s){return (s.instalments||[]).filter(i=>i.status==='Received').reduce((a,b)=>a+Number(b.amount||0),0);}
function totalCommission(s){return (s.instalments||[]).reduce((a,b)=>a+Number(b.amount||0),0);}
function nextDue(s){const pending=(s.instalments||[]).filter(i=>i.status!=='Received').sort((a,b)=>a.dueDate.localeCompare(b.dueDate)); return pending[0];}
function setView(view){currentView=view; document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); document.getElementById(view+'View').classList.add('active'); document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.dataset.view===view)); document.getElementById('pageTitle').textContent={dashboard:'Dashboard',enrolments:'Enrolments',schedule:'Schedule',reminders:'Reminders',reports:'Reports',settings:'Upgrade'}[view]||view; render(); window.scrollTo({top:0,behavior:'smooth'});}
function initOptions(){renderOwnerFilter(); const sf=document.getElementById('statusFilter'); if(sf){sf.innerHTML='<option value="">All instalment states</option>'+INSTALMENT_STATUSES.map(s=>`<option>${s}</option>`).join('');}}
function renderOwnerFilter(){const owners=[...new Set(state.students.map(s=>s.owner).filter(Boolean))].sort(); const of=document.getElementById('ownerFilter'); if(of)of.innerHTML='<option value="">All owners</option>'+owners.map(o=>`<option>${o}</option>`).join('');}
function render(){recomputeStatuses(state.students); renderMetrics(); renderEnrolments(); renderSchedule(); renderReminders(); renderReports(); renderDue(); renderActivity();}
function renderMetrics(){const all=flatInstalments(); const expected=all.filter(i=>i.status!=='Received').reduce((a,b)=>a+Number(b.amount||0),0); const received=all.filter(i=>i.status==='Received').reduce((a,b)=>a+Number(b.amount||0),0); const overdue=all.filter(i=>i.status==='Overdue').length; const due30=all.filter(i=>['Due','Reminder sent'].includes(i.status)).length; document.getElementById('metrics').innerHTML=[['Expected commission',money(expected),'across all pending instalments'],['Received to date',money(received),'paid by colleges so far'],['Overdue instalments',overdue,'past due, need chasing'],['Due in 30 days',due30,'instalments inside reminder window']].map(m=>`<article><small>${m[0]}</small><strong>${m[1]}</strong><span>${m[2]}</span></article>`).join('');}
function renderEnrolments(){const q=(document.getElementById('searchInput')?.value||'').toLowerCase(); const of=document.getElementById('ownerFilter')?.value||''; const rows=state.students.filter(s=>(!of||s.owner===of)&&[s.name,s.course,s.college,s.owner,s.notes].join(' ').toLowerCase().includes(q)); document.getElementById('studentRows').innerHTML=rows.map(s=>{const nd=nextDue(s); return `<tr><td><b>${esc(s.name)}</b><br><small>${s.id} · ${esc(s.startTerm||'')}</small></td><td>${esc(s.course)}<br><small>${esc(s.college||'—')}</small></td><td><b>${money(totalCommission(s))}</b><br><small>${(s.instalments||[]).length} instalments</small></td><td><b>${money(totalReceived(s))}</b><br><small>Expected ${money(totalExpected(s))}</small></td><td>${nd?`<span class="status ${statusClass(nd.status)}">${esc(nd.status)}</span><br><small>${esc(nd.dueDate)} · ${money(nd.amount)}</small>`:'<small>All paid</small>'}</td><td>${esc(s.owner||'—')}</td><td><button class="linkbtn" onclick="editStudent('${s.id}')">Edit</button></td></tr>`;}).join('')||'<tr><td colspan="7">No enrolments match.</td></tr>';}
function renderSchedule(){const lanes=['Overdue','Due','Reminder sent','Upcoming','Received']; const all=flatInstalments(); document.getElementById('kanban').innerHTML=lanes.map(status=>{const items=all.filter(i=>i.status===status).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)); return `<div class="lane"><h3>${status} <small>(${items.length})</small></h3>${items.map(i=>`<div class="ticket"><b>${esc(i.studentName)} · #${i.no}</b><small>${esc(i.college)}<br>Due ${esc(i.dueDate)} · ${money(i.amount)}${i.received?`<br>Received ${esc(i.received)}`:''}${i.lastReminder?`<br>Reminder ${esc(i.lastReminder)}`:''}</small></div>`).join('')||'<small>None</small>'}</div>`;}).join('');}
function renderReminders(){const sf=document.getElementById('statusFilter')?.value||''; const all=flatInstalments().filter(i=>['Overdue','Due','Reminder sent'].includes(i.status)).filter(i=>!sf||i.status===sf).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)); const byCollege={}; for(const i of all){(byCollege[i.college]||(byCollege[i.college]=[])).push(i);} const blocks=Object.entries(byCollege).map(([college,items])=>`<article class="card"><div class="card-head"><h2>${esc(college)}</h2><span class="pill amber">${items.length} to chase</span></div><div class="list">${items.map(i=>`<div class="list-item"><b>${esc(i.studentName)} · instalment ${i.no} · ${esc(i.status)}</b><small>Due ${esc(i.dueDate)} · ${money(i.amount)} · owner ${esc(i.owner||'—')}${i.lastReminder?` · last reminder ${esc(i.lastReminder)}`:''}</small><div class="row-actions"><button class="btn secondary" onclick="markReminderSent('${i.studentId}',${i.no})">Mark reminder sent today</button>${i.status!=='Received'?`<button class="btn primary" onclick="markReceived('${i.studentId}',${i.no})">Mark received today</button>`:''}</div></div>`).join('')}</div></article>`).join(''); document.getElementById('remindersList').innerHTML=blocks||'<article class="card"><p>No instalments need chasing today.</p></article>';}
function renderReports(){const all=flatInstalments(); const byCollege={}; for(const i of all){const k=i.college||'—'; const b=byCollege[k]||(byCollege[k]={expected:0,received:0,count:0}); b.count++; b.expected+=Number(i.amount||0); if(i.status==='Received')b.received+=Number(i.amount||0);} const rows=Object.entries(byCollege).sort((a,b)=>b[1].expected-a[1].expected).map(([k,v])=>{const remaining=Math.max(0,v.expected-v.received); return `<tr><td><b>${esc(k)}</b></td><td>${v.count}</td><td>${money(v.expected)}</td><td>${money(v.received)}</td><td>${money(remaining)}</td></tr>`;}).join(''); document.getElementById('collegeRows').innerHTML=rows||'<tr><td colspan="5">No data.</td></tr>'; const byMonth={}; for(const i of all){const m=i.dueDate.slice(0,7); const b=byMonth[m]||(byMonth[m]={expected:0,received:0}); if(i.status==='Received')b.received+=Number(i.amount||0); else b.expected+=Number(i.amount||0);} const months=Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)); const max=Math.max(1,...months.map(([,v])=>v.expected+v.received)); document.getElementById('monthBars').innerHTML=months.map(([m,v])=>`<label>${esc(m)} <span>${money(v.expected+v.received)}</span></label><div class="stack"><i style="width:${Math.round(v.received/max*100)}%;background:#10B981" title="Received"></i><i style="width:${Math.round(v.expected/max*100)}%;background:#1D4ED8" title="Expected"></i></div>`).join('');}
function renderDue(){const due=flatInstalments().filter(i=>['Overdue','Due','Reminder sent'].includes(i.status)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,8); document.getElementById('dueCount').textContent=`${due.length} to chase`; document.getElementById('dueList').innerHTML=due.map(i=>`<div class="list-item"><b>${esc(i.studentName)} · ${esc(i.status)}</b><small>${esc(i.college)} · instalment ${i.no} due ${esc(i.dueDate)} · ${money(i.amount)} · owner ${esc(i.owner||'—')}</small></div>`).join('')||'<p>No instalments need chasing right now.</p>';}
function renderActivity(){const acts=(state.activity.length?state.activity:[{at:'Demo seeded', text:'Seeded six enrolled students with multi-year instalment schedules.'},{at:'Call prep', text:'Tracker focuses on post-enrolment commission; Leeds CRM owns the funnel.'}]).slice(-6).reverse(); document.getElementById('activityList').innerHTML=acts.map(a=>`<div class="timeline-item"><b>${esc(a.text)}</b><small>${esc(a.at)}</small></div>`).join('');}
function markReminderSent(studentId, no){const s=state.students.find(x=>x.id===studentId); const i=s?.instalments.find(x=>x.no===no); if(!i)return; i.lastReminder=today(); state.activity.push({at:new Date().toLocaleString(), text:`Reminder logged for ${s.name} instalment ${no}`}); saveState(); render();}
function markReceived(studentId, no){const s=state.students.find(x=>x.id===studentId); const i=s?.instalments.find(x=>x.no===no); if(!i)return; i.received=today(); state.activity.push({at:new Date().toLocaleString(), text:`Received ${money(i.amount)} for ${s.name} instalment ${no}`}); saveState(); render();}
function openDialog(student){document.getElementById('modalTitle').textContent=student?'Edit enrolment':'New enrolment'; document.getElementById('studentId').value=student?.id||''; ['name','course','college','owner','enrolledDate','startTerm','notes'].forEach(id=>{const el=document.getElementById(id); if(el)el.value=student?.[id]||'';}); document.getElementById('deleteBtn').style.visibility=student?'visible':'hidden'; const ins=student?.instalments||[]; document.getElementById('instalmentList').innerHTML=ins.length?`<table><thead><tr><th>#</th><th>Due</th><th>Amount</th><th>Status</th><th>Received</th></tr></thead><tbody>${ins.map(i=>`<tr><td>${i.no}</td><td>${esc(i.dueDate)}</td><td>${money(i.amount)}</td><td><span class="status ${statusClass(i.status)}">${esc(i.status)}</span></td><td>${esc(i.received||'—')}</td></tr>`).join('')}</tbody></table>`:'<p><small>No instalments. Production version supports add/edit instalments per enrolment.</small></p>'; document.getElementById('studentDialog').showModal();}
function editStudent(id){openDialog(state.students.find(s=>s.id===id));}
function saveStudent(){const id=document.getElementById('studentId').value || `E${String(Date.now()).slice(-5)}`; const rec={id, instalments:state.students.find(s=>s.id===id)?.instalments||[]}; ['name','course','college','owner','enrolledDate','startTerm','notes'].forEach(k=>{const el=document.getElementById(k); if(el)rec[k]=el.value;}); const idx=state.students.findIndex(s=>s.id===id); if(idx>=0)state.students[idx]={...state.students[idx], ...rec}; else state.students.push(rec); state.activity.push({at:new Date().toLocaleString(), text:`Saved enrolment ${rec.name}`}); saveState(); renderOwnerFilter(); render();}
function deleteStudent(){const id=document.getElementById('studentId').value; state.students=state.students.filter(s=>s.id!==id); state.activity.push({at:new Date().toLocaleString(), text:`Removed enrolment ${id}`}); saveState(); render(); document.getElementById('studentDialog').close();}
function exportCsv(){const headers=['enrolmentId','student','college','course','instalmentNo','dueDate','amount','status','received','lastReminder']; const rows=flatInstalments().map(i=>[i.studentId,i.studentName,i.college,i.course,i.no,i.dueDate,i.amount,i.status,i.received||'',i.lastReminder||'']); const csv=[headers.join(','), ...rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))].join('\n'); download('uw007-commission-tracker.csv', csv, 'text/csv');}
function exportJson(){download('uw007-commission-tracker-backup.json', JSON.stringify(state,null,2), 'application/json');}
function download(name, content, type){const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500);}
document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault(); setView(a.dataset.view);}));
document.querySelectorAll('[data-jump]').forEach(el=>el.addEventListener('click',()=>setView(el.dataset.jump)));
document.getElementById('newStudentBtn')?.addEventListener('click',()=>openDialog());
document.getElementById('heroNewStudentBtn')?.addEventListener('click',()=>openDialog());
document.getElementById('studentForm').addEventListener('submit',e=>{e.preventDefault(); saveStudent(); document.getElementById('studentDialog').close();});
document.getElementById('deleteBtn').addEventListener('click',deleteStudent);
document.getElementById('cancelBtn')?.addEventListener('click',(e)=>{e.preventDefault(); e.stopPropagation(); document.getElementById('studentDialog').close();});
document.getElementById('modalCloseBtn')?.addEventListener('click',(e)=>{e.preventDefault(); e.stopPropagation(); document.getElementById('studentDialog').close();});
document.getElementById('exportCsvBtn').addEventListener('click',exportCsv);
document.getElementById('exportJsonBtn').addEventListener('click',exportJson);
document.getElementById('resetBtn')?.addEventListener('click',()=>{if(confirm('Reset demo data?')){state={students:JSON.parse(JSON.stringify(seedStudents)),activity:[]}; recomputeStatuses(state.students); saveState(); renderOwnerFilter(); render();}});
['searchInput','ownerFilter'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderEnrolments));
document.getElementById('statusFilter')?.addEventListener('input',renderReminders);
initOptions(); render(); loadCloudState();

const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navCloseBtn = document.getElementById('navCloseBtn');
const navBackdrop = document.getElementById('navBackdrop');
function openNav(){document.body.classList.add('nav-open'); mobileMenuBtn?.setAttribute('aria-expanded','true');}
function closeNav(){document.body.classList.remove('nav-open'); mobileMenuBtn?.setAttribute('aria-expanded','false');}
mobileMenuBtn?.addEventListener('click', openNav);
navCloseBtn?.addEventListener('click', closeNav);
navBackdrop?.addEventListener('click', closeNav);
document.querySelectorAll('.sidebar nav a').forEach(a=>a.addEventListener('click', closeNav));
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeNav(); });