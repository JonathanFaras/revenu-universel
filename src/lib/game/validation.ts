import { z } from "zod";

export const nicknameSchema = z
  .string()
  .trim()
  .min(2, "Le pseudo doit contenir au moins 2 caractères.")
  .max(20, "Le pseudo est trop long.");

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,8}$/, "Code de salle invalide.");

export const round1ChoiceSchema = z.enum(["work", "leisure", "training"]);
export const voteChoiceSchema = z.enum(["taxes_all", "robot_tax", "wealth_tax"]);

export const joinPayloadSchema = z.object({
  code: roomCodeSchema,
  nickname: nicknameSchema,
});

export const choosePayloadSchema = z.object({
  participantId: z.string().uuid(),
  choice: round1ChoiceSchema,
});

export const votePayloadSchema = z.object({
  participantId: z.string().uuid(),
  choice: voteChoiceSchema,
});
