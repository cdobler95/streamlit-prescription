'use strict';
function renderAll(){
  if(!state)return;
  const completedCount=workflow.filter(s=>state.completed[s.id]).length;
  const progress=Math.round(completedCount/workflow.length*100);
  $('currentStepMetric').textContent=String(state.currentStep+1);
  $('progressMetric').textContent=progress+'%';
  $('releasedMetric').textContent=state.findings.filter(f=>state.released[f.id]).length;
  $('missedMetric').textContent=workflow.filter(s=>state.scores[s.id]==='missed').length;
  $('progressBar').style.width=progress+'%';
  $('previousStepBtn').disabled=state.currentStep<=0;
  $('nextStepBtn').disabled=state.currentStep>=workflow.length-1;
  renderStudent();
  renderCoach();
  saveLocal();
}
function patientIntro(){
  const p=state.patient;
  const bits=[p.name||'Unnamed patient',p.age!==''&&p.age!=null?`${p.age} years old`:'age not set',p.pronouns||'pronouns not set'];
  return bits.join(' · ');
}
function renderStudent(){
  $('studentPatientIntro').textContent=patientIntro();
  $('studentOpening').innerHTML=`<em>“${escapeHtml(state.patient.opening||'No opening statement entered yet.')}”</em><div class="notice">Chief concern: ${escapeHtml(state.patient.chief||'Not entered')} · Historian: ${escapeHtml(state.patient.historian||'Not entered')}</div>`;
  const root=$('studentWorkflow');
  root.innerHTML='';
  workflow.forEach((step,index)=>{
    const box=document.createElement('div');
    box.className='step'+(index===state.currentStep?' current':'')+(state.completed[step.id]?' done':'');
    box.innerHTML=`<div class="step-head"><div class="step-number">${index+1}</div><div style="flex:1"><div class="step-title">${escapeHtml(step.title)}</div><div class="step-prompt">${escapeHtml(step.student)}</div><div class="checkline" style="margin-top:9px"><input id="done-${step.id}" type="checkbox" ${state.completed[step.id]?'checked':''}><label for="done-${step.id}">Completed aloud</label></div></div></div>`;
    box.querySelector('input').addEventListener('change',e=>studentUpdate(()=>{state.completed[step.id]=e.target.checked;}));
    root.appendChild(box);
  });
  renderFeed($('studentFeed'));
  renderStudentFindings();
  if(document.activeElement!==$('studentNotes'))$('studentNotes').value=state.studentNotes||'';
}
function renderFeed(root){
  root.innerHTML='';
  if(!state.feed.length){root.innerHTML='<div class="muted">No patient responses yet.</div>';return;}
  state.feed.slice(-40).forEach(msg=>{
    const b=document.createElement('div');
    b.className='bubble '+(msg.kind==='system'?'system':'patient');
    if(msg.urgent)b.style.borderColor='var(--danger)';
    b.innerHTML=`<div>${escapeHtml(msg.text)}</div><div class="time">${new Date(msg.ts).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}${msg.urgent?' · URGENT':''}</div>`;
    root.appendChild(b);
  });
}
function renderStudentFindings(){
  const root=$('studentFindings');
  root.innerHTML='';
  const released=state.findings.filter(f=>state.released[f.id]);
  if(!released.length){root.innerHTML='<div class="muted">No hidden findings have been released.</div>';return;}
  released.forEach(f=>{
    const d=document.createElement('div');
    d.className='finding released';
    d.innerHTML=`<div class="section-label">${escapeHtml(stepTitle(f.section))}</div><div class="finding-title">${escapeHtml(f.label)}</div><div class="finding-text">${escapeHtml(f.text)}</div>`;
    root.appendChild(d);
  });
}
function renderCoach(){
  if(role!=='coach')return;
  $('templateSelect').value=state.templateId||'custom';
  fillIfNotFocused('patientHistorian',state.patient.historian);
  fillIfNotFocused('patientName',state.patient.name);
  fillIfNotFocused('patientAge',state.patient.age);
  fillIfNotFocused('patientPronouns',state.patient.pronouns);
  fillIfNotFocused('patientChief',state.patient.chief);
  fillIfNotFocused('patientOpening',state.patient.opening);
  fillIfNotFocused('patientBehavior',state.patient.behavior);
  if(document.activeElement!==$('coachPrivateNotes'))$('coachPrivateNotes').value=coachPrivateNotes;
  $('coachNotes').textContent=state.studentNotes||'No student notes entered yet.';
  renderFeed($('coachFeed'));
  renderCoachFindings();
  renderCoachWorkflow();
}
function renderCoachWorkflow(){
  const root=$('coachWorkflow');
  root.innerHTML='';
  workflow.forEach((step,index)=>{
    const selected=state.scores[step.id]||'';
    const box=document.createElement('div');
    box.className='step'+(index===state.currentStep?' current':'');
    box.innerHTML=`<div class="step-head"><div class="step-number">${index+1}</div><div style="flex:1"><div class="step-title">${escapeHtml(step.title)}</div><div class="step-prompt">${escapeHtml(step.coach)}</div><div class="button-row"><button class="btn ${index===state.currentStep?'soft':''} go-step" type="button">${index===state.currentStep?'Current section':'Move here'}</button></div><div class="score-controls"><button class="score-btn ${selected==='independent'?'active independent':''}" data-score="independent" type="button">Independent</button><button class="score-btn ${selected==='prompted'?'active prompted':''}" data-score="prompted" type="button">Prompted</button><button class="score-btn ${selected==='missed'?'active missed':''}" data-score="missed" type="button">Missed</button></div></div></div>`;
    box.querySelector('.go-step').addEventListener('click',()=>coachAction('setCurrentStep',{index}));
    box.querySelectorAll('[data-score]').forEach(btn=>btn.addEventListener('click',()=>coachAction('setScore',{stepId:step.id,value:selected===btn.dataset.score?'':btn.dataset.score})));
    root.appendChild(box);
  });
}
function renderCoachFindings(){
  const root=$('coachFindings');
  root.innerHTML='';
  if(!state.findings.length){root.innerHTML='<div class="muted">No hidden findings yet. Add one below.</div>';return;}
  state.findings.forEach(f=>{
    const d=document.createElement('div');
    d.className='finding'+(state.released[f.id]?' released':'');
    d.innerHTML=`<div class="grid two"><label>Professor section<select class="edit-section">${workflow.map(s=>`<option value="${s.id}" ${s.id===f.section?'selected':''}>${escapeHtml(s.title)}</option>`).join('')}</select></label><label>Finding label<input class="edit-label" type="text" value="${escapeAttr(f.label)}"></label></div><label style="margin-top:8px">Patient answer or physical finding<textarea class="edit-text">${escapeHtml(f.text)}</textarea></label><div class="button-row"><button class="btn ${state.released[f.id]?'soft':'primary'} release" type="button">${state.released[f.id]?'Hide from student':'Release to student'}</button><button class="btn danger delete" type="button">Delete</button></div>`;
    d.querySelector('.release').addEventListener('click',()=>coachAction('toggleRelease',{findingId:f.id,value:!state.released[f.id]}));
    d.querySelector('.delete').addEventListener('click',()=>{if(confirm('Delete this finding?'))coachAction('deleteFinding',{id:f.id});});
    bindDebounced(d.querySelector('.edit-section'),'change',v=>coachAction('updateFinding',{id:f.id,field:'section',value:v}));
    bindDebounced(d.querySelector('.edit-label'),'change',v=>coachAction('updateFinding',{id:f.id,field:'label',value:v}));
    bindDebounced(d.querySelector('.edit-text'),'change',v=>coachAction('updateFinding',{id:f.id,field:'text',value:v}));
    root.appendChild(d);
  });
}
function bindPatientField(id,field){
  $(id).addEventListener('input',e=>{
    clearTimeout(fieldTimer);
    const value=e.target.value;
    fieldTimer=setTimeout(()=>coachAction('setPatientField',{field,value}),220);
  });
}
function bindDebounced(el,event,fn){let t;el.addEventListener(event,e=>{clearTimeout(t);const v=e.target.value;t=setTimeout(()=>fn(v),220);});}
function fillIfNotFocused(id,value){if(document.activeElement!==$(id))$(id).value=value??'';}
function stepTitle(id){const s=workflow.find(x=>x.id===id);return s?s.title:id;}
function escapeHtml(value){return String(value??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function escapeAttr(value){return escapeHtml(value).replace(/'/g,'&#39;');}
function shareCoachLink(){
  const url=buildCoachLink(sessionCode);
  if(navigator.share){navigator.share({title:'Join my NR509 Clinical Lab session',text:'Open this link as my patient/coach. Reopen this same link if Safari refreshes.',url}).catch(()=>{});}else prompt('Copy this link:',url);
}
async function copyCoachLink(){
  const url=buildCoachLink(sessionCode);
  try{await navigator.clipboard.writeText(url);$('copyBtn').textContent='Copied ✓';}catch(_){prompt('Copy this link:',url);}
}
function forceReconnect(){if(role==='student')startStudentHost();else startCoachClient();}
function scheduleStateSend(){saveLocal();sendState();}
function moveStep(delta){
  const next=Math.max(0,Math.min(workflow.length-1,state.currentStep+delta));
  if(role==='student')studentUpdate(()=>{state.currentStep=next;});else coachAction('setCurrentStep',{index:next});
  setTimeout(()=>document.querySelector('.step.current')?.scrollIntoView({behavior:'smooth',block:'center'}),100);
}
function sendPatientResponse(urgent=false){
  const input=$('patientResponse');
  const text=input.value.trim();
  if(!text)return;
  coachAction('addFeed',{id:uid('msg'),text,urgent,ts:Date.now()});
  input.value='';
}
function addCustomFinding(){
  const section=$('newFindingSection').value;
  const label=$('newFindingLabel').value.trim();
  const text=$('newFindingText').value.trim();
  if(!label||!text){alert('Enter both a finding label and the patient answer/finding.');return;}
  coachAction('addFinding',{finding:{id:uid('finding'),section,label,text}});
  $('newFindingLabel').value='';$('newFindingText').value='';
}
function resetEncounter(){
  if(role!=='student'){
    alert('For a complete shared reset, ask the NP student to tap Reset encounter.');
    return;
  }
  if(!confirm('Reset this encounter? Patient setup stays, but scores, progress, released findings, messages, and student notes will clear.'))return;
  state.currentStep=0;
  state.completed={};
  state.scores={};
  state.released={};
  state.studentNotes='';
  state.feed=[{id:uid('system'),kind:'system',text:'Encounter reset. Begin with identifying information and historian reliability.',ts:Date.now()}];
  state.ended=false;
  studentUpdate(()=>{});
}
function endSession(){
  if(!confirm('End this session on this device? Saved progress will remain unless you start a new session.'))return;
  state.ended=true;saveLocal(true);setLastSession(role,sessionCode,true);destroyPeer();history.replaceState({},'',location.pathname);role=null;sessionCode=null;state=null;setStatus('Not connected','');showLanding();
}
function startFresh(){
  if(!confirm('Return to the start screen? Your current session remains saved and can be reopened with its link.'))return;
  destroyPeer();history.replaceState({},'',location.pathname);role=null;sessionCode=null;state=null;setStatus('Not connected','');showLanding();
}
function setupEvents(){
  $('createBtn').addEventListener('click',createSession);
  $('joinBtn').addEventListener('click',()=>joinSession($('joinCode').value));
  $('joinCode').addEventListener('input',e=>{e.target.value=cleanCode(e.target.value);});
  $('joinCode').addEventListener('keydown',e=>{if(e.key==='Enter')joinSession(e.target.value);});
  $('resumeBtn').addEventListener('click',e=>resumeSession(e.currentTarget.dataset.role,e.currentTarget.dataset.code));
  $('shareBtn').addEventListener('click',shareCoachLink);
  $('copyBtn').addEventListener('click',copyCoachLink);
  $('cancelBtn').addEventListener('click',startFresh);
  document.querySelectorAll('#forceReconnectBtn').forEach(btn=>btn.addEventListener('click',forceReconnect));
  $('newSessionBtn').addEventListener('click',startFresh);
  $('previousStepBtn').addEventListener('click',()=>moveStep(-1));
  $('nextStepBtn').addEventListener('click',()=>moveStep(1));
  $('resetBtn').addEventListener('click',resetEncounter);
  $('endBtn').addEventListener('click',endSession);
  $('studentNotes').addEventListener('input',e=>{state.studentNotes=e.target.value;touchState();scheduleStateSend();});
  $('templateSelect').addEventListener('change',e=>{if(confirm('Change the patient template and restart the encounter?'))coachAction('setTemplate',{templateId:e.target.value});else e.target.value=state.templateId;});
  bindPatientField('patientHistorian','historian');
  bindPatientField('patientName','name');
  bindPatientField('patientAge','age');
  bindPatientField('patientPronouns','pronouns');
  bindPatientField('patientChief','chief');
  bindPatientField('patientOpening','opening');
  bindPatientField('patientBehavior','behavior');
  $('sendResponseBtn').addEventListener('click',()=>sendPatientResponse(false));
  $('urgentResponseBtn').addEventListener('click',()=>sendPatientResponse(true));
  $('patientResponse').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendPatientResponse(false);}});
  $('addFindingBtn').addEventListener('click',addCustomFinding);
  $('coachPrivateNotes').addEventListener('input',e=>{coachPrivateNotes=e.target.value;saveLocal();});
  window.addEventListener('online',()=>{if(role&&sessionCode)forceReconnect();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&role&&sessionCode&&(!conn||!conn.open))forceReconnect();});
  window.addEventListener('beforeunload',()=>saveLocal(true));
}
function boot(){
  $('versionText').textContent='Version '+APP_VERSION;
  setupEvents();
  renderResume();
  const params=new URLSearchParams(location.search);
  const r=params.get('role');const c=cleanCode(params.get('code'));
  if((r==='student'||r==='coach')&&c.length===6)resumeSession(r,c);else showLanding();
}
document.addEventListener('DOMContentLoaded',boot);