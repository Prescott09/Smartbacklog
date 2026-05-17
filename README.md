# ⚡ SmartBacklog — Gestionnaire de Projets Agile

**Projet Final · Ali Boukehila**

Application web de gestion de projets Agile (Kanban) avec intégration IA via l'API Anthropic (Claude).

---

## 📁 Structure du projet (4 fichiers)

```
smartbacklog/
├── index.html    ← Structure HTML de toutes les pages (SPA)
├── style.css     ← Design complet, thèmes clair / sombre
├── app.js        ← Logique JS : auth, kanban, IA, persistance
└── README.md     ← Documentation (ce fichier)
```

---

## 🚀 Lancer l'application

### Option 1 — Directement dans le navigateur
```bash
# Ouvrez simplement index.html dans votre navigateur
open index.html   # macOS
start index.html  # Windows
```

### Option 2 — Via GitHub Pages
1. Poussez les 4 fichiers sur un dépôt GitHub
2. Activez **Settings → Pages → Deploy from branch (main)**
3. L'app sera disponible sur `https://[username].github.io/[repo]`

### Option 3 — Serveur local
```bash
# Python
python -m http.server 8000

# Node.js
npx serve .
```

---

## 🤖 Configurer l'IA (optionnel)

Pour activer le Coach Agile IA, ajoutez votre clé API Anthropic dans `app.js` :

```javascript
// Ligne 18 dans app.js
var AI_CONFIG = {
  apiKey: 'sk-ant-votre-cle-ici',   // ← Collez votre clé ici
  ...
};
```

**Obtenir une clé API :** https://console.anthropic.com

> Sans clé API, l'application fonctionne normalement (sans les fonctions IA).

---

## ✅ Fonctionnalités

### Sprint 1 — Cœur de l'application
- [x] Inscription / Connexion sécurisée
- [x] Persistance des données (localStorage)
- [x] Tableau de bord avec grille de projets
- [x] Création / modification / suppression de projets
- [x] Tableau Kanban : **To Do → In Progress → Done**
- [x] Création / modification / suppression de tâches
- [x] Déplacement des tâches entre colonnes
- [x] Priorités : Haute / Moyenne / Basse
- [x] Thème clair / sombre (persistant)
- [x] Notifications toast

### Sprint 2 — Intégration IA
- [x] **Critères d'acceptation** : 5 critères Gherkin générés par Claude
- [x] **Story Points Fibonacci** : estimation automatique (1, 2, 3, 5, 8, 13)
- [x] **Analyse de priorité** : détection critique / bloquant / urgent
- [x] Critères éditables et supprimables manuellement
- [x] Ajout manuel de critères
- [x] Badges IA sur les cartes Kanban

### Technique
- [x] **Prompt Engineering** : system prompt Coach Agile expert
- [x] Réponse JSON structurée (parsing robuste)
- [x] Zéro dépendance (HTML + CSS + JS pur)
- [x] Compatible GitHub Pages (frontend only)

---

## 🔧 Commandes Git

```bash
# Initialiser le dépôt
git init
git add .
git commit -m "feat: SmartBacklog v1.0 — application complète"

# Pousser sur GitHub
git remote add origin https://github.com/[username]/smartbacklog.git
git push -u origin main

# Mise à jour
git add .
git commit -m "fix: correction bug [description]"
git push
```

---

## 🏗️ Architecture technique

| Technologie | Rôle |
|---|---|
| **HTML5** | Structure des pages (SPA — 1 seul fichier) |
| **CSS3** | Design complet, variables CSS, thèmes, animations |
| **JavaScript ES6** | Logique métier, navigation, localStorage, API fetch |
| **localStorage** | Persistance des données côté client |
| **API Anthropic** | Coach Agile IA (génération critères + SP + priorité) |

### Concept SPA (Single Page Application)
Toutes les pages (login, dashboard, kanban) sont dans un seul `index.html`.
La navigation se fait en masquant/affichant les sections via JavaScript,
sans rechargement de page.

### Prompt Engineering
Le `systemPrompt` dans `app.js` configure Claude comme un Coach Agile :
- Rôle précis (15 ans d'expérience)
- Format de réponse JSON strict
- Règles métier Agile (Fibonacci, Gherkin)
- Instructions pour éviter les textes parasites

---

## 📖 Livrables du Projet Final

| Livrable | Fichier |
|---|---|
| Application fonctionnelle | `index.html` + `style.css` + `app.js` |
| Démonstration IA | Formulaire tâche → bouton Analyser avec l'IA |
| Product Backlog | Voir section Fonctionnalités ci-dessus |
| Dépôt GitHub | Ce dépôt |

---

*SmartBacklog © 2024 — Ali Boukehila · Projet Final*
