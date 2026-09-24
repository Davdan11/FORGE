"use client";

import { APP_NAME, LEGAL, MIN_AGE, MIN_AGE_EUROPE } from "@/lib/brand";
import { LegalPage, Sec } from "@/components/LegalPage";
import { useLang } from "@/lib/i18n";

/* Written from what the code does, not from a template: every statement here
   should be checkable against src/. If the app changes what it collects or
   where it sends it, this page changes in the same commit. */
export default function PrivacyPolicy() {
  const fr = useLang() === "fr";
  return (
    <LegalPage title={fr ? "Politique de confidentialité" : "Privacy Policy"}>
      {fr ? <PrivacyFr /> : <PrivacyEn />}
    </LegalPage>
  );
}

function PrivacyEn() {
  const A = APP_NAME;
  return (
    <>
      <p>
        {A} is a training app: a workout plan, activity recording, nutrition and an indoor riding and running mode. This policy explains what
        information the app handles, where it goes, and the choices you have. {A} is provided by {LEGAL.company} (&ldquo;we&rdquo;), {LEGAL.address}.
      </p>

      <Sec title="The short version">
        <ul className="list-disc pl-5 grid gap-1">
          <li>Everything you enter is stored on your phone first. The app works without an account and without an internet connection.</li>
          <li>If you create an account, your data is copied to our database so it is backed up and available on your other devices.</li>
          <li>We do not show ads, we do not use advertising or analytics trackers, and we do not sell or share your personal information for advertising.</li>
          <li>You can export a copy of your data, and delete your account and everything stored with it, from Settings.</li>
        </ul>
      </Sec>

      <Sec title="What the app collects">
        <p><strong>Information you give us:</strong> your name, age, sex, height and body weight; your goal, training experience, schedule and where you train; injuries and areas of pain; sleep, stress and daily activity level; diet preferences and foods you avoid; daily check-ins (sleep, soreness, stress, mood); workouts, sets and weights you log; meals you log; weigh-ins.</p>
        <p><strong>Activity recording:</strong> when you record an outdoor activity, the app uses your phone&rsquo;s precise location, including in the background while the recording is running, to measure your route, distance, pace and elevation. When you open the Move screen, the app also reads your current location once to center the map; that location is not saved or sent to us. Location is not collected in the background when you are not recording.</p>
        <p><strong>Sensors:</strong> if you connect a Bluetooth heart-rate strap, power meter, smart trainer, treadmill or footpod, the app reads heart rate, power, cadence and speed during your session and saves them with that session.</p>
        <p><strong>Account:</strong> if you create an account, the email address or phone number you sign in with, or the basic profile Apple or Google shares with us when you use them to sign in (name and email).</p>
        <p><strong>Health information.</strong> Much of the above is health information: body measurements, injuries and pain, heart rate, sleep and stress, diet and calories. We use it only to build and adjust your training and nutrition plan and to show you your progress. See &ldquo;Consumer health data&rdquo; below.</p>
      </Sec>

      <Sec title="Where your information is stored">
        <p><strong>On your phone.</strong> By default everything stays in the app&rsquo;s storage on your device.</p>
        <p><strong>In your account.</strong> If you sign in, your data is synced to a database hosted for us by Supabase, Inc. in {LEGAL.dataRegion}. Each record is tied to your account and protected so that only you can read or change it. Data travels over encrypted connections.</p>
      </Sec>

      <Sec title="What other people can see">
        <p>Nothing, unless you choose to share it.</p>
        <ul className="list-disc pl-5 grid gap-1">
          <li><strong>Posts.</strong> If you post an activity to the feed, other users see your handle, the activity&rsquo;s title, sport, distance, time and climb, and a map of the route. The first and last 250 meters of the route are removed before it leaves your phone so it does not show where you start or finish, and posts are grouped by an area of roughly 10 km (6 miles), never an address. You can take a post down at any time.</li>
          <li><strong>Leaderboards.</strong> If you take part, your handle, level, XP and streak are visible to other users.</li>
          <li><strong>Riding or running with others indoors.</strong> When you are signed in and start an indoor session, other people on the same virtual course see your first name and your position on that virtual road, live. No real-world location is ever sent, and these positions are not stored.</li>
        </ul>
      </Sec>

      <Sec title="Other services the app uses">
        <ul className="list-disc pl-5 grid gap-1">
          <li><strong>Supabase</strong> — account sign-in, database and live indoor sessions.</li>
          <li><strong>Apple and Google</strong> — only if you choose to sign in with them.</li>
          <li><strong>CARTO</strong> — map images. To draw a map, your device requests map tiles for the area shown, which tells CARTO your IP address and that area.</li>
          <li><strong>Unsplash</strong> — some photos in the app are loaded from Unsplash, which receives your IP address.</li>
        </ul>
        <p>These providers process information to run their service for us. We do not give them your training, health or nutrition data except Supabase, which stores it for us.</p>
      </Sec>

      <Sec title="Reminders">
        <p>If you turn on reminders, they are scheduled on your phone. No reminder content is sent to us.</p>
      </Sec>

      <Sec title="Claiming a reward">
        <p>If you claim a physical gift, you give us a shipping name, address, country and, optionally, a phone number for the courier. With the claim, the app sends a summary of your training so we can check it is genuine: account age, level and XP, the number of sessions, sets and activities, how your indoor time was measured, your streak, badge count, weight change since you started, and a list of your last dozen sessions and activities (date and title). No GPS track is sent. Only you and our team can see a claim. We use the address only to ship that gift, and share it only with the carrier that delivers it. Addresses are erased 120 days after a claim is shipped or refused; the training summary stays with the claim record so we can answer questions about it.</p>
      </Sec>

      <Sec title="How long we keep it">
        <p>Data on your phone stays until you delete it (Settings → Reset this device) or remove the app. Data in your account stays until you delete it or delete your account. When you delete your account, it is removed from our database immediately; copies in our provider&rsquo;s encrypted backups expire on their normal schedule.</p>
      </Sec>

      <Sec title="Your choices and rights">
        <ul className="list-disc pl-5 grid gap-1">
          <li><strong>Access and portability:</strong> Settings → Backup → Export a copy.</li>
          <li><strong>Correction:</strong> edit your profile, logs and activities in the app.</li>
          <li><strong>Deletion:</strong> delete any activity or post; Settings → Delete account removes your account and all of its data.</li>
          <li><strong>Withdraw consent:</strong> stop sharing by taking posts down, sign out to stop syncing, or delete your account. Location and Bluetooth permissions can be turned off in your phone&rsquo;s settings.</li>
        </ul>
        <p>Depending on where you live — including California, Washington, other US states, the UK, the EU and the European Economic Area — you may have further rights, such as to know what we hold, to object to or restrict processing, and to complain to a data protection authority. To exercise any right, write to {LEGAL.email}. We will not discriminate against you for exercising them.</p>
      </Sec>

      <Sec title="Consumer health data">
        <p>This section is our consumer health data privacy policy under Washington&rsquo;s My Health My Data Act and similar state laws.</p>
        <p><strong>Categories collected:</strong> body measurements (height, weight), age and sex; injuries and pain; heart rate; sleep, soreness, stress and mood check-ins; diet, food intake and calories; exercise and activity data, including location while recording.</p>
        <p><strong>Sources:</strong> you, and Bluetooth sensors you connect.</p>
        <p><strong>Purpose:</strong> to build and adjust your training and nutrition plan, record your activities and show your progress. We do not use it for advertising.</p>
        <p><strong>Sharing:</strong> with Supabase, which stores it for us. We do not sell consumer health data. Only what you choose to post (see &ldquo;What other people can see&rdquo;) is visible to other users.</p>
        <p><strong>Your rights:</strong> to confirm whether we collect it, access it, delete it and withdraw consent, as described above.</p>
      </Sec>

      <Sec title="Legal bases (EU, EEA and UK)">
        <p>We process your information to provide the app you asked for (contract), and your health information with your explicit consent, which you give when you set up your plan and can withdraw at any time. Where data is transferred outside your country, we rely on the safeguards our providers offer, such as the European Commission&rsquo;s Standard Contractual Clauses.</p>
      </Sec>

      <Sec title="Children">
        <p>{A} is not for children. You must be at least {MIN_AGE} to use it, or {MIN_AGE_EUROPE} in the EU, the EEA and Switzerland. If you believe a child has given us information, contact us and we will delete it.</p>
      </Sec>

      <Sec title="Security">
        <p>We use encrypted connections, per-account access rules in our database, and keep what we collect to what the app needs. No system is perfectly secure; if a breach affects you, we will tell you as the law requires.</p>
      </Sec>

      <Sec title="Changes">
        <p>If we change this policy in a way that matters, we will tell you in the app before the change applies.</p>
      </Sec>

      <Sec title="Contact">
        <p>{LEGAL.company} · {LEGAL.address} · {LEGAL.email}</p>
      </Sec>
    </>
  );
}

function PrivacyFr() {
  const A = APP_NAME;
  return (
    <>
      <p>
        {A} est une app d&rsquo;entraînement : un plan d&rsquo;entraînement, l&rsquo;enregistrement d&rsquo;activités, la nutrition et un mode vélo et course à l&rsquo;intérieur. Cette politique explique quelles
        informations l&rsquo;app traite, où elles vont et les choix que tu as. {A} est offerte par {LEGAL.company} (&laquo;&nbsp;nous&nbsp;&raquo;), {LEGAL.address}.
      </p>

      <Sec title="En bref">
        <ul className="list-disc pl-5 grid gap-1">
          <li>Tout ce que tu entres est d&rsquo;abord stocké sur ton téléphone. L&rsquo;app fonctionne sans compte et sans connexion internet.</li>
          <li>Si tu crées un compte, tes données sont copiées dans notre base de données pour être sauvegardées et accessibles sur tes autres appareils.</li>
          <li>Nous n&rsquo;affichons pas de publicité, nous n&rsquo;utilisons aucun traceur publicitaire ou analytique, et nous ne vendons ni ne partageons tes renseignements personnels à des fins publicitaires.</li>
          <li>Tu peux exporter une copie de tes données, et supprimer ton compte et tout ce qui y est stocké, depuis les Réglages.</li>
        </ul>
      </Sec>

      <Sec title="Ce que l’app recueille">
        <p><strong>Les informations que tu nous donnes :</strong> ton nom, ton âge, ton sexe, ta taille et ton poids; ton objectif, ton expérience d&rsquo;entraînement, ton horaire et l&rsquo;endroit où tu t&rsquo;entraînes; tes blessures et zones de douleur; ton sommeil, ton stress et ton niveau d&rsquo;activité quotidien; tes préférences alimentaires et les aliments que tu évites; tes bilans quotidiens (sommeil, courbatures, stress, humeur); les entraînements, séries et charges que tu enregistres; les repas que tu enregistres; tes pesées.</p>
        <p><strong>Enregistrement d&rsquo;activités :</strong> quand tu enregistres une activité extérieure, l&rsquo;app utilise la position précise de ton téléphone, y compris en arrière-plan pendant l&rsquo;enregistrement, pour mesurer ton parcours, ta distance, ton allure et ton dénivelé. Quand tu ouvres l&rsquo;écran Bouger, l&rsquo;app lit aussi ta position actuelle une fois pour centrer la carte; cette position n&rsquo;est ni sauvegardée ni envoyée chez nous. La position n&rsquo;est pas recueillie en arrière-plan quand tu n&rsquo;enregistres pas.</p>
        <p><strong>Capteurs :</strong> si tu connectes une ceinture cardio, un capteur de puissance, un home trainer intelligent, un tapis roulant ou un footpod Bluetooth, l&rsquo;app lit la fréquence cardiaque, la puissance, la cadence et la vitesse pendant ta séance et les sauvegarde avec cette séance.</p>
        <p><strong>Compte :</strong> si tu crées un compte, l&rsquo;adresse courriel ou le numéro de téléphone avec lequel tu te connectes, ou le profil de base qu&rsquo;Apple ou Google nous transmet quand tu les utilises pour te connecter (nom et courriel).</p>
        <p><strong>Informations de santé.</strong> Une bonne partie de ce qui précède est de l&rsquo;information de santé : mensurations, blessures et douleurs, fréquence cardiaque, sommeil et stress, alimentation et calories. Nous l&rsquo;utilisons seulement pour bâtir et ajuster ton plan d&rsquo;entraînement et de nutrition et pour te montrer tes progrès. Voir &laquo;&nbsp;Données de santé des consommateurs&nbsp;&raquo; plus bas.</p>
      </Sec>

      <Sec title="Où tes informations sont stockées">
        <p><strong>Sur ton téléphone.</strong> Par défaut, tout reste dans le stockage de l&rsquo;app sur ton appareil.</p>
        <p><strong>Dans ton compte.</strong> Si tu te connectes, tes données sont synchronisées vers une base de données hébergée pour nous par Supabase, Inc. dans la région {LEGAL.dataRegion}. Chaque enregistrement est lié à ton compte et protégé de façon à ce que toi seul puisses le lire ou le modifier. Les données transitent par des connexions chiffrées.</p>
      </Sec>

      <Sec title="Ce que les autres peuvent voir">
        <p>Rien, à moins que tu choisisses de le partager.</p>
        <ul className="list-disc pl-5 grid gap-1">
          <li><strong>Publications.</strong> Si tu publies une activité dans le fil, les autres utilisateurs voient ton pseudo, le titre de l&rsquo;activité, le sport, la distance, le temps et le dénivelé, ainsi qu&rsquo;une carte du parcours. Les 250 premiers et derniers mètres du parcours sont retirés avant qu&rsquo;il quitte ton téléphone pour ne pas montrer d&rsquo;où tu pars ni où tu arrives, et les publications sont regroupées par zone d&rsquo;environ 10 km (6 milles), jamais par adresse. Tu peux retirer une publication en tout temps.</li>
          <li><strong>Classements.</strong> Si tu y participes, ton pseudo, ton niveau, tes XP et ta série sont visibles par les autres utilisateurs.</li>
          <li><strong>Rouler ou courir avec d&rsquo;autres à l&rsquo;intérieur.</strong> Quand tu es connecté et que tu lances une séance intérieure, les autres personnes sur le même parcours virtuel voient ton prénom et ta position sur cette route virtuelle, en direct. Aucune position réelle n&rsquo;est jamais envoyée, et ces positions ne sont pas stockées.</li>
        </ul>
      </Sec>

      <Sec title="Autres services utilisés par l’app">
        <ul className="list-disc pl-5 grid gap-1">
          <li><strong>Supabase</strong> — connexion au compte, base de données et séances intérieures en direct.</li>
          <li><strong>Apple et Google</strong> — seulement si tu choisis de te connecter avec eux.</li>
          <li><strong>CARTO</strong> — images de carte. Pour dessiner une carte, ton appareil demande les tuiles de la zone affichée, ce qui communique à CARTO ton adresse IP et cette zone.</li>
          <li><strong>Unsplash</strong> — certaines photos de l&rsquo;app sont chargées depuis Unsplash, qui reçoit ton adresse IP.</li>
        </ul>
        <p>Ces fournisseurs traitent des informations pour faire fonctionner leur service pour nous. Nous ne leur transmettons pas tes données d&rsquo;entraînement, de santé ou de nutrition, sauf à Supabase, qui les stocke pour nous.</p>
      </Sec>

      <Sec title="Rappels">
        <p>Si tu actives les rappels, ils sont programmés sur ton téléphone. Aucun contenu de rappel ne nous est envoyé.</p>
      </Sec>

      <Sec title="Réclamer une récompense">
        <p>Si tu réclames un cadeau physique, tu nous donnes un nom d&rsquo;expédition, une adresse, un pays et, si tu le veux, un numéro de téléphone pour le transporteur. Avec la réclamation, l&rsquo;app envoie un résumé de ton entraînement pour que nous puissions vérifier qu&rsquo;il est authentique : l&rsquo;âge du compte, ton niveau et tes XP, le nombre de séances, de séries et d&rsquo;activités, la façon dont ton temps à l&rsquo;intérieur a été mesuré, ta série, ton nombre de badges, ta variation de poids depuis le début, et une liste de tes douze dernières séances et activités (date et titre). Aucune trace GPS n&rsquo;est envoyée. Seuls toi et notre équipe pouvez voir une réclamation. Nous utilisons l&rsquo;adresse uniquement pour expédier ce cadeau, et la partageons seulement avec le transporteur qui le livre. Les adresses sont effacées 120 jours après l&rsquo;expédition ou le refus d&rsquo;une réclamation; le résumé d&rsquo;entraînement reste avec le dossier de la réclamation pour que nous puissions répondre aux questions à son sujet.</p>
      </Sec>

      <Sec title="Combien de temps nous les gardons">
        <p>Les données sur ton téléphone restent jusqu&rsquo;à ce que tu les supprimes (Réglages → Réinitialiser cet appareil) ou que tu désinstalles l&rsquo;app. Les données de ton compte restent jusqu&rsquo;à ce que tu les supprimes ou que tu supprimes ton compte. Quand tu supprimes ton compte, il est retiré de notre base de données immédiatement; les copies dans les sauvegardes chiffrées de notre fournisseur expirent selon leur calendrier normal.</p>
      </Sec>

      <Sec title="Tes choix et tes droits">
        <ul className="list-disc pl-5 grid gap-1">
          <li><strong>Accès et portabilité :</strong> Réglages → Sauvegarde → Exporter une copie.</li>
          <li><strong>Rectification :</strong> modifie ton profil, tes journaux et tes activités dans l&rsquo;app.</li>
          <li><strong>Suppression :</strong> supprime n&rsquo;importe quelle activité ou publication; Réglages → Supprimer le compte retire ton compte et toutes ses données.</li>
          <li><strong>Retrait du consentement :</strong> arrête de partager en retirant tes publications, déconnecte-toi pour arrêter la synchronisation, ou supprime ton compte. Les autorisations de localisation et de Bluetooth peuvent être désactivées dans les réglages de ton téléphone.</li>
        </ul>
        <p>Selon l&rsquo;endroit où tu vis — notamment la Californie, l&rsquo;État de Washington, d&rsquo;autres États américains, le Royaume-Uni, l&rsquo;UE et l&rsquo;Espace économique européen — tu peux avoir d&rsquo;autres droits, comme celui de savoir ce que nous détenons, de t&rsquo;opposer au traitement ou de le limiter, et de porter plainte auprès d&rsquo;une autorité de protection des données. Pour exercer un droit, écris à {LEGAL.email}. Nous ne te ferons subir aucune discrimination pour les avoir exercés.</p>
      </Sec>

      <Sec title="Données de santé des consommateurs">
        <p>Cette section constitue notre politique de confidentialité des données de santé des consommateurs au sens de la loi My Health My Data de l&rsquo;État de Washington et de lois d&rsquo;État similaires.</p>
        <p><strong>Catégories recueillies :</strong> mensurations (taille, poids), âge et sexe; blessures et douleurs; fréquence cardiaque; bilans de sommeil, de courbatures, de stress et d&rsquo;humeur; alimentation, apport alimentaire et calories; données d&rsquo;exercice et d&rsquo;activité, y compris la position pendant l&rsquo;enregistrement.</p>
        <p><strong>Sources :</strong> toi, et les capteurs Bluetooth que tu connectes.</p>
        <p><strong>Finalité :</strong> bâtir et ajuster ton plan d&rsquo;entraînement et de nutrition, enregistrer tes activités et montrer tes progrès. Nous ne les utilisons pas à des fins publicitaires.</p>
        <p><strong>Partage :</strong> avec Supabase, qui les stocke pour nous. Nous ne vendons pas de données de santé des consommateurs. Seul ce que tu choisis de publier (voir &laquo;&nbsp;Ce que les autres peuvent voir&nbsp;&raquo;) est visible par les autres utilisateurs.</p>
        <p><strong>Tes droits :</strong> confirmer si nous les recueillons, y accéder, les supprimer et retirer ton consentement, comme décrit plus haut.</p>
      </Sec>

      <Sec title="Bases légales (UE, EEE et Royaume-Uni)">
        <p>Nous traitons tes informations pour te fournir l&rsquo;app que tu as demandée (contrat), et tes informations de santé avec ton consentement explicite, que tu donnes en configurant ton plan et que tu peux retirer en tout temps. Lorsque des données sont transférées hors de ton pays, nous nous appuyons sur les garanties offertes par nos fournisseurs, comme les clauses contractuelles types de la Commission européenne.</p>
      </Sec>

      <Sec title="Enfants">
        <p>{A} n&rsquo;est pas destinée aux enfants. Tu dois avoir au moins {MIN_AGE} ans pour l&rsquo;utiliser, ou {MIN_AGE_EUROPE} ans dans l&rsquo;UE, l&rsquo;EEE et en Suisse. Si tu crois qu&rsquo;un enfant nous a fourni des informations, contacte-nous et nous les supprimerons.</p>
      </Sec>

      <Sec title="Sécurité">
        <p>Nous utilisons des connexions chiffrées, des règles d&rsquo;accès par compte dans notre base de données, et nous limitons ce que nous recueillons à ce dont l&rsquo;app a besoin. Aucun système n&rsquo;est parfaitement sûr; si une atteinte te touche, nous t&rsquo;en informerons comme la loi l&rsquo;exige.</p>
      </Sec>

      <Sec title="Modifications">
        <p>Si nous modifions cette politique de façon importante, nous te le dirons dans l&rsquo;app avant que le changement s&rsquo;applique.</p>
      </Sec>

      <Sec title="Contact">
        <p>{LEGAL.company} · {LEGAL.address} · {LEGAL.email}</p>
      </Sec>
    </>
  );
}
