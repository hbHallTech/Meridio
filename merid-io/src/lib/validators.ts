import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Adresse email invalide"),
});

export const verify2FASchema = z.object({
  code: z.string().length(6, "Le code doit contenir 6 chiffres"),
});

export const leaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, "Veuillez sélectionner un type de congé"),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
  startPeriod: z.enum(["FULL_DAY", "MORNING", "AFTERNOON"]),
  endPeriod: z.enum(["FULL_DAY", "MORNING", "AFTERNOON"]),
  reason: z.string().optional(),
  attachment: z.any().optional(),
});

export const userSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Adresse email invalide"),
  role: z.enum(["EMPLOYEE", "MANAGER", "HR", "ADMIN"]),
  teamId: z.string().optional(),
  officeId: z.string().optional(),
  managerId: z.string().optional(),
  hireDate: z.string().min(1, "La date d'embauche est requise"),
});

export const teamSchema = z.object({
  name: z.string().min(1, "Le nom de l'équipe est requis"),
  description: z.string().optional(),
  managerId: z.string().optional(),
});

export const leaveTypeSchema = z.object({
  name: z.string().min(1, "Le nom du type de congé est requis"),
  code: z.string().min(1, "Le code est requis"),
  defaultDays: z.number().min(0, "Le nombre de jours doit être positif"),
  requiresApproval: z.boolean(),
  requiresAttachment: z.boolean(),
  color: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type Verify2FAInput = z.infer<typeof verify2FASchema>;
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>;
