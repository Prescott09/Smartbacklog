/* ============================================================
   SmartBacklog — app.js  v3
   ✅ API OpenAI GPT-4o intégrée (Coach Agile IA)
   ✅ Drag-and-drop natif HTML5 entre colonnes
   ✅ Colonne Backlog dédiée (tickets en attente)
   ✅ Critères d'acceptation éditables inline
   ✅ Session persistante (reconnexion automatique)
   ✅ Navigation SPA corrigée
   ============================================================ */

'use strict';

/* ── Clé API OpenAI ────────────────────────────────────────
   Clé configurée pour ce projet.
   ⚠️  IMPORTANT : Régénérez cette clé sur platform.openai.com
   car elle a été partagée dans une conversation.            */
var AI_API_KEY = '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';

var AI_SYSTEM = 'Tu es un Coach Agile expert et Product Owner senior avec 15 ans d\'experience. '
  + 'Tu analyses des User Stories et generes des livrables de qualite professionnelle. '
  + 'REGLES STRICTES : Reponds UNIQUEMENT avec un objet JSON valide sans aucun texte avant ou apres. '
  + 'Ne jamais utiliser de blocs ```json. '
  + 'Criteres : 5 criteres precis et TESTABLES en francais. '
  + 'Story Points : uniquement Fibonacci [1,2,3,5,8,13]. '
  + 'priority_label : exactement "critique", "haute", "moyenne" ou "basse". '
  + 'FORMAT : {"criteria":["c1","c2","c3","c4","c5"],'
  + '"story_points":<n>,"priority_analysis":"<texte>","priority_label":"<label>"}';

/* ── État global ─────────────────────────────────────────── */
var APP = {
  user:      null,
  projectId: null,
  delCtx:    null,
  dragId:    null,   // id de la tâche en cours de glissement
  ai: {
    criteria: [], storyPoints: null,
    priorityLabel: '', priorityAnalysis: '', enhanced: false
  }
};

/* ── Utilitaires ─────────────────────────────────────────── */
function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function trunc(s,n){ s=String(s||''); return s.length>n?s.slice(0,n)+'…':s; }


/* ══════════════════════════════════════════════════════════
   NAVIGATION — SPA sans rechargement
   display inline corrige le bug CSS/class
   ══════════════════════════════════════════════════════════ */
function showPage(name) {
  ['login','dashboard','kanban'].forEach(function(id){
    var p=el('page-'+id); if(p)p.style.display='none';
  });
  var t=el('page-'+name);
  if(!t){ console.error('Page introuvable: page-'+name); return; }
  t.style.display='flex';
  t.style.flexDirection='column';
  t.style.minHeight='100vh';
  if(name==='dashboard') renderDashboard();
  if(name==='kanban')    renderKanban();
}

function goTo(dest){
  if(dest==='dashboard'){ APP.user?showPage('dashboard'):showPage('login'); }
  else if(dest==='kanban'){ (APP.user&&APP.projectId)?showPage('kanban'):showPage('dashboard'); }
  else showPage('login');
}


/* ── Thème ───────────────────────────────────────────────── */
function applyTheme(t){ document.documentElement.setAttribute('data-theme',t||'dark'); }
function toggleTheme(){
  if(!APP.user)return;
  var nt=APP.user.theme==='dark'?'light':'dark';
  APP.user.theme=nt; applyTheme(nt);
  dbUpdateUser(APP.user.id,{theme:nt}); dbSaveSession(APP.user);
}

/* ── Toasts ──────────────────────────────────────────────── */
function toast(msg,type){
  type=type||'success';
  var c=el('toast-container'); if(!c)return;
  var d=document.createElement('div');
  d.className='toast toast-'+type;
  d.textContent=({success:'✅',error:'⚠️',ai:'🤖'}[type]||'•')+'  '+msg;
  c.appendChild(d);
  setTimeout(function(){
    d.style.transition='opacity .4s,transform .4s';
    d.style.opacity='0'; d.style.transform='translateX(24px)';
    setTimeout(function(){if(d.parentNode)d.remove();},450);
  },3500);
}

/* ── Header ──────────────────────────────────────────────── */
function updateHeader(){
  if(!APP.user)return;
  ['hdr-av','kb-av'].forEach(function(id){var e=el(id);if(e)e.textContent=APP.user.initials;});
  ['hdr-name','kb-name'].forEach(function(id){var e=el(id);if(e)e.textContent=APP.user.username;});
  applyTheme(APP.user.theme);
}


/* ══════════════════════════════════════════════════════════
   AUTHENTIFICATION
   ══════════════════════════════════════════════════════════ */

function switchAuthTab(tab){
  el('tab-login').classList.toggle('active',tab==='login');
  el('tab-register').classList.toggle('active',tab==='register');
  el('form-login').style.display    =tab==='login'   ?'block':'none';
  el('form-register').style.display =tab==='register'?'block':'none';
  var e=el('auth-error');if(e)e.style.display='none';
}

function showAuthErr(msg){
  var e=el('auth-error');
  if(e){e.textContent='⚠️  '+msg;e.style.display='block';}
}

function doLogin(){
  var e=el('auth-error');if(e)e.style.display='none';
  var id=(el('login-id').value||'').trim();
  var pw=(el('login-pwd').value||'');
  if(!id||!pw){showAuthErr('Veuillez remplir tous les champs.');return;}
  var res=dbLoginUser(id,pw);
  if(!res.ok){showAuthErr(res.error);return;}
  APP.user=res.user;
  dbSaveSession(res.user);
  updateHeader();
  showPage('dashboard');
  toast('Bienvenue, '+res.user.username+' ! 👋');
}

function doRegister(){
  var e=el('auth-error');if(e)e.style.display='none';
  var username=(el('reg-username').value||'').trim();
  var email   =(el('reg-email').value||'').trim();
  var pwd     =(el('reg-pwd').value||'');
  var confirm =(el('reg-confirm').value||'');
  if(username.length<3){showAuthErr("Nom d'utilisateur trop court (min 3 car.).");return;}
  if(!email.includes('@')){showAuthErr('Email invalide.');return;}
  if(pwd.length<8){showAuthErr('Mot de passe trop court (min 8 car.).');return;}
  if(pwd!==confirm){showAuthErr('Les mots de passe ne correspondent pas.');return;}
  var res=dbCreateUser(username,email,pwd);
  if(!res.ok){showAuthErr(res.error);return;}
  toast('Compte créé ! Connectez-vous. ✨');
  switchAuthTab('login');
  el('login-id').value=username;
  setTimeout(function(){el('login-pwd').focus();},100);
}

function doLogout(){
  dbClearSession();
  APP.user=null; APP.projectId=null;
  showPage('login');
  toast('Déconnecté.');
}

function togglePwd(inputId,btn){
  var input=el(inputId);if(!input)return;
  var show=input.type==='password';
  input.type=show?'text':'password';
  btn.innerHTML=show
    ?'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    :'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

function checkPwdStrength(v){
  var s=0;
  if(v.length>=8)s++;if(/[A-Z]/.test(v))s++;if(/[0-9]/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;
  document.querySelectorAll('.psb').forEach(function(b){b.className='psb';});
  var cls=s<=1?'weak':s<=3?'medium':'strong';
  document.querySelectorAll('.psb').forEach(function(b,i){if(i<s)b.classList.add(cls);});
  var lb=el('pwd-strength-label');
  if(lb)lb.textContent=!v?'':s<=1?'Faible':s<=3?'Moyen':'Fort ✓';
}


/* ══════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════ */

function renderDashboard(){
  if(!APP.user)return;
  var projects=dbGetProjects(APP.user.id);
  var sub=el('dash-subtitle');
  if(sub)sub.textContent=projects.length+' projet'+(projects.length!==1?'s':'')+' en cours';
  var grid=el('projects-grid');if(!grid)return;

  if(projects.length===0){
    grid.innerHTML='<div class="db-empty">'
      +'<div class="db-empty-ico">📂</div>'
      +'<div class="db-empty-title">Aucun projet pour l\'instant</div>'
      +'<p class="db-empty-sub">Cliquez sur «\u00a0Nouveau projet\u00a0» pour commencer à organiser vos tâches Agile.</p>'
      +'</div>';
    return;
  }

  /* Cartes horizontales — identiques à la maquette */
  grid.innerHTML=projects.map(function(p){
    var s=dbProjectStats(APP.user.id,p.id);
    return '<div class="db-proj-card">'
      +'<div class="db-proj-card-body">'

      /* Icône lettre */
      +'<div class="db-proj-ico">'+esc(p.name[0].toUpperCase())+'</div>'

      /* Nom + description */
      +'<div class="db-proj-info">'
      +'<div class="db-proj-name">'+esc(p.name)+'</div>'
      +'<div class="db-proj-desc">'+esc(p.description||'')+'</div>'
      +'</div>'

      +'<div class="db-proj-sep"></div>'

      /* Stats : Tâches | Terminées | IA | % */
      +'<div class="db-proj-stats">'
      +'<div class="db-pstat"><span class="db-pstat-val">'+s.total+'</span><span class="db-pstat-lbl">Tâches</span></div>'
      +'<div class="db-pstat"><span class="db-pstat-val">'+s.done+'</span><span class="db-pstat-lbl">Terminées</span></div>'
      +'<div class="db-pstat"><span class="db-pstat-ico">🤖</span><span class="db-pstat-lbl">IA</span></div>'
      +'<div class="db-pstat">'
      +'<span class="db-pstat-val db-pstat-val-pct">'+s.pct+'%</span>'
      +'<span class="db-pstat-lbl">Complet</span>'
      +'<div class="db-pstat-bar"><div class="db-pstat-bar-fill" style="width:'+s.pct+'%"></div></div>'
      +'</div>'
      +'</div>'

      +'<div class="db-proj-sep"></div>'

      /* Actions */
      +'<div class="db-proj-actions">'
      +'<button class="db-pa-open" onclick="openProject(\''+p.id+'\')">📋 Ouvrir</button>'
      +'<button class="db-pa-edit" onclick="openEditProjectModal(\''+p.id+'\')">✏️ Modifier</button>'
      +'<button class="db-pa-del" onclick="askDelete(\'project\',\''+p.id+'\')" title="Supprimer">🗑️</button>'
      +'</div>'

      +'</div>'/* /card-body */
      +'</div>';
  }).join('');
}


/* ── Modals ──────────────────────────────────────────────── */
function openModal(id){var m=el(id);if(m){m.style.display='flex';m.classList.add('open');}}
function closeModal(id){var m=el(id);if(m){m.style.display='none';m.classList.remove('open');}}
function closeModalOutside(ev,id){if(ev.target===el(id))closeModal(id);}


/* ── CRUD Projets ────────────────────────────────────────── */
function openNewProjectModal(){
  el('edit-project-id').value='';el('proj-name').value='';el('proj-desc').value='';
  el('modal-project-title').textContent='Nouveau projet';
  el('btn-save-project').textContent='Créer le projet';
  openModal('modal-project');
  setTimeout(function(){el('proj-name').focus();},100);
}

function openEditProjectModal(pid){
  var p=dbGetProjects(APP.user.id).find(function(x){return x.id===pid;});if(!p)return;
  el('edit-project-id').value=p.id;el('proj-name').value=p.name;el('proj-desc').value=p.description||'';
  el('modal-project-title').textContent='Modifier le projet';
  el('btn-save-project').textContent='Sauvegarder';
  openModal('modal-project');
}

function openEditProject(){openEditProjectModal(APP.projectId);}

function saveProject(){
  var name=(el('proj-name').value||'').trim();
  var desc=(el('proj-desc').value||'').trim();
  if(!name){toast('Le nom est obligatoire.','error');return;}
  var eid=el('edit-project-id').value;
  if(eid){
    dbUpdateProject(APP.user.id,eid,{name:name,description:desc});
    toast('Projet mis à jour.');
    if(APP.projectId===eid){
      var t=el('kb-title');if(t)t.textContent=name;
      var d=el('kb-desc');if(d)d.textContent=desc;
      var n=el('kb-project-name');if(n)n.textContent=name;
    }
  } else {
    dbCreateProject(APP.user.id,name,desc);
    toast('Projet «\u00a0'+name+'\u00a0» créé ! 🎉');
  }
  closeModal('modal-project');renderDashboard();
}

function openProject(pid){APP.projectId=pid;showPage('kanban');}


/* ══════════════════════════════════════════════════════════
   KANBAN — Rendu complet avec Backlog
   Colonnes : Backlog | To Do | In Progress | Done
   ══════════════════════════════════════════════════════════ */

function renderKanban(){
  if(!APP.user||!APP.projectId)return;
  var projects=dbGetProjects(APP.user.id);
  var project=projects.find(function(p){return p.id===APP.projectId;});
  if(!project){showPage('dashboard');return;}

  var ne=el('kb-project-name');if(ne)ne.textContent=project.name;
  var te=el('kb-title');if(te)te.textContent=project.name;
  var de=el('kb-desc');if(de)de.textContent=project.description||'';

  var tasks=dbGetTasks(APP.user.id,APP.projectId);
  var byStatus={
    backlog:    tasks.filter(function(t){return t.status==='backlog';}),
    todo:       tasks.filter(function(t){return t.status==='todo';}),
    inprogress: tasks.filter(function(t){return t.status==='inprogress';}),
    done:       tasks.filter(function(t){return t.status==='done';})
  };

  // Stats (exclut backlog)
  var boardTasks=byStatus.todo.concat(byStatus.inprogress).concat(byStatus.done);
  var se=el('kb-stats');
  if(se)se.innerHTML=
    '<span><span class="kstat-n">'+tasks.length+'</span> tâche'+(tasks.length!==1?'s':'')+'</span>'
    +'<span>·</span><span><span class="kstat-n" style="color:var(--accent2)">'+byStatus.backlog.length+'</span> backlog</span>'
    +'<span>·</span><span><span class="kstat-n kstat-ip">'+byStatus.inprogress.length+'</span> en cours</span>'
    +'<span>·</span><span><span class="kstat-n kstat-dn">'+byStatus.done.length+'</span> terminée'+(byStatus.done.length!==1?'s':'')+'</span>';

  // Backlog (panel gauche)
  renderBacklogCol(byStatus.backlog);

  // Board 3 colonnes (droite)
  var board=el('kanban-board');
  if(board)board.innerHTML=
    buildCol('📝 To Do',       'dot-todo','todo',       byStatus.todo)
   +buildCol('⚙️ In Progress','dot-ip',  'inprogress', byStatus.inprogress)
   +buildCol('✅ Done',        'dot-done','done',        byStatus.done);
}

/* Rendu du backlog (panel gauche) */
function renderBacklogCol(tasks){
  var cnt=el('backlog-cnt');if(cnt)cnt.textContent=tasks.length;
  var col=el('backlog-col');if(!col)return;
  if(tasks.length===0){
    col.innerHTML='<div class="col-empty"><span class="col-empty-ico">📋</span><p>Glissez ici ou cliquez + pour ajouter</p></div>';
    return;
  }
  col.innerHTML=tasks.map(function(t){return buildTaskCard(t,false);}).join('');
  addDragListeners(col);
}

/* Construit une colonne kanban */
function buildCol(title,dotCls,status,tasks){
  var tasksHTML='';
  if(tasks.length===0){
    tasksHTML='<div class="col-empty"><span class="col-empty-ico">'
      +({todo:'📝',inprogress:'⚙️',done:'✅'}[status])+'</span><p>Aucune tâche</p></div>';
  } else {
    tasksHTML=tasks.map(function(t){return buildTaskCard(t,true);}).join('');
  }
  return '<div class="kanban-col">'
    +'<div class="col-head"><div class="col-title"><span class="col-dot '+dotCls+'"></span>'+title+'</div>'
    +'<span class="col-cnt">'+tasks.length+'</span></div>'
    +'<div class="col-tasks" id="col-'+status+'" '
    +'ondragover="onDragOver(event,\''+status+'\')" '
    +'ondrop="onDrop(event,\''+status+'\')" '
    +'ondragleave="onDragLeave(event)">'
    +tasksHTML+'</div>'
    +'<button class="col-add-btn" onclick="openNewTaskModal(\''+status+'\')"> + Ajouter</button>'
    +'</div>';
}

/* Construit le HTML d'une carte tâche */
function buildTaskCard(t, showMoveButtons){
  var pLabels={high:'🔴 Haute',medium:'🟡 Moyenne',low:'🟢 Basse'};
  var pBadge ={high:'badge-high',medium:'badge-medium',low:'badge-low'};
  var pBorder={high:'tc-prio-high',medium:'tc-prio-medium',low:'tc-prio-low'};

  var mv='';
  if(showMoveButtons){
    if(t.status!=='todo')
      mv+='<button class="tc-mv-btn" onclick="moveTask(\''+t.id+'\',\'todo\')">📝 To Do</button>';
    if(t.status!=='inprogress')
      mv+='<button class="tc-mv-btn" onclick="moveTask(\''+t.id+'\',\'inprogress\')">'+(t.status==='todo'?'▶ En cours':'◀ En cours')+'</button>';
    if(t.status!=='done')
      mv+='<button class="tc-mv-btn tc-mv-done" onclick="moveTask(\''+t.id+'\',\'done\')">✓ Terminé</button>';
    mv+='<button class="tc-mv-btn" onclick="moveTask(\''+t.id+'\',\'backlog\')" style="opacity:.6">↩ Backlog</button>';
  } else {
    // Dans le backlog : bouton envoyer vers To Do
    mv='<button class="tc-mv-btn" onclick="moveTask(\''+t.id+'\',\'todo\')">→ To Do</button>';
  }

  var ai='';
  if(t.storyPoints)
    ai+='<span class="tc-sp-badge">🎯 '+t.storyPoints+' pt'+(t.storyPoints>1?'s':'')+'</span>';
  if(t.criteria&&t.criteria.length>0)
    ai+='<span class="tc-ai-badge"><span class="ai-dot-anim"></span>'+t.criteria.length+' critère'+(t.criteria.length>1?'s':'')+'</span>';

  return '<div class="task-card '+(pBorder[t.priority]||'tc-prio-medium')+'" '
    +'draggable="true" id="card-'+t.id+'" '
    +'ondragstart="onDragStart(event,\''+t.id+'\')" '
    +'ondragend="onDragEnd(event)">'
    +'<div class="tc-top"><div class="tc-meta">'
    +'<span class="tc-id">#'+t.id.slice(-5)+'</span>'
    +'<span class="tc-badge '+(pBadge[t.priority]||'badge-medium')+'">'+(pLabels[t.priority]||'Moyenne')+'</span>'
    +'</div><div class="tc-actions">'
    +'<button class="tc-btn tc-btn-edit" onclick="openEditTaskModal(\''+t.id+'\')">✏️</button>'
    +'<button class="tc-btn tc-btn-del" onclick="askDelete(\'task\',\''+t.id+'\')">🗑️</button>'
    +'</div></div>'
    +'<div class="tc-title">'+esc(t.title)+'</div>'
    +(t.description?'<div class="tc-desc">'+esc(trunc(t.description,85))+'</div>':'')
    +(ai?'<div class="tc-ai-row">'+ai+'</div>':'')
    +'<div class="tc-moves">'+mv+'</div>'
    +'</div>';
}

/* Déplace une tâche vers un statut (via bouton) */
function moveTask(tid,ns){
  dbMoveTask(APP.user.id,APP.projectId,tid,ns);
  renderKanban();
  var labels={backlog:'Backlog',todo:'To Do',inprogress:'En cours',done:'Terminé'};
  toast('→ '+( labels[ns]||ns));
}


/* ══════════════════════════════════════════════════════════
   DRAG & DROP — HTML5 natif
   L'utilisateur attrape une carte et la dépose dans
   une autre colonne. La tâche change de statut automatiquement.
   ══════════════════════════════════════════════════════════ */

function onDragStart(event, taskId){
  APP.dragId=taskId;
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('text/plain', taskId);
  /* Ajoute la classe "dragging" après un mini délai
     (sinon le ghost image est déjà grisé) */
  setTimeout(function(){
    var card=el('card-'+taskId);
    if(card)card.classList.add('dragging');
  },0);
}

function onDragEnd(event){
  var card=el('card-'+(APP.dragId||''));
  if(card)card.classList.remove('dragging');
  /* Retire tous les indicateurs visuels de dépôt */
  document.querySelectorAll('.drag-over').forEach(function(z){
    z.classList.remove('drag-over');
  });
}

function onDragOver(event, status){
  event.preventDefault();
  event.dataTransfer.dropEffect='move';
  /* Highlight de la zone de dépôt */
  var zone=event.currentTarget;
  if(zone&&!zone.classList.contains('drag-over'))
    zone.classList.add('drag-over');
}

function onDragLeave(event){
  var zone=event.currentTarget;
  /* Vérifie qu'on quitte vraiment la zone (pas juste un enfant) */
  if(zone&&!zone.contains(event.relatedTarget))
    zone.classList.remove('drag-over');
}

function onDrop(event, newStatus){
  event.preventDefault();
  var tid=APP.dragId||event.dataTransfer.getData('text/plain');
  if(!tid){return;}
  /* Retire le highlight */
  var zone=event.currentTarget;
  if(zone)zone.classList.remove('drag-over');
  /* Déplace la tâche */
  dbMoveTask(APP.user.id,APP.projectId,tid,newStatus);
  APP.dragId=null;
  renderKanban();
  var labels={backlog:'Backlog',todo:'To Do',inprogress:'En cours',done:'Terminé'};
  toast('Déplacé → '+(labels[newStatus]||newStatus));
}

/* Ajoute les listeners drag sur les cartes d'un conteneur
   (utilisé pour le backlog qui est rendu séparément) */
function addDragListeners(container){
  /* Les attributs ondragstart/ondragend sont déjà dans le HTML,
     cette fonction est gardée pour extension future */
}


/* ── CRUD Tâches ─────────────────────────────────────────── */
function openNewTaskModal(defStatus){
  resetTaskModal();
  el('task-status').value=defStatus||'backlog';
  openModal('modal-task');
  setTimeout(function(){el('task-title').focus();},100);
}

function openEditTaskModal(tid){
  var tasks=dbGetTasks(APP.user.id,APP.projectId);
  var t=tasks.find(function(x){return x.id===tid;});if(!t)return;
  el('edit-task-id').value=t.id;
  el('task-title').value=t.title||'';
  el('task-desc').value=t.description||'';
  el('task-status').value=t.status||'backlog';
  el('task-priority').value=t.priority||'medium';
  el('task-sp').value=t.storyPoints?String(t.storyPoints):'';
  el('modal-task-title').textContent='Modifier la tâche';
  el('btn-save-task').textContent='Sauvegarder';
  APP.ai={
    criteria:t.criteria||[],storyPoints:t.storyPoints||null,
    priorityLabel:t.priorityLabel||'',
    priorityAnalysis:t.priorityAnalysis||'',
    enhanced:t.aiEnhanced||false
  };
  renderAIPanel();
  if(APP.ai.enhanced)setAIStatus('✅ Données IA chargées — modifiables.','ok');
  openModal('modal-task');
}

function resetTaskModal(){
  el('edit-task-id').value='';el('task-title').value='';el('task-desc').value='';
  el('task-status').value='backlog';el('task-priority').value='medium';el('task-sp').value='';
  el('modal-task-title').textContent='Nouvelle tâche';
  el('btn-save-task').textContent='Créer la tâche';
  APP.ai={criteria:[],storyPoints:null,priorityLabel:'',priorityAnalysis:'',enhanced:false};
  resetAIPanel();
}

function saveTask(){
  syncCriteriaFromDOM();
  var title=(el('task-title').value||'').trim();
  if(!title){toast('Le titre est obligatoire.','error');return;}
  var data={
    title:title,
    description:(el('task-desc').value||'').trim(),
    status:el('task-status').value,
    priority:el('task-priority').value,
    storyPoints:el('task-sp').value?parseInt(el('task-sp').value,10):null,
    criteria:APP.ai.criteria.filter(function(c){return c.trim()!=='';}),
    priorityLabel:APP.ai.priorityLabel,
    priorityAnalysis:APP.ai.priorityAnalysis,
    aiEnhanced:APP.ai.enhanced
  };
  var eid=el('edit-task-id').value;
  if(eid){dbUpdateTask(APP.user.id,APP.projectId,eid,data);toast('Tâche mise à jour.');}
  else   {dbCreateTask(APP.user.id,APP.projectId,data);toast('Tâche créée ! ✅');}
  closeModal('modal-task');renderKanban();
}

/* ── Suppression ─────────────────────────────────────────── */
function askDelete(type,id){
  APP.delCtx={type:type,id:id};
  if(type==='project'){
    var p=dbGetProjects(APP.user.id).find(function(x){return x.id===id;});if(!p)return;
    var tc=dbGetTasks(APP.user.id,id);
    el('confirm-title').textContent='Supprimer «\u00a0'+p.name+'\u00a0» ?';
    el('confirm-msg').textContent='Ce projet sera supprimé définitivement.';
    el('confirm-warn').textContent=tc.length?'⚠️ '+tc.length+' tâche'+(tc.length>1?'s':'')+' seront supprimées !':'';
  } else {
    var t=dbGetTasks(APP.user.id,APP.projectId).find(function(x){return x.id===id;});
    el('confirm-title').textContent='Supprimer cette tâche ?';
    el('confirm-msg').textContent=t?'"'+t.title+'"':'';
    el('confirm-warn').textContent='Cette action est irréversible.';
  }
  openModal('modal-confirm');
}

function confirmDelete(){
  var ctx=APP.delCtx;if(!ctx){closeModal('modal-confirm');return;}
  if(ctx.type==='project'){
    dbDeleteProject(APP.user.id,ctx.id);
    toast('Projet supprimé.');
    closeModal('modal-confirm');
    if(APP.projectId===ctx.id){APP.projectId=null;showPage('dashboard');}
    else renderDashboard();
  } else {
    dbDeleteTask(APP.user.id,APP.projectId,ctx.id);
    toast('Tâche supprimée.');
    closeModal('modal-confirm');renderKanban();
  }
  APP.delCtx=null;
}


/* ══════════════════════════════════════════════════════════
   PANNEAU IA — OpenAI GPT-4o (Coach Agile)
   ══════════════════════════════════════════════════════════ */

function setAIStatus(msg,type){
  var e=el('ai-status');if(!e)return;
  e.textContent=msg;
  e.style.color=type==='error'?'var(--red)':type==='ok'?'var(--green)':'var(--text3)';
}

function resetAIPanel(){
  setAIStatus('Renseignez le titre puis cliquez sur Analyser.','info');
  var r=el('ai-results');if(r)r.style.display='none';
  var p=el('ai-prio-text');if(p)p.style.display='none';
  var s=el('ai-crit-section');if(s)s.style.display='none';
  var w=el('ai-key-warn');if(w)w.style.display='none';
}

function renderAIPanel(){
  /* Story Points + Priorité */
  var r=el('ai-results');if(r)r.style.display=APP.ai.storyPoints?'':'none';
  var se=el('air-sp');if(se&&APP.ai.storyPoints)se.textContent=APP.ai.storyPoints+' pt'+(APP.ai.storyPoints>1?'s':'');
  var pl={critique:'🔴 Critique',haute:'🟠 Haute',moyenne:'🟡 Moyenne',basse:'🟢 Basse'};
  var pe=el('air-prio');if(pe)pe.textContent=pl[APP.ai.priorityLabel]||'—';
  var pt=el('ai-prio-text');
  if(pt){pt.textContent=APP.ai.priorityAnalysis||'';pt.style.display=APP.ai.priorityAnalysis?'':'none';}

  /* Critères d'acceptation éditables */
  var cs=el('ai-crit-section'),cl=el('crit-list');if(!cs||!cl)return;
  cs.style.display=APP.ai.criteria.length>0?'':'none';
  cl.innerHTML=APP.ai.criteria.map(function(c,i){
    /* Chaque critère est un textarea modifiable directement */
    return '<div class="crit-item">'
      +'<textarea rows="2" '
      +'onblur="updateCriterion('+i+',this.value)" '
      +'oninput="autoResizeTA(this)">'
      +esc(c)+'</textarea>'
      +'<button class="crit-rm" type="button" onclick="removeCriterion('+i+')" title="Supprimer ce critère">✕</button>'
      +'</div>';
  }).join('');
}

/* Auto-redimensionne les textareas des critères */
function autoResizeTA(ta){
  ta.style.height='auto';
  ta.style.height=(ta.scrollHeight)+'px';
}

function syncCriteriaFromDOM(){
  document.querySelectorAll('#crit-list textarea').forEach(function(ta,i){
    if(APP.ai.criteria[i]!==undefined)APP.ai.criteria[i]=ta.value.trim();
  });
}

function updateCriterion(i,v){
  if(APP.ai.criteria[i]!==undefined)APP.ai.criteria[i]=v.trim()||APP.ai.criteria[i];
}

function removeCriterion(i){
  APP.ai.criteria.splice(i,1);renderAIPanel();
}

function addCriterion(){
  APP.ai.criteria.push('Nouveau critère — modifiez ce texte');
  var s=el('ai-crit-section');if(s)s.style.display='';
  renderAIPanel();
  setTimeout(function(){
    var a=document.querySelectorAll('#crit-list textarea');
    if(a.length){var l=a[a.length-1];l.focus();l.select();}
  },60);
}

/* Appel API OpenAI GPT-4o */
async function aiAnalyze(){
  var title=(el('task-title').value||'').trim();
  var desc =(el('task-desc').value||'').trim();

  if(!title){
    setAIStatus('⚠️ Renseignez d\'abord le titre.','error');
    el('task-title').focus(); return;
  }

  if(!AI_API_KEY){
    var w=el('ai-key-warn');if(w)w.style.display='';
    setAIStatus('⚠️ Clé API manquante dans app.js.','error'); return;
  }

  var projects=dbGetProjects(APP.user.id);
  var proj=projects.find(function(p){return p.id===APP.projectId;});
  var pName=proj?proj.name:'ce projet';

  var btn=el('ai-gen-btn'),sp=el('ai-spinner');
  if(btn)btn.disabled=true;if(sp)sp.style.display='block';
  setAIStatus('🤖 Le Coach Agile analyse votre User Story…','info');

  var userPrompt='Analyse cette User Story pour le projet "'+pName+'" :\n'
    +'Titre : '+title+'\n'+(desc?'Description : '+desc+'\n':'')
    +'\nGénère : 5 critères d\'acceptation testables en français, Story Points Fibonacci, analyse de priorité.';

  try {
    /* Appel OpenAI Chat Completions */
    var res=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer '+AI_API_KEY
      },
      body:JSON.stringify({
        model:'gpt-4o',
        temperature:0.3,
        response_format:{type:'json_object'},
        messages:[
          {role:'system', content:AI_SYSTEM},
          {role:'user',   content:userPrompt}
        ]
      })
    });

    if(!res.ok){
      var ej=await res.json().catch(function(){return{};});
      throw new Error('OpenAI '+res.status+': '+((ej.error||{}).message||'erreur inconnue'));
    }

    var data=await res.json();
    var raw=(data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content)||'{}';
    var result=JSON.parse(raw);

    /* Validation Story Points Fibonacci */
    var fib=[1,2,3,5,8,13];
    var spv=result.story_points;
    if(!fib.includes(spv))spv=fib.reduce(function(a,b){return Math.abs(b-spv)<Math.abs(a-spv)?b:a;});

    APP.ai.criteria         =(result.criteria||[]).slice(0,6);
    APP.ai.storyPoints      =spv;
    APP.ai.priorityLabel    =(['critique','haute','moyenne','basse'].includes(result.priority_label)?result.priority_label:'moyenne');
    APP.ai.priorityAnalysis =result.priority_analysis||'';
    APP.ai.enhanced         =true;

    /* Pré-sélectionne les Story Points */
    if(el('task-sp'))el('task-sp').value=String(spv);

    renderAIPanel();
    setAIStatus('✅ Analyse terminée — modifiez les critères si besoin.','ok');
    toast('Analyse IA terminée ! 🤖','ai');

  } catch(err){
    console.error('[IA OpenAI]',err);
    setAIStatus('⚠️ '+err.message,'error');
    toast('Erreur IA : '+err.message,'error');
  } finally {
    if(btn)btn.disabled=false;if(sp)sp.style.display='none';
  }
}


/* ══════════════════════════════════════════════════════════
   INITIALISATION
   ══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded',function(){

  /* 1. Masque toutes les pages */
  ['login','dashboard','kanban'].forEach(function(id){
    var p=el('page-'+id);if(p)p.style.display='none';
  });

  /* 2. Reconnexion automatique si session sauvegardée */
  var saved=dbGetSession();
  if(saved){
    APP.user=saved;
    updateHeader();
    showPage('dashboard');
    toast('Bon retour, '+saved.username+' ! 👋');
  } else {
    applyTheme('dark');
    showPage('login');
  }

  /* 3. Touche Entrée sur le login */
  var lp=el('login-pwd');
  if(lp)lp.addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});
  var li=el('login-id');
  if(li)li.addEventListener('keydown',function(e){if(e.key==='Enter')el('login-pwd').focus();});

  /* 4. Échap ferme les modals */
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape')['modal-project','modal-task','modal-confirm'].forEach(closeModal);
  });

  console.info('[SmartBacklog v3] Prêt ✅ | db.js: '+(typeof dbGetSession));
});
