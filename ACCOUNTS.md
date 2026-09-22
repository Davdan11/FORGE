# Comptes FORGE — mise en service

Le code est prêt : Google, Apple, numéro de téléphone et courriel
(`src/lib/auth.ts`, `src/components/AccountPanel.tsx`). Ce qui manque, ce
sont les comptes et les clés, que seul le propriétaire peut créer. Tant que
l'étape 1 n'est pas faite, l'app fonctionne sans compte et n'affiche pas
l'écran de connexion.

Chaque méthode peut être activée séparément. L'ordre ci-dessous va de la
plus simple à la plus longue.

---

## 1. Projet Supabase (obligatoire, 15 min, gratuit)

1. Créer un projet sur https://supabase.com.
2. **SQL Editor** → coller tout `supabase/schema.sql` → *Run*.
   Ce fichier n'a jamais été exécuté : s'il signale une erreur, me la copier.
3. **Project Settings → API** : copier l'URL et la clé `anon`, puis créer
   `.env.local` à la racine du projet :

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

   La clé `anon` est publique par conception : elle part dans l'app. Ne
   **jamais** y mettre la clé `service_role`.
4. **Authentication → URL Configuration** :
   - *Site URL* : l'adresse du site web (ou `http://localhost:3000` pour l'instant)
   - *Redirect URLs*, ajouter les trois :
     - `http://localhost:3000/auth/callback/`
     - `https://<ton-domaine>/auth/callback/` (quand le site sera en ligne)
     - `ca.danjou.forge://auth/callback`

> ⚠️ `ca.danjou.forge` est aussi l'identifiant de l'app (voir HANDOVER.md). Si
> tu le changes avant la publication, change-le aussi dans
> `src/lib/auth.ts` (`NATIVE_CALLBACK`), `AndroidManifest.xml`,
> `ios/App/App/Info.plist` et dans les Redirect URLs ci-dessus.

## 2. Courriel (5 min, gratuit)

Activé par défaut dans Supabase. Une seule chose à changer : l'app demande un
**code à 6 chiffres**, pas un lien.

**Authentication → Email Templates → Magic Link** : remplacer le contenu par
quelque chose comme :

```
<h2>Ton code FORGE</h2>
<p>Entre ce code dans l'app : <strong>{{ .Token }}</strong></p>
<p>Il expire dans une heure.</p>
```

Faire de même pour **Confirm signup**.

L'envoi de courriels intégré à Supabase est limité à quelques messages par
heure. Pour de vrais utilisateurs, brancher un fournisseur SMTP
(Resend, Postmark, SendGrid…) dans **Project Settings → Auth → SMTP**.

## 3. Google (20 min, gratuit)

1. https://console.cloud.google.com → nouveau projet → **APIs & Services →
   OAuth consent screen** : type *External*, nom FORGE, ton courriel.
2. **Credentials → Create credentials → OAuth client ID** → *Web application*.
   - *Authorized redirect URIs* : `https://xxxx.supabase.co/auth/v1/callback`
3. Copier le *Client ID* et le *Client secret* dans Supabase :
   **Authentication → Providers → Google**.

Ce même client web sert au site, à Android et à iPhone : la connexion
s'ouvre dans le navigateur du téléphone, puis revient dans l'app.

## 4. Apple (1 h, 99 $ US/an)

Nécessite un compte Apple Developer. Apple l'**exige** de toute app iPhone
qui offre Google : sans ça, l'App Store refuse l'app.

1. https://developer.apple.com → **Identifiers** : un *App ID*
   (`ca.danjou.forge`) avec *Sign in with Apple* coché, puis un
   *Services ID* (ex. `ca.danjou.forge.web`) avec *Sign in with Apple*
   configuré sur le domaine `xxxx.supabase.co` et le retour
   `https://xxxx.supabase.co/auth/v1/callback`.
2. **Keys** : créer une clé avec *Sign in with Apple*, télécharger le `.p8`.
3. Dans Supabase, **Authentication → Providers → Apple** : Services ID,
   Team ID, Key ID et le contenu du `.p8`.

## 5. Numéro de téléphone (30 min, payant à l'usage)

Les SMS passent par un fournisseur externe, facturé à chaque message
(environ 0,01 $ par SMS au Canada avec Twilio).

1. Créer un compte Twilio, acheter un numéro, créer un *Messaging Service*.
2. Supabase → **Authentication → Providers → Phone** : activer, choisir
   Twilio, coller *Account SID*, *Auth Token* et *Message Service SID*.
3. Fortement conseillé avant la mise en ligne : **Authentication → Rate
   Limits** (limiter les SMS par heure) et **Attack Protection → CAPTCHA**.
   Sans limite, n'importe qui peut faire envoyer des milliers de SMS à tes
   frais.

---

## Ce que fait l'app une fois configurée

- **Premier lancement :** l'écran « Create your account » passe avant
  l'onboarding. « Continue without an account » reste possible : tout reste
  alors sur le téléphone.
- **Compte existant sur un nouveau téléphone :** après la connexion, tout est
  rapatrié (profil, programme, séances, XP) et l'onboarding est sauté.
- **Nouveau compte :** l'onboarding commence avec le prénom fourni par Google
  ou Apple, et le programme créé est aussitôt sauvegardé sur le compte.
- **Réglages → Account :** se connecter plus tard (ce qui est sur le
  téléphone est conservé et fusionné), synchroniser, se déconnecter.

## Pas encore vérifié

Rien de ce qui précède n'a tourné contre un vrai projet Supabase : il
n'existe pas encore. Vérifié : l'écran, la validation des numéros et des
courriels (tests), et le retour de Google/Apple vers l'app Android
(`ca.danjou.forge://auth/callback` rouvre bien FORGE). La connexion Apple sur
iPhone demande un Mac pour compiler.
