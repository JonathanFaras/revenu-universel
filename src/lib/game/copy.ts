import type { Round1Choice } from "./types";

export const DISCUSSION_ROUND_1 =
  "Pourquoi avez-vous choisi cette option ?";

export const ROUND1_OPTIONS = [
  {
    id: "work" as const,
    title: "Travail",
    subtitle: "+3 jetons",
    description: "Ton solde passe de 5 à 8.",
  },
  {
    id: "leisure" as const,
    title: "Temps libre",
    subtitle: "Aucun gain",
    description: "Tu disposes de ton temps.",
  },
  {
    id: "training" as const,
    title: "Formation",
    subtitle: "−2 jetons",
    description: "Ton solde passe de 5 à 3.",
  },
];

export const VOTE_OPTIONS = [
  {
    id: "taxes_all" as const,
    title: "Impôts pour tous",
    description: "Une contribution versée par l'ensemble des participants.",
  },
  {
    id: "robot_tax" as const,
    title: "Taxe sur les robots",
    description: "Un prélèvement ciblé sur l'automatisation.",
  },
  {
    id: "wealth_tax" as const,
    title: "Taxe sur les grandes fortunes",
    description: "Une contribution limitée aux patrimoines les plus élevés.",
  },
];

export function mealMessage(
  balance: number,
  ate: boolean | null,
  choice?: Round1Choice,
): string {
  if (choice === "training") {
    return `Grâce à ta formation, tu as gagné 3 jetons ! Tu as reçu ton bonus, payé ton repas à 6 jetons et il te reste 3 jetons.`;
  }
  if (ate === true && balance <= 2) {
    return `Ton solde est de ${balance} jeton${balance > 1 ? "s" : ""}. Tu as pu payer ton repas, mais il te reste peu d'argent.`;
  }
  if (ate === true) {
    return `Ton solde est de ${balance} jetons. Tu as pu payer ton repas.`;
  }
  if (ate === false) {
    return `Ton solde est de ${balance} jetons. Tu n'as pas pu payer le repas à 6 jetons.`;
  }
  return `Ton solde est de ${balance} jetons.`;
}
