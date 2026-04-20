/* ============================================================
   SmartBacklog — db.js
   FICHIER MÉMOIRE : gestion complète de la persistance
   Toutes les données survivent à la fermeture du navigateur.

   Ce fichier gère :
   - Les comptes utilisateurs (inscription / connexion)
   - La session active (reconnexion automatique)
   - Les projets de chaque utilisateur
   - Les tâches de chaque projet
   ============================================================ */

'use strict';

/* ── Préfixe global pour toutes les clés localStorage ─────── */
var DB_PREFIX = 'smartbacklog_';

/* ============================================================
   UTILITAIRES DE BASE
   ============================================================ */

/**
 * Lit une valeur depuis localStorage et la décode depuis JSON.
 * Retourne `fallback` si la clé n'existe pas ou si le JSON est invalide.
 */
function dbGet(key, fallback) {
  try {
    var raw = localStorage.getItem(DB_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[DB] Erreur lecture "' + key + '":', e.message);
    return fallback;
  }
}

/**
 * Sauvegarde une valeur dans localStorage en JSON.
 * Retourne true si succès, false sinon.
 */
function dbSet(key, value) {
  try {
    localStorage.setItem(DB_PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('[DB] Erreur écriture "' + key + '":', e.message);
    return false;
  }
}

/** Supprime une clé du localStorage. */
function dbDel(key) {
  localStorage.removeItem(DB_PREFIX + key);
}

/** Génère un identifiant unique. */
function dbUid() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}


/* ============================================================
   GESTION DES UTILISATEURS
   Les comptes sont stockés sous la clé "users".
   Les mots de passe sont stockés en clair (version démo).
   En production réelle : utiliser un backend + bcrypt.
   ============================================================ */

/** Retourne la liste de tous les utilisateurs. */
function dbGetUsers() {
  return dbGet('users', []);
}

/** Sauvegarde la liste des utilisateurs. */
function dbSaveUsers(users) {
  return dbSet('users', users);
}

/**
 * Crée un nouvel utilisateur.
 * Retourne { ok: true, user } ou { ok: false, error: "message" }
 */
function dbCreateUser(username, email, password) {
  var users = dbGetUsers();

  // Vérification des doublons
  var exists = users.find(function(u) {
    return u.username.toLowerCase() === username.toLowerCase()
        || u.email.toLowerCase() === email.toLowerCase();
  });
  if (exists) {
    return { ok: false, error: "Ce nom d'utilisateur ou cet e-mail est déjà utilisé." };
  }

  // Génère les initiales (ex: "ali_boukehila" → "AB")
  var parts    = username.replace(/[_\-\.]/g, ' ').split(' ').filter(Boolean);
  var initials = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : username.slice(0, 2).toUpperCase();

  var newUser = {
    id:        dbUid(),
    username:  username,
    email:     email.toLowerCase(),
    password:  password,           // stocké pour la démo ; hacher en prod
    initials:  initials,
    theme:     'dark',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  dbSaveUsers(users);
  return { ok: true, user: newUser };
}

/**
 * Vérifie les identifiants et retourne l'utilisateur si valide.
 * Retourne { ok: true, user } ou { ok: false, error: "message" }
 */
function dbLoginUser(identifier, password) {
  var users = dbGetUsers();
  var id    = identifier.trim().toLowerCase();

  var user = users.find(function(u) {
    return (u.username.toLowerCase() === id || u.email.toLowerCase() === id)
        && u.password === password;
  });

  if (!user) {
    return { ok: false, error: 'Identifiant ou mot de passe incorrect.' };
  }
  return { ok: true, user: user };
}

/**
 * Met à jour les préférences d'un utilisateur (ex: thème).
 */
function dbUpdateUser(userId, updates) {
  var users = dbGetUsers();
  var idx   = users.findIndex(function(u) { return u.id === userId; });
  if (idx >= 0) {
    Object.assign(users[idx], updates);
    dbSaveUsers(users);
  }
}


/* ============================================================
   GESTION DE LA SESSION (reconnexion automatique)
   La session est sauvegardée dans localStorage.
   À l'ouverture de l'app, on vérifie si une session existe.
   ============================================================ */

/**
 * Sauvegarde la session de l'utilisateur connecté.
 * Cela permet la reconnexion automatique.
 */
function dbSaveSession(user) {
  dbSet('session', {
    userId:   user.id,
    username: user.username,
    initials: user.initials,
    theme:    user.theme,
    loginAt:  new Date().toISOString()
  });
}

/**
 * Retourne la session active si elle existe, null sinon.
 * Récupère aussi les données complètes de l'utilisateur depuis la BDD.
 */
function dbGetSession() {
  var session = dbGet('session', null);
  if (!session || !session.userId) return null;

  // Retrouve l'utilisateur complet dans la base
  var users = dbGetUsers();
  var user  = users.find(function(u) { return u.id === session.userId; });
  return user || null;
}

/** Supprime la session (déconnexion). */
function dbClearSession() {
  dbDel('session');
}


/* ============================================================
   GESTION DES PROJETS
   Chaque utilisateur a ses propres projets.
   Clé : "projects_<userId>"
   ============================================================ */

/** Retourne les projets d'un utilisateur. */
function dbGetProjects(userId) {
  return dbGet('projects_' + userId, []);
}

/** Sauvegarde les projets d'un utilisateur. */
function dbSaveProjects(userId, projects) {
  return dbSet('projects_' + userId, projects);
}

/**
 * Crée un nouveau projet.
 * Retourne le projet créé.
 */
function dbCreateProject(userId, name, description) {
  var projects = dbGetProjects(userId);
  var project  = {
    id:          dbUid(),
    name:        name,
    description: description || '',
    createdAt:   new Date().toISOString()
  };
  projects.unshift(project); // ajoute en tête de liste
  dbSaveProjects(userId, projects);
  return project;
}

/**
 * Met à jour un projet existant.
 * Retourne true si trouvé et mis à jour.
 */
function dbUpdateProject(userId, projectId, updates) {
  var projects = dbGetProjects(userId);
  var idx      = projects.findIndex(function(p) { return p.id === projectId; });
  if (idx < 0) return false;
  Object.assign(projects[idx], updates);
  dbSaveProjects(userId, projects);
  return true;
}

/**
 * Supprime un projet et toutes ses tâches.
 */
function dbDeleteProject(userId, projectId) {
  var projects = dbGetProjects(userId).filter(function(p) { return p.id !== projectId; });
  dbSaveProjects(userId, projects);
  dbDel('tasks_' + userId + '_' + projectId); // supprime aussi les tâches
}


/* ============================================================
   GESTION DES TÂCHES
   Clé : "tasks_<userId>_<projectId>"
   ============================================================ */

/** Retourne les tâches d'un projet. */
function dbGetTasks(userId, projectId) {
  return dbGet('tasks_' + userId + '_' + projectId, []);
}

/** Sauvegarde les tâches d'un projet. */
function dbSaveTasks(userId, projectId, tasks) {
  return dbSet('tasks_' + userId + '_' + projectId, tasks);
}

/**
 * Crée une nouvelle tâche.
 * Retourne la tâche créée.
 */
function dbCreateTask(userId, projectId, taskData) {
  var tasks = dbGetTasks(userId, projectId);
  var task  = Object.assign({
    id:        dbUid(),
    status:    'todo',
    priority:  'medium',
    createdAt: new Date().toISOString()
  }, taskData);
  tasks.unshift(task);
  dbSaveTasks(userId, projectId, tasks);
  return task;
}

/**
 * Met à jour une tâche existante.
 * Retourne true si trouvée.
 */
function dbUpdateTask(userId, projectId, taskId, updates) {
  var tasks = dbGetTasks(userId, projectId);
  var idx   = tasks.findIndex(function(t) { return t.id === taskId; });
  if (idx < 0) return false;
  Object.assign(tasks[idx], updates);
  dbSaveTasks(userId, projectId, tasks);
  return true;
}

/**
 * Supprime une tâche.
 */
function dbDeleteTask(userId, projectId, taskId) {
  var tasks = dbGetTasks(userId, projectId).filter(function(t) { return t.id !== taskId; });
  dbSaveTasks(userId, projectId, tasks);
}

/**
 * Déplace une tâche vers un nouveau statut.
 */
function dbMoveTask(userId, projectId, taskId, newStatus) {
  return dbUpdateTask(userId, projectId, taskId, { status: newStatus });
}


/* ============================================================
   STATISTIQUES (utilitaires pour l'affichage)
   ============================================================ */

/**
 * Calcule les stats d'un projet.
 * Retourne { total, done, inprogress, todo, aiCount, pct }
 */
function dbProjectStats(userId, projectId) {
  var tasks = dbGetTasks(userId, projectId);
  var done  = tasks.filter(function(t) { return t.status === 'done'; }).length;
  var ip    = tasks.filter(function(t) { return t.status === 'inprogress'; }).length;
  var ai    = tasks.filter(function(t) { return t.aiEnhanced; }).length;
  return {
    total:      tasks.length,
    done:       done,
    inprogress: ip,
    todo:       tasks.filter(function(t) { return t.status === 'todo'; }).length,
    aiCount:    ai,
    pct:        tasks.length ? Math.round(done / tasks.length * 100) : 0
  };
}


/* ============================================================
   EXPORT (vérifie que db.js est bien chargé)
   ============================================================ */
console.info('[SmartBacklog DB] Fichier mémoire chargé ✅');
