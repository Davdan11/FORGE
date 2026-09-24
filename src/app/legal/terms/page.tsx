"use client";

import Link from "next/link";
import { APP_NAME, HEALTH_NOTICE, LEGAL, MIN_AGE, MIN_AGE_EUROPE } from "@/lib/brand";
import { LegalPage, Sec } from "@/components/LegalPage";
import { useLang } from "@/lib/i18n";

export default function Terms() {
  const fr = useLang() === "fr";
  return (
    <LegalPage title={fr ? "Conditions d’utilisation" : "Terms of Use"}>
      {fr ? <TermsFr /> : <TermsEn />}
    </LegalPage>
  );
}

function TermsEn() {
  const A = APP_NAME;
  return (
    <>
      <p>
        These terms are an agreement between you and {LEGAL.company} for the use of {A}. By using the app you agree to them. If you do not agree, do not use the app.
        How we handle your information is described in the <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
      </p>

      <Sec title="Who can use it">
        <p>You must be at least {MIN_AGE} years old, or {MIN_AGE_EUROPE} in the EU, the EEA and Switzerland. If you are under the age of majority where you live, a parent or guardian must agree to these terms for you.</p>
      </Sec>

      <Sec title="Not medical advice">
        <p>{HEALTH_NOTICE.en}</p>
        <p>Training plans, loads, calorie and nutrition targets, heart-rate zones and calorie estimates are generated automatically from what you enter and are estimates. Adjustments for injuries only leave out or soften exercises; they are not treatment. You decide what you do, and you are responsible for training within your limits.</p>
      </Sec>

      <Sec title="Exercise carries risk">
        <p>Physical activity, including lifting, running, cycling and using trainers and treadmills, carries a risk of injury. Use equipment as its maker instructs, keep a treadmill&rsquo;s safety key attached, and be aware of your surroundings when recording outdoors. Features that let the app change a treadmill&rsquo;s incline or speed, or a trainer&rsquo;s resistance, are off until you turn them on.</p>
      </Sec>

      <Sec title="Your account">
        <p>Keep your sign-in secure; you are responsible for what happens under your account. You can delete your account at any time in Settings.</p>
      </Sec>

      <Sec title="Fair play">
        <p>Ranks, XP, challenges and leaderboards only mean something if they are earned. Do not falsify activities or sensor data, use a vehicle to record a run or ride, tamper with the app, or use it to harass anyone. Pacers in indoor sessions are bots and are always labeled as bots. We may remove content, reset progress or suspend accounts that break these rules.</p>
      </Sec>

      <Sec title="What you post">
        <p>You own what you post. You give us permission to store and show it to other users as the app is designed to, until you remove it. Do not post anything unlawful or that you do not have the right to share.</p>
      </Sec>

      <Sec title="Rewards">
        <p>XP, levels, ranks, badges and unlockable items have no cash value, cannot be sold or transferred, and may change as the app develops.</p>
        <p>From time to time we may offer physical gifts to athletes who reach a goal we announce in the app. Each offer states what it takes, its dates and how many are available; it ends when its stock runs out, and a daily limit may apply. A claim is a request, not a guarantee: every claim is reviewed by hand, and we may refuse or cancel one where the activity behind it looks inaccurate, automated or manipulated, or where shipping to the address given is not possible or not lawful. One claim per person per offer. Gifts have no cash value and cannot be exchanged. We ship worldwide where carriers allow; delivery times vary, and any customs duties charged by your country are yours. No purchase is necessary.</p>
      </Sec>

      <Sec title="The app itself">
        <p>We work to keep {A} accurate and available, but it is provided &ldquo;as is&rdquo;. To the extent the law allows, we make no warranties about it, and we are not liable for indirect or consequential losses, or for injury arising from exercise you choose to do. Nothing in these terms limits rights you have under consumer protection laws that cannot be waived.</p>
      </Sec>

      <Sec title="Changes and ending">
        <p>We may update these terms; if a change matters, we will tell you in the app before it applies. You can stop using the app at any time. We may suspend access for serious or repeated breaches of these terms.</p>
      </Sec>

      <Sec title="Law">
        <p>These terms are governed by the laws of {LEGAL.governingLaw}, except where the law of the country you live in gives you protections that cannot be set aside.</p>
      </Sec>

      <Sec title="Contact">
        <p>{LEGAL.company} · {LEGAL.address} · {LEGAL.email}</p>
      </Sec>
    </>
  );
}

function TermsFr() {
  const A = APP_NAME;
  return (
    <>
      <p>
        Ces conditions constituent une entente entre toi et {LEGAL.company} pour l&rsquo;utilisation de {A}. En utilisant l&rsquo;app, tu les acceptes. Si tu ne les acceptes pas, n&rsquo;utilise pas l&rsquo;app.
        La façon dont nous traitons tes informations est décrite dans la <Link href="/legal/privacy" className="underline">Politique de confidentialité</Link>.
      </p>

      <Sec title="Qui peut l’utiliser">
        <p>Tu dois avoir au moins {MIN_AGE} ans, ou {MIN_AGE_EUROPE} ans dans l&rsquo;UE, l&rsquo;EEE et en Suisse. Si tu n&rsquo;as pas atteint l&rsquo;âge de la majorité là où tu vis, un parent ou un tuteur doit accepter ces conditions pour toi.</p>
      </Sec>

      <Sec title="Pas un avis médical">
        <p>{HEALTH_NOTICE.fr}</p>
        <p>Les plans d&rsquo;entraînement, les charges, les cibles caloriques et nutritionnelles, les zones de fréquence cardiaque et les estimations de calories sont générés automatiquement à partir de ce que tu entres et sont des estimations. Les ajustements pour les blessures ne font que retirer ou adoucir des exercices; ce n&rsquo;est pas un traitement. C&rsquo;est toi qui décides de ce que tu fais, et tu es responsable de t&rsquo;entraîner dans tes limites.</p>
      </Sec>

      <Sec title="L’exercice comporte des risques">
        <p>L&rsquo;activité physique, y compris la musculation, la course, le vélo et l&rsquo;utilisation de home trainers et de tapis roulants, comporte un risque de blessure. Utilise l&rsquo;équipement selon les instructions de son fabricant, garde la clé de sécurité du tapis roulant attachée, et reste attentif à ce qui t&rsquo;entoure quand tu enregistres à l&rsquo;extérieur. Les fonctions qui permettent à l&rsquo;app de changer l&rsquo;inclinaison ou la vitesse d&rsquo;un tapis roulant, ou la résistance d&rsquo;un home trainer, sont désactivées jusqu&rsquo;à ce que tu les actives.</p>
      </Sec>

      <Sec title="Ton compte">
        <p>Garde ta connexion sécurisée; tu es responsable de ce qui se passe dans ton compte. Tu peux supprimer ton compte en tout temps dans les Réglages.</p>
      </Sec>

      <Sec title="Franc-jeu">
        <p>Les rangs, les XP, les défis et les classements n&rsquo;ont de sens que s&rsquo;ils sont mérités. Ne falsifie pas d&rsquo;activités ni de données de capteurs, n&rsquo;utilise pas un véhicule pour enregistrer une course ou une sortie à vélo, ne trafique pas l&rsquo;app, et ne l&rsquo;utilise pas pour harceler qui que ce soit. Les meneurs d&rsquo;allure des séances intérieures sont des bots et sont toujours identifiés comme des bots. Nous pouvons retirer du contenu, réinitialiser la progression ou suspendre les comptes qui enfreignent ces règles.</p>
      </Sec>

      <Sec title="Ce que tu publies">
        <p>Ce que tu publies t&rsquo;appartient. Tu nous donnes la permission de le stocker et de le montrer aux autres utilisateurs comme l&rsquo;app est conçue pour le faire, jusqu&rsquo;à ce que tu le retires. Ne publie rien d&rsquo;illégal ni rien que tu n&rsquo;as pas le droit de partager.</p>
      </Sec>

      <Sec title="Récompenses">
        <p>Les XP, niveaux, rangs, badges et objets à débloquer n&rsquo;ont aucune valeur monétaire, ne peuvent être ni vendus ni transférés, et peuvent changer à mesure que l&rsquo;app évolue.</p>
        <p>De temps à autre, nous pouvons offrir des cadeaux physiques aux athlètes qui atteignent un objectif annoncé dans l&rsquo;app. Chaque offre indique ce qu&rsquo;il faut faire, ses dates et le nombre disponible; elle prend fin lorsque son stock est épuisé, et une limite quotidienne peut s&rsquo;appliquer. Une réclamation est une demande, pas une garantie : chaque réclamation est vérifiée à la main, et nous pouvons en refuser ou en annuler une lorsque l&rsquo;activité qui la justifie semble inexacte, automatisée ou manipulée, ou lorsque l&rsquo;expédition à l&rsquo;adresse fournie n&rsquo;est pas possible ou pas légale. Une réclamation par personne par offre. Les cadeaux n&rsquo;ont aucune valeur monétaire et ne peuvent pas être échangés. Nous expédions partout dans le monde où les transporteurs le permettent; les délais de livraison varient, et les droits de douane éventuellement exigés par ton pays sont à ta charge. Aucun achat n&rsquo;est requis.</p>
      </Sec>

      <Sec title="L’app elle-même">
        <p>Nous travaillons à garder {A} exacte et disponible, mais elle est fournie &laquo;&nbsp;telle quelle&nbsp;&raquo;. Dans la mesure permise par la loi, nous n&rsquo;offrons aucune garantie à son sujet, et nous ne sommes pas responsables des pertes indirectes ou consécutives, ni des blessures découlant de l&rsquo;exercice que tu choisis de faire. Rien dans ces conditions ne limite les droits auxquels tu ne peux pas renoncer en vertu des lois sur la protection du consommateur.</p>
      </Sec>

      <Sec title="Modifications et fin">
        <p>Nous pouvons mettre à jour ces conditions; si un changement est important, nous te le dirons dans l&rsquo;app avant qu&rsquo;il s&rsquo;applique. Tu peux cesser d&rsquo;utiliser l&rsquo;app en tout temps. Nous pouvons suspendre l&rsquo;accès en cas de manquements graves ou répétés à ces conditions.</p>
      </Sec>

      <Sec title="Droit applicable">
        <p>Ces conditions sont régies par les lois de {LEGAL.governingLaw}, sauf lorsque la loi du pays où tu vis t&rsquo;accorde des protections qui ne peuvent pas être écartées.</p>
      </Sec>

      <Sec title="Contact">
        <p>{LEGAL.company} · {LEGAL.address} · {LEGAL.email}</p>
      </Sec>
    </>
  );
}
