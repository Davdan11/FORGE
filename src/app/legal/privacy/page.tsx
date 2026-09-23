"use client";

import { APP_NAME, LEGAL, MIN_AGE, MIN_AGE_EUROPE } from "@/lib/brand";
import { LegalPage, Sec } from "@/components/LegalPage";

/* Written from what the code does, not from a template: every statement here
   should be checkable against src/. If the app changes what it collects or
   where it sends it, this page changes in the same commit. */
export default function PrivacyPolicy() {
  const A = APP_NAME;
  return (
    <LegalPage title="Privacy Policy">
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
    </LegalPage>
  );
}
