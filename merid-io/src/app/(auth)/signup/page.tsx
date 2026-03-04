"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Phone,
  ChevronRight,
  ChevronLeft,
  Check,
  User,
  Building2,
  Globe,
  Users,
  Briefcase,
  MapPin,
  Hash,
  Send,
  Sparkles,
  GitBranch,
} from "lucide-react";

/* ─── Types ─── */
interface SignupData {
  // Step 1 - Account
  email: string;
  phone: string;
  phonePrefix: string;
  password: string;
  acceptCgu: boolean;
  // Step 2 - Questionnaire (7 questions)
  firstName: string;
  lastName: string;
  companyName: string;
  activityDomain: string;
  website: string;
  jobTitle: string;
  employeeCount: string;
  // Step 3 - Organization settings
  orgName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  orgPhone: string;
  // Optional technical fields
  aiNeeds: string;
  subsidiaryCount: string;
}

const INITIAL_DATA: SignupData = {
  email: "",
  phone: "",
  phonePrefix: "+41",
  password: "",
  acceptCgu: false,
  firstName: "",
  lastName: "",
  companyName: "",
  activityDomain: "",
  website: "",
  jobTitle: "",
  employeeCount: "",
  orgName: "",
  street: "",
  postalCode: "",
  city: "",
  country: "Suisse",
  orgPhone: "",
  aiNeeds: "",
  subsidiaryCount: "",
};

const PHONE_PREFIXES = [
  { code: "+41", label: "Suisse (+41)", flag: "🇨🇭" },
  { code: "+33", label: "France (+33)", flag: "🇫🇷" },
  { code: "+216", label: "Tunisie (+216)", flag: "🇹🇳" },
  { code: "+49", label: "Allemagne (+49)", flag: "🇩🇪" },
  { code: "+39", label: "Italie (+39)", flag: "🇮🇹" },
  { code: "+32", label: "Belgique (+32)", flag: "🇧🇪" },
];

const ACTIVITY_DOMAINS = [
  "Agriculture & Alimentation",
  "Architecture & Construction",
  "Automobile & Transport",
  "Banque & Finance",
  "Commerce & Distribution",
  "Conseil & Audit",
  "Éducation & Formation",
  "Énergie & Environnement",
  "Hôtellerie & Restauration",
  "Immobilier",
  "Industrie & Manufacture",
  "Informatique & Technologie",
  "Médias & Communication",
  "Santé & Pharmaceutique",
  "Services juridiques",
  "Services publics",
  "Tourisme & Loisirs",
  "Autre",
];

const EMPLOYEE_RANGES = [
  "1 à 9",
  "10 à 49",
  "50 à 99",
  "100 à 249",
  "250 à 1000",
  "Plus de 1000",
];

const COUNTRIES = [
  // ── Prioritaires (Europe de l'Ouest + existants) ──
  "Suisse",
  "France",
  "Tunisie",
  "Allemagne",
  "Belgique",
  "Italie",
  "Luxembourg",
  // ── Reste de l'Europe ──
  "Autriche",
  "Espagne",
  "Portugal",
  "Pays-Bas",
  "Royaume-Uni",
  "Irlande",
  "Danemark",
  "Suède",
  "Norvège",
  "Finlande",
  "Islande",
  "Grèce",
  "Pologne",
  "République tchèque",
  "Slovaquie",
  "Hongrie",
  "Roumanie",
  "Bulgarie",
  "Croatie",
  "Slovénie",
  "Serbie",
  "Bosnie-Herzégovine",
  "Monténégro",
  "Macédoine du Nord",
  "Albanie",
  "Kosovo",
  "Estonie",
  "Lettonie",
  "Lituanie",
  "Malte",
  "Chypre",
  "Monaco",
  "Liechtenstein",
  "Andorre",
  "Saint-Marin",
  // ── Afrique ──
  "Algérie",
  "Maroc",
  "Libye",
  "Égypte",
  "Sénégal",
  "Côte d'Ivoire",
  "Mali",
  "Burkina Faso",
  "Niger",
  "Tchad",
  "Cameroun",
  "Gabon",
  "Congo",
  "République démocratique du Congo",
  "Nigeria",
  "Ghana",
  "Togo",
  "Bénin",
  "Guinée",
  "Sierra Leone",
  "Liberia",
  "Mauritanie",
  "Madagascar",
  "Maurice",
  "Mozambique",
  "Afrique du Sud",
  "Kenya",
  "Tanzanie",
  "Ouganda",
  "Rwanda",
  "Burundi",
  "Éthiopie",
  "Somalie",
  "Djibouti",
  "Érythrée",
  "Soudan",
  "Soudan du Sud",
  "Angola",
  "Zambie",
  "Zimbabwe",
  "Botswana",
  "Namibie",
  "Malawi",
  "Comores",
  "Seychelles",
  "Cap-Vert",
  "São Tomé-et-Príncipe",
  "Guinée équatoriale",
  "Guinée-Bissau",
  "Gambie",
  "Eswatini",
  "Lesotho",
  "République centrafricaine",
  // ── Amérique du Nord ──
  "Canada",
  "États-Unis",
  "Mexique",
  // ── Amérique centrale et Caraïbes ──
  "Guatemala",
  "Honduras",
  "Salvador",
  "Nicaragua",
  "Costa Rica",
  "Panama",
  "Cuba",
  "Haïti",
  "République dominicaine",
  "Jamaïque",
  "Trinité-et-Tobago",
  "Bahamas",
  "Barbade",
  "Sainte-Lucie",
  "Grenade",
  "Antigua-et-Barbuda",
  "Dominique",
  "Saint-Kitts-et-Nevis",
  "Saint-Vincent-et-les-Grenadines",
  "Belize",
  // ── Amérique du Sud ──
  "Brésil",
  "Argentine",
  "Colombie",
  "Pérou",
  "Chili",
  "Venezuela",
  "Équateur",
  "Bolivie",
  "Paraguay",
  "Uruguay",
  "Guyana",
  "Suriname",
  // ── Moyen-Orient ──
  "Turquie",
  "Arabie saoudite",
  "Émirats arabes unis",
  "Qatar",
  "Koweït",
  "Bahreïn",
  "Oman",
  "Yémen",
  "Irak",
  "Iran",
  "Jordanie",
  "Liban",
  "Syrie",
  "Israël",
  "Palestine",
  // ── Asie ──
  "Chine",
  "Japon",
  "Corée du Sud",
  "Corée du Nord",
  "Inde",
  "Pakistan",
  "Bangladesh",
  "Sri Lanka",
  "Népal",
  "Bhoutan",
  "Myanmar",
  "Thaïlande",
  "Vietnam",
  "Cambodge",
  "Laos",
  "Malaisie",
  "Singapour",
  "Indonésie",
  "Philippines",
  "Brunei",
  "Timor oriental",
  "Mongolie",
  "Kazakhstan",
  "Ouzbékistan",
  "Turkménistan",
  "Kirghizistan",
  "Tadjikistan",
  "Afghanistan",
  "Géorgie",
  "Arménie",
  "Azerbaïdjan",
  // ── Océanie ──
  "Australie",
  "Nouvelle-Zélande",
  "Fidji",
  "Papouasie-Nouvelle-Guinée",
  "Samoa",
  "Tonga",
  "Vanuatu",
  "Îles Salomon",
  "Kiribati",
  "Tuvalu",
  "Palaos",
  "Îles Marshall",
  "Micronésie",
  "Nauru",
  // ── Autre ──
  "Autre",
];

/* ─── Password strength ─── */
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: "Faible", color: "#ef4444" };
  if (score <= 2) return { score: 2, label: "Moyen", color: "#f59e0b" };
  if (score <= 3) return { score: 3, label: "Bon", color: "#00BCD4" };
  return { score: 4, label: "Excellent", color: "#22c55e" };
}

/* ─── Main Component ─── */
export default function SignupPage() {
  const [data, setData] = useState<SignupData>(INITIAL_DATA);
  const [step, setStep] = useState(0); // 0 = account, 1-7 = questionnaire, 8 = org settings
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const totalSteps = 9; // 0(account) + 7(questions) + 1(org)

  const updateField = useCallback(
    <K extends keyof SignupData>(key: K, value: SignupData[K]) => {
      setData((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  /* ─── Validation ─── */
  function validateStep(): boolean {
    const errs: Record<string, string> = {};

    if (step === 0) {
      if (!data.email) errs.email = "L'email est requis.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
        errs.email = "Email invalide.";
      if (!data.phone) errs.phone = "Le téléphone est requis.";
      if (!data.password) errs.password = "Le mot de passe est requis.";
      else if (data.password.length < 8)
        errs.password = "8 caractères minimum.";
      if (!data.acceptCgu) errs.acceptCgu = "Vous devez accepter les CGU.";
    } else if (step === 1) {
      if (!data.firstName.trim()) errs.firstName = "Le prénom est requis.";
    } else if (step === 2) {
      if (!data.lastName.trim()) errs.lastName = "Le nom est requis.";
    } else if (step === 3) {
      if (!data.companyName.trim()) errs.companyName = "Le nom de l'entreprise est requis.";
    } else if (step === 4) {
      if (!data.activityDomain) errs.activityDomain = "Sélectionnez un domaine.";
    }
    // Steps 5 (website), 6 (jobTitle), 7 (employeeCount) are optional or have defaults
    else if (step === 7) {
      if (!data.employeeCount) errs.employeeCount = "Sélectionnez une tranche.";
    } else if (step === 8) {
      if (!data.orgName.trim()) errs.orgName = "Le nom de l'entreprise est requis.";
      if (!data.city.trim()) errs.city = "La ville est requise.";
      if (!data.country) errs.country = "Le pays est requis.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (!validateStep()) return;
    // Auto-fill org name from company name
    if (step === 3 && !data.orgName) {
      updateField("orgName", data.companyName);
    }
    setStep((s) => Math.min(s + 1, 8));
  }

  function handlePrev() {
    setStep((s) => Math.max(s - 1, 0));
  }

  /* ─── Submit ─── */
  async function handleSubmit() {
    if (!validateStep()) return;
    setIsSubmitting(true);

    const body = {
      // Account
      email: data.email.toLowerCase().trim(),
      phone: `${data.phonePrefix} ${data.phone}`,
      // Profile
      firstName: data.firstName,
      lastName: data.lastName,
      jobTitle: data.jobTitle,
      // Company
      companyName: data.companyName,
      activityDomain: data.activityDomain,
      website: data.website,
      employeeCount: data.employeeCount,
      // Organization
      orgName: data.orgName,
      street: data.street,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country,
      orgPhone: data.orgPhone,
      // Technical
      aiNeeds: data.aiNeeds,
      subsidiaryCount: data.subsidiaryCount,
    };

    try {
      const res = await fetch("/api/signup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setIsSubmitted(true);
      } else {
        setErrors({ submit: "Une erreur est survenue. Veuillez réessayer." });
      }
    } catch {
      setErrors({ submit: "Erreur réseau. Vérifiez votre connexion." });
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ─── Success screen ─── */
  if (isSubmitted) {
    return (
      <div className="rounded-xl border bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Demande envoyée avec succès !
        </h2>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          Votre demande d&apos;inscription a été transmise à notre équipe.
          <br />
          Un <span className="font-semibold" style={{ color: "#1B3A5C" }}>super administrateur</span> vous
          contactera prochainement pour activer votre compte et configurer votre espace Meridio.
        </p>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-left text-sm text-blue-800 mb-6">
          <p className="font-medium mb-1">Prochaines étapes :</p>
          <ul className="list-disc pl-4 space-y-1 text-blue-700">
            <li>Validation de votre demande par notre équipe</li>
            <li>Création de votre espace entreprise (tenant)</li>
            <li>Envoi de vos identifiants de connexion</li>
          </ul>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#1B3A5C" }}
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }

  /* ─── Progress bar ─── */
  const progress = ((step + 1) / totalSteps) * 100;

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20";
  const inputClassNoIcon =
    "w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-sm transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20";
  const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

  return (
    <div className="w-full">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {step === 0
              ? "Inscription"
              : step <= 7
                ? "Configurez votre expérience"
                : "Paramètres de l'organisation"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {step === 0
              ? "Créez votre compte Meridio et commencez votre essai gratuit"
              : step <= 7
                ? `Question ${step} sur 7 — Ces informations nous aident à personnaliser votre espace`
                : "Complétez les informations de votre entreprise"}
          </p>
        </div>

        {/* Progress bar */}
        {step > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500">
                Étape {step <= 7 ? step : 8} / 8
              </span>
              <span className="text-xs font-medium" style={{ color: "#1B3A5C" }}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progress}%`,
                  backgroundColor: "#1B3A5C",
                }}
              />
            </div>
          </div>
        )}

        {/* Global errors */}
        {errors.submit && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.submit}
          </div>
        )}

        {/* ═══ STEP 0: Account creation ═══ */}
        {step === 0 && (
          <div className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className={labelClass}>
                Adresse email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={data.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className={inputClass}
                  placeholder="vous@entreprise.com — aucun SPAM"
                  aria-label="Adresse email"
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className={labelClass}>
                Téléphone <span className="text-gray-400 font-normal">(pour conseils et assistance)</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={data.phonePrefix}
                  onChange={(e) => updateField("phonePrefix", e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white py-2.5 px-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 w-[130px]"
                  aria-label="Indicatif téléphonique"
                >
                  {PHONE_PREFIXES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.flag} {p.code}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="phone"
                    type="tel"
                    value={data.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className={inputClass}
                    placeholder="79 123 45 67"
                    aria-label="Numéro de téléphone"
                    autoComplete="tel"
                  />
                </div>
              </div>
              {errors.phone && (
                <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" className={labelClass}>
                Mot de passe <span className="text-gray-400 font-normal">(8 caractères min.)</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  value={data.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
                  placeholder="Créez un mot de passe sécurisé"
                  aria-label="Mot de passe"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {data.password && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${(getPasswordStrength(data.password).score / 4) * 100}%`,
                          backgroundColor: getPasswordStrength(data.password).color,
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-medium"
                      style={{ color: getPasswordStrength(data.password).color }}
                    >
                      {getPasswordStrength(data.password).label}
                    </span>
                  </div>
                </div>
              )}
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            {/* CGU checkbox */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.acceptCgu}
                  onChange={(e) => updateField("acceptCgu", e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#1B3A5C]"
                  aria-label="Accepter les CGU"
                />
                <span className="text-sm text-gray-600">
                  J&apos;accepte les{" "}
                  <Link
                    href="/cgu"
                    className="font-medium underline"
                    style={{ color: "#00BCD4" }}
                    target="_blank"
                  >
                    CGU et la politique de confidentialité
                  </Link>
                </span>
              </label>
              {errors.acceptCgu && (
                <p className="mt-1 text-xs text-red-600">{errors.acceptCgu}</p>
              )}
            </div>

            {/* Submit step 0 */}
            <button
              type="button"
              onClick={handleNext}
              className="flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              Essai gratuit de 15 jours
              <ChevronRight className="ml-1.5 h-4 w-4" />
            </button>

            {/* Link to login */}
            <p className="text-center text-sm text-gray-500">
              Déjà inscrit ?{" "}
              <Link
                href="/login"
                className="font-medium hover:underline"
                style={{ color: "#00BCD4" }}
              >
                Connectez-vous
              </Link>
            </p>
          </div>
        )}

        {/* ═══ STEPS 1-7: Questionnaire ═══ */}
        {step >= 1 && step <= 7 && (
          <div className="space-y-5">
            {step === 1 && (
              <QuestionField
                number={1}
                label="Prénom"
                icon={<User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />}
                value={data.firstName}
                onChange={(v) => updateField("firstName", v)}
                placeholder="Votre prénom"
                error={errors.firstName}
                inputClass={inputClass}
                labelClass={labelClass}
              />
            )}
            {step === 2 && (
              <QuestionField
                number={2}
                label="Nom"
                icon={<User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />}
                value={data.lastName}
                onChange={(v) => updateField("lastName", v)}
                placeholder="Votre nom de famille"
                error={errors.lastName}
                inputClass={inputClass}
                labelClass={labelClass}
              />
            )}
            {step === 3 && (
              <QuestionField
                number={3}
                label="Nom de l'entreprise"
                icon={<Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />}
                value={data.companyName}
                onChange={(v) => updateField("companyName", v)}
                placeholder="Le nom de votre société"
                error={errors.companyName}
                inputClass={inputClass}
                labelClass={labelClass}
              />
            )}
            {step === 4 && (
              <div>
                <label className={labelClass}>
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold text-white mr-2" style={{ backgroundColor: "#1B3A5C" }}>
                    4
                  </span>
                  Domaine d&apos;activité
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                  <select
                    value={data.activityDomain}
                    onChange={(e) => updateField("activityDomain", e.target.value)}
                    className={inputClass + " appearance-none cursor-pointer"}
                    aria-label="Domaine d'activité"
                  >
                    <option value="">Sélectionnez votre domaine</option>
                    {ACTIVITY_DOMAINS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                {errors.activityDomain && (
                  <p className="mt-1 text-xs text-red-600">{errors.activityDomain}</p>
                )}
              </div>
            )}
            {step === 5 && (
              <QuestionField
                number={5}
                label="Site Internet"
                icon={<Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />}
                value={data.website}
                onChange={(v) => updateField("website", v)}
                placeholder="www.votresite.com (optionnel)"
                error={errors.website}
                inputClass={inputClass}
                labelClass={labelClass}
                optional
              />
            )}
            {step === 6 && (
              <QuestionField
                number={6}
                label="Votre fonction dans l'entreprise"
                icon={<Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />}
                value={data.jobTitle}
                onChange={(v) => updateField("jobTitle", v)}
                placeholder="ex. Responsable RH, CEO, DRH"
                error={errors.jobTitle}
                inputClass={inputClass}
                labelClass={labelClass}
                optional
              />
            )}
            {step === 7 && (
              <div>
                <label className={labelClass}>
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold text-white mr-2" style={{ backgroundColor: "#1B3A5C" }}>
                    7
                  </span>
                  Nombre d&apos;employés approximatif
                </label>
                <div className="mt-2 space-y-2">
                  {EMPLOYEE_RANGES.map((range) => (
                    <label
                      key={range}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        data.employeeCount === range
                          ? "border-[#1B3A5C] bg-[#1B3A5C]/5"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="employeeCount"
                        value={range}
                        checked={data.employeeCount === range}
                        onChange={(e) => updateField("employeeCount", e.target.value)}
                        className="h-4 w-4 accent-[#1B3A5C]"
                      />
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{range}</span>
                    </label>
                  ))}
                </div>
                {errors.employeeCount && (
                  <p className="mt-1 text-xs text-red-600">{errors.employeeCount}</p>
                )}
              </div>
            )}

            {/* Navigation buttons for questionnaire */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                Précédent
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#1B3A5C" }}
              >
                {step === 7 ? "Continuer" : "Suivant"}
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP 8: Organization settings ═══ */}
        {step === 8 && (
          <div className="space-y-5">
            {/* Org name */}
            <div>
              <label htmlFor="orgName" className={labelClass}>
                Nom de l&apos;entreprise
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="orgName"
                  type="text"
                  value={data.orgName}
                  onChange={(e) => updateField("orgName", e.target.value)}
                  className={inputClass}
                  placeholder="Nom officiel de l'entreprise"
                  aria-label="Nom de l'entreprise"
                />
              </div>
              {errors.orgName && (
                <p className="mt-1 text-xs text-red-600">{errors.orgName}</p>
              )}
            </div>

            {/* Street */}
            <div>
              <label htmlFor="street" className={labelClass}>
                Rue et numéro
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="street"
                  type="text"
                  value={data.street}
                  onChange={(e) => updateField("street", e.target.value)}
                  className={inputClass}
                  placeholder="Rue de la Gare 12"
                  aria-label="Rue et numéro"
                />
              </div>
            </div>

            {/* Postal + City row */}
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2">
                <label htmlFor="postalCode" className={labelClass}>
                  Code postal
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="postalCode"
                    type="text"
                    value={data.postalCode}
                    onChange={(e) => updateField("postalCode", e.target.value)}
                    className={inputClass}
                    placeholder="1003"
                    aria-label="Code postal"
                  />
                </div>
              </div>
              <div className="col-span-3">
                <label htmlFor="city" className={labelClass}>
                  Ville
                </label>
                <input
                  id="city"
                  type="text"
                  value={data.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  className={inputClassNoIcon}
                  placeholder="Lausanne"
                  aria-label="Ville"
                />
                {errors.city && (
                  <p className="mt-1 text-xs text-red-600">{errors.city}</p>
                )}
              </div>
            </div>

            {/* Country */}
            <div>
              <label htmlFor="country" className={labelClass}>
                Pays
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                <select
                  id="country"
                  value={data.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  className={inputClass + " appearance-none cursor-pointer"}
                  aria-label="Pays"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {errors.country && (
                <p className="mt-1 text-xs text-red-600">{errors.country}</p>
              )}
            </div>

            {/* Org phone */}
            <div>
              <label htmlFor="orgPhone" className={labelClass}>
                Téléphone entreprise
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="orgPhone"
                  type="tel"
                  value={data.orgPhone}
                  onChange={(e) => updateField("orgPhone", e.target.value)}
                  className={inputClass}
                  placeholder="+41 21 123 45 67"
                  aria-label="Téléphone entreprise"
                />
              </div>
            </div>

            {/* Separator - Technical fields */}
            <div className="border-t border-gray-200 pt-5">
              <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: "#00BCD4" }} />
                Questions techniques <span className="text-gray-400 font-normal">(optionnel)</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="aiNeeds" className={labelClass}>
                    Besoins spécifiques en IA ?
                  </label>
                  <input
                    id="aiNeeds"
                    type="text"
                    value={data.aiNeeds}
                    onChange={(e) => updateField("aiNeeds", e.target.value)}
                    className={inputClassNoIcon}
                    placeholder="ex. OCR bulletins de salaire, génération de contrats..."
                    aria-label="Besoins en IA"
                  />
                </div>
                <div>
                  <label htmlFor="subsidiaryCount" className={labelClass}>
                    Nombre d&apos;entités / filiales
                  </label>
                  <div className="relative">
                    <GitBranch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="subsidiaryCount"
                      type="text"
                      value={data.subsidiaryCount}
                      onChange={(e) => updateField("subsidiaryCount", e.target.value)}
                      className={inputClass}
                      placeholder="ex. 1, 3, 10+"
                      aria-label="Nombre d'entités"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation + Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                Précédent
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#1B3A5C" }}
              >
                {isSubmitting ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="mr-1.5 h-4 w-4" />
                    Envoyer ma demande
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Reusable Question Field Component ─── */
function QuestionField({
  number,
  label,
  icon,
  value,
  onChange,
  placeholder,
  error,
  inputClass,
  labelClass,
  optional,
}: {
  number: number;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
  inputClass: string;
  labelClass: string;
  optional?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>
        <span
          className="inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold text-white mr-2"
          style={{ backgroundColor: "#1B3A5C" }}
        >
          {number}
        </span>
        {label}
        {optional && <span className="text-gray-400 font-normal ml-1">(optionnel)</span>}
      </label>
      <div className="relative">
        {icon}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={placeholder}
          aria-label={label}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
