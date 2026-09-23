"use client";

import Link from "next/link";
import { APP_NAME, HEALTH_NOTICE, LEGAL, MIN_AGE, MIN_AGE_EUROPE } from "@/lib/brand";
import { LegalPage, Sec } from "@/components/LegalPage";

export default function Terms() {
  const A = APP_NAME;
  return (
    <LegalPage title="Terms of Use">
      <p>
        These terms are an agreement between you and {LEGAL.company} for the use of {A}. By using the app you agree to them. If you do not agree, do not use the app.
        How we handle your information is described in the <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
      </p>

      <Sec title="Who can use it">
        <p>You must be at least {MIN_AGE} years old, or {MIN_AGE_EUROPE} in the EU, the EEA and Switzerland. If you are under the age of majority where you live, a parent or guardian must agree to these terms for you.</p>
      </Sec>

      <Sec title="Not medical advice">
        <p>{HEALTH_NOTICE}</p>
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
    </LegalPage>
  );
}
