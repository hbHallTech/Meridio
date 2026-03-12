import { z } from "zod";

export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s]).{8,}$/;

export const PASSWORD_RULES =
  "Min. 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial";

export const loginSchema = z.object({
  email: z
    .string()
    .email("Adresse email invalide")
    .refine((email) => email.endsWith("@halley-technologies.ch"), {
      message: "L'email doit être @halley-technologies.ch",
    }),
  password: z.string().min(1, "Le mot de passe est requis"),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email("Adresse email invalide")
    .refine((email) => email.endsWith("@halley-technologies.ch"), {
      message: "L'email doit être @halley-technologies.ch",
    }),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .regex(PASSWORD_REGEX, PASSWORD_RULES),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis"),
    newPassword: z
      .string()
      .regex(PASSWORD_REGEX, PASSWORD_RULES),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export const verify2FASchema = z.object({
  code: z
    .string()
    .length(6, "Le code doit contenir 6 chiffres")
    .regex(/^\d{6}$/, "Le code doit être composé uniquement de chiffres"),
});

export const leaveRequestSchema = z.object({
  leaveTypeConfigId: z.string().min(1, "Veuillez sélectionner un type de congé"),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
  startHalfDay: z.enum(["FULL_DAY", "MORNING", "AFTERNOON"]),
  endHalfDay: z.enum(["FULL_DAY", "MORNING", "AFTERNOON"]),
  reason: z.string().optional(),
  exceptionalReason: z.string().optional(),
  attachments: z.any().optional(),
});

export const userSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Adresse email invalide"),
  roles: z
    .array(z.enum(["EMPLOYEE", "MANAGER", "HR", "ADMIN"]))
    .min(1, "Au moins un rôle est requis"),
  teamId: z.string().optional(),
  officeId: z.string().min(1, "Le bureau est requis"),
  hireDate: z.string().min(1, "La date d'embauche est requise"),
  cin: z.string().regex(/^[A-Z]{0,2}\d{6,10}$/, "Format CIN invalide (ex: 09815606 ou TN09815606)").optional().or(z.literal("")),
  cnss: z.string().regex(/^\d{7,10}$/, "Format CNSS invalide (ex: 1753436706)").optional().or(z.literal("")),
});

export const teamSchema = z.object({
  name: z.string().min(1, "Le nom de l'équipe est requis"),
  managerId: z.string().min(1, "Le manager est requis"),
  officeId: z.string().min(1, "Le bureau est requis"),
});

export const leaveTypeConfigSchema = z.object({
  code: z.string().min(1, "Le code est requis"),
  label_fr: z.string().min(1, "Le libellé FR est requis"),
  label_en: z.string().min(1, "Le libellé EN est requis"),
  requiresAttachment: z.boolean(),
  attachmentFromDay: z.number().optional(),
  deductsFromBalance: z.boolean(),
  balanceType: z.string().optional(),
  color: z.string().optional(),
});

export const officeSchema = z.object({
  name: z.string().min(1, "Le nom du bureau est requis"),
  country: z.string().min(1, "Le pays est requis"),
  city: z.string().min(1, "La ville est requise"),
  companyId: z.string().min(1, "L'entreprise est requise"),
  defaultAnnualLeave: z.number().min(0),
  defaultOfferedDays: z.number().min(0),
  minNoticeDays: z.number().min(0),
  maxCarryOverDays: z.number().min(0),
  carryOverDeadline: z.string(),
  probationMonths: z.number().min(0),
  sickLeaveJustifFromDay: z.number().min(1),
  workingDays: z.array(z.string()),
});

export const delegationSchema = z.object({
  fromUserId: z.string().min(1, "Le délégant est requis"),
  toUserId: z.string().min(1, "Le délégataire est requis"),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
});

export const approvalSchema = z.object({
  action: z.enum(["APPROVED", "REFUSED", "RETURNED"]),
  comment: z.string().optional(),
});

// ─── Documents Module ───

export const documentCreateSchema = z.object({
  userId: z.string().min(1, "L'identifiant employé est requis"),
  name: z.string().min(1, "Le nom du document est requis").max(255),
  type: z.enum(["FICHE_PAIE", "ATTESTATION_TRAVAIL", "CERTIFICAT_TRAVAIL", "CONTRAT", "AUTRE"]),
  metadata: z
    .object({
      mois: z.string().optional(),
      annee: z.string().optional(),
    })
    .optional(),
});

export const documentUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(["FICHE_PAIE", "ATTESTATION_TRAVAIL", "CERTIFICAT_TRAVAIL", "CONTRAT", "AUTRE"]).optional(),
  status: z.enum(["NOUVEAU", "OUVERT", "ARCHIVE"]).optional(),
  userId: z.string().min(1).optional(), // Assign/reassign document to a user (HR/Admin only)
  metadata: z
    .object({
      mois: z.string().optional(),
      annee: z.string().optional(),
    })
    .optional(),
});

export const documentListQuerySchema = z.object({
  type: z.enum(["FICHE_PAIE", "ATTESTATION_TRAVAIL", "CERTIFICAT_TRAVAIL", "CONTRAT", "AUTRE"]).optional(),
  status: z.enum(["NOUVEAU", "OUVERT", "ARCHIVE"]).optional(),
  mois: z.string().regex(/^\d{2}$/, "Format mois: 01-12").optional(),
  annee: z.string().regex(/^\d{4}$/, "Format année: YYYY").optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Document Templates ───

export const templateCreateSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(255),
  type: z.enum(["FICHE_PAIE", "ATTESTATION_TRAVAIL", "CERTIFICAT_TRAVAIL", "CONTRAT", "AUTRE"]),
  subject: z.string().max(500).optional(),
  content: z.string().min(1, "Le contenu est requis"),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const templateUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(["FICHE_PAIE", "ATTESTATION_TRAVAIL", "CERTIFICAT_TRAVAIL", "CONTRAT", "AUTRE"]).optional(),
  subject: z.string().max(500).optional().nullable(),
  content: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

// ─── User Personal Info (self-service) ───

export const userPersonalSchema = z.object({
  personalEmail: z.string().email("Adresse email invalide").optional().nullable().or(z.literal("")),
  personalPhone: z.string().max(20).optional().nullable().or(z.literal("")),
  personalMobile: z.string().max(20).optional().nullable().or(z.literal("")),
  personalAddressStreet: z.string().max(255).optional().nullable().or(z.literal("")),
  personalAddressZip: z.string().max(20).optional().nullable().or(z.literal("")),
  personalAddressCity: z.string().max(100).optional().nullable().or(z.literal("")),
  personalAddressCountry: z.string().max(100).optional().nullable().or(z.literal("")),
  birthDate: z.string().optional().nullable().or(z.literal("")),
  birthCity: z.string().max(100).optional().nullable().or(z.literal("")),
  birthCountry: z.string().max(100).optional().nullable().or(z.literal("")),
  nationality: z.string().max(100).optional().nullable().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional().nullable(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "PACSED", "OTHER"]).optional().nullable(),
  dependentsCount: z.number().int().min(0).max(50).optional(),
});

// ─── User Professional Info (HR/ADMIN only) ───

export const userProfessionalSchema = z.object({
  professionalPhone: z.string().max(20).optional().nullable().or(z.literal("")),
  internalNumber: z.string().max(50).optional().nullable().or(z.literal("")),
  service: z.string().max(100).optional().nullable().or(z.literal("")),
  jobFunction: z.string().max(100).optional().nullable().or(z.literal("")),
  arrivalDate: z.string().optional().nullable().or(z.literal("")),
  departureDate: z.string().optional().nullable().or(z.literal("")),
  accountingCode: z.string().max(50).optional().nullable().or(z.literal("")),
});

// ─── Emergency Contact ───

export const emergencyContactSchema = z.object({
  priority: z.number().int().min(1).max(5, "Priorité max : 5"),
  firstName: z.string().min(1, "Le prénom est requis").max(100),
  lastName: z.string().min(1, "Le nom est requis").max(100),
  relation: z.string().min(1, "La relation est requise").max(50),
  phone: z
    .string()
    .min(1, "Le téléphone est requis")
    .max(20)
    .regex(/^[+]?[\d\s\-().]{6,20}$/, "Format de téléphone invalide"),
  mobile: z
    .string()
    .max(20)
    .regex(/^[+]?[\d\s\-().]{6,20}$/, "Format de mobile invalide")
    .optional()
    .nullable()
    .or(z.literal("")),
  email: z.string().email("Adresse email invalide").optional().nullable().or(z.literal("")),
  address: z.string().max(255).optional().nullable().or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type Verify2FAInput = z.infer<typeof verify2FASchema>;
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
export type LeaveTypeConfigInput = z.infer<typeof leaveTypeConfigSchema>;
export type OfficeInput = z.infer<typeof officeSchema>;
export type DelegationInput = z.infer<typeof delegationSchema>;
export type ApprovalInput = z.infer<typeof approvalSchema>;
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;
export type UserPersonalInput = z.infer<typeof userPersonalSchema>;
export type UserProfessionalInput = z.infer<typeof userProfessionalSchema>;
export type EmergencyContactInput = z.infer<typeof emergencyContactSchema>;

// ─── Contract (HR/Admin only) ───

const CONTRACT_TYPES = ["CDI", "CDD", "SIVP", "STAGE", "ALTERNANCE", "FREELANCE", "AUTRE"] as const;
const CONTRACT_STATUSES = ["ACTIF", "TERMINE", "SUSPENDU", "EN_PROLONGATION", "EN_ATTENTE_SIGNATURE"] as const;

export const contractCreateSchema = z
  .object({
    type: z.enum(CONTRACT_TYPES, { message: "Le type de contrat est requis" }),
    status: z.enum(CONTRACT_STATUSES).optional(),
    contractNumber: z.string().max(50).optional().nullable(),
    startDate: z.string().min(1, "La date de début est requise"), // ISO string
    endDate: z.string().optional().nullable(),
    trialPeriodEnd: z.string().optional().nullable(),
    weeklyHours: z.number().min(0).max(168).optional().nullable(),
    salaryGrossMonthly: z.number().min(0, "Le salaire doit être positif").optional().nullable(),
    salaryGrossHourly: z.number().min(0).optional().nullable(),
    currency: z.string().length(3).default("TND"),
    paymentFrequency: z.string().max(50).optional().nullable(),
    paymentMethod: z.string().max(50).optional().nullable(),
    jobTitle: z.string().min(1, "Le poste est requis").max(200),
    department: z.string().max(200).optional().nullable(),
    managerId: z.string().optional().nullable(),
    conventionCollective: z.string().max(200).optional().nullable(),
    location: z.string().max(200).optional().nullable(),
    remoteAllowed: z.boolean().default(false),
    remotePercentage: z.number().int().min(0).max(100).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    documentId: z.string().optional().nullable(),
    signedAt: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      // CDD must have an endDate
      if (data.type === "CDD" && !data.endDate) return false;
      return true;
    },
    { message: "Un CDD doit avoir une date de fin", path: ["endDate"] }
  )
  .refine(
    (data) => {
      // endDate must be after startDate
      if (data.endDate && data.startDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    { message: "La date de fin doit être postérieure à la date de début", path: ["endDate"] }
  )
  .refine(
    (data) => {
      // trialPeriodEnd must be after startDate and before/equal endDate
      if (data.trialPeriodEnd && data.startDate) {
        const trial = new Date(data.trialPeriodEnd);
        if (trial <= new Date(data.startDate)) return false;
        if (data.endDate && trial > new Date(data.endDate)) return false;
      }
      return true;
    },
    { message: "La fin de période d'essai doit être entre le début et la fin du contrat", path: ["trialPeriodEnd"] }
  );

export const contractUpdateSchema = contractCreateSchema;

export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;

// ─── Skills ───

const SKILL_TYPES = ["TECHNICAL", "SOFT", "BEHAVIORAL", "OTHER"] as const;
const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

export const skillCreateSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100),
  type: z.enum(SKILL_TYPES, { message: "Type de compétence invalide" }),
  selfLevel: z.enum(SKILL_LEVELS).optional().nullable(),
  description: z.string().max(500).optional().nullable().or(z.literal("")),
  evidence: z.string().max(500).optional().nullable().or(z.literal("")),
});

export const skillSelfUpdateSchema = z.object({
  selfLevel: z.enum(SKILL_LEVELS, { message: "Niveau invalide" }),
  evidence: z.string().max(500).optional().nullable().or(z.literal("")),
});

export const skillManagerUpdateSchema = z.object({
  managerLevel: z.enum(SKILL_LEVELS, { message: "Niveau invalide" }),
});

export const skillHrUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(SKILL_TYPES).optional(),
  selfLevel: z.enum(SKILL_LEVELS).optional().nullable(),
  managerLevel: z.enum(SKILL_LEVELS).optional().nullable(),
  description: z.string().max(500).optional().nullable().or(z.literal("")),
  evidence: z.string().max(500).optional().nullable().or(z.literal("")),
});

export type SkillCreateInput = z.infer<typeof skillCreateSchema>;
export type SkillSelfUpdateInput = z.infer<typeof skillSelfUpdateSchema>;
export type SkillManagerUpdateInput = z.infer<typeof skillManagerUpdateSchema>;
export type SkillHrUpdateInput = z.infer<typeof skillHrUpdateSchema>;

// ─── Objectives ───

const OBJECTIVE_STATUSES = ["IN_PROGRESS", "ACHIEVED", "PARTIALLY_ACHIEVED", "NOT_ACHIEVED", "CANCELLED"] as const;

export const objectiveCreateSchema = z.object({
  title: z.string().min(1, "Le titre est requis").max(200),
  description: z.string().min(1, "La description est requise").max(2000),
  deadline: z.string().min(1, "La date limite est requise"),
  status: z.enum(OBJECTIVE_STATUSES).optional(),
  progress: z.number().int().min(0).max(100).optional().nullable(),
});

export const objectiveManagerUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  deadline: z.string().optional(),
  status: z.enum(OBJECTIVE_STATUSES).optional(),
  progress: z.number().int().min(0).max(100).optional().nullable(),
  managerComment: z.string().max(2000).optional().nullable().or(z.literal("")),
});

export const objectiveSelfCommentSchema = z.object({
  selfComment: z.string().max(2000, "Commentaire trop long"),
});

export type ObjectiveCreateInput = z.infer<typeof objectiveCreateSchema>;
export type ObjectiveManagerUpdateInput = z.infer<typeof objectiveManagerUpdateSchema>;
export type ObjectiveSelfCommentInput = z.infer<typeof objectiveSelfCommentSchema>;
