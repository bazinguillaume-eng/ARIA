# ARIA — Personal AI

Ton assistante IA personnelle, déployée sur Vercel.

---

## 🚀 Déploiement en 4 étapes

### Étape 1 — Créer un compte GitHub
1. Va sur [github.com](https://github.com) → **Sign up** (gratuit)
2. Crée un nouveau repository : **New** → nom : `aria` → **Public** → **Create repository**

### Étape 2 — Uploader les fichiers
Dans ton nouveau repository GitHub :
1. Clique sur **uploading an existing file**
2. Glisse-dépose **tous les fichiers** de ce dossier (en respectant la structure)
3. Clique **Commit changes**

> ⚠️ La structure doit être exactement :
> ```
> aria/
> ├── package.json
> ├── vite.config.js
> ├── vercel.json
> ├── index.html
> ├── api/
> │   └── chat.js
> └── src/
>     ├── main.jsx
>     └── App.jsx
> ```

### Étape 3 — Déployer sur Vercel
1. Va sur [vercel.com](https://vercel.com) → **Sign up with GitHub** (gratuit)
2. Clique **New Project** → sélectionne ton repo `aria`
3. Framework Preset : **Vite**
4. Clique **Deploy** → attends ~2 minutes

### Étape 4 — Ajouter ta clé API Anthropic
1. Va sur [console.anthropic.com](https://console.anthropic.com) → **API Keys** → **Create Key**
2. Copie la clé (commence par `sk-ant-...`)
3. Dans Vercel → ton projet → **Settings** → **Environment Variables**
4. Ajoute : `ANTHROPIC_API_KEY` = ta clé
5. Va dans **Deployments** → **Redeploy**

✅ **C'est terminé !** Tu as une URL permanente du type `aria-xxx.vercel.app`

---

## 📱 Installer sur mobile (comme une app)

**iPhone/iPad :**
1. Ouvre l'URL dans Safari
2. Icône partage → **Sur l'écran d'accueil**

**Android :**
1. Ouvre dans Chrome
2. Menu ⋮ → **Ajouter à l'écran d'accueil**

---

## 🔒 Sécurité
- Ta clé API Anthropic est stockée côté serveur (Vercel) — jamais exposée dans le navigateur
- Seul toi as accès à ton déploiement

---

## 💰 Coûts estimés
- Vercel : **gratuit** (plan Hobby)
- Anthropic API : ~$0.003 par message (Claude Sonnet) — environ **$1-3/mois** pour un usage quotidien normal
