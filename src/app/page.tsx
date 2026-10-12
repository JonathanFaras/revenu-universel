import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, MonitorPlay, Smartphone, Users } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
        Simulation pédagogique
      </p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
        Revenu universel, prix et financement.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
        Trois manches, un animateur, des téléphones. Une expérience de groupe pour
        discuter des choix individuels, du pouvoir d&apos;achat et de qui paie.
      </p>
      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <Link
          href="/host"
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 font-medium text-slate-950"
        >
          Espace animateur <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/join"
          className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/15 px-6 text-white"
        >
          Rejoindre une salle
        </Link>
      </div>
      <ul className="mt-16 grid gap-4 md:grid-cols-3">
        <Feature
          icon={<Users className="h-5 w-5" />}
          title="Manche 1"
          text="Le revenu arrive. Travail, temps libre ou formation."
        />
        <Feature
          icon={<Smartphone className="h-5 w-5" />}
          title="Manche 2"
          text="Les prix montent. Qui peut encore payer le repas ?"
        />
        <Feature
          icon={<MonitorPlay className="h-5 w-5" />}
          title="Manche 3"
          text="Qui finance ? Un vote pour ouvrir le débat, pas pour tricher."
        />
      </ul>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <li className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-cyan-300">{icon}</div>
      <h2 className="mt-3 text-lg font-medium text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </li>
  );
}
