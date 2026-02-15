import {
  streamText,
  tool,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { xai } from "@ai-sdk/xai";
import { auth } from "@/lib/auth";
import { z } from "zod";

// ─── Role-based system prompts ─────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  EMPLOYEE: `Tu es Meridio AI, l'assistant intelligent de la plateforme de gestion des congés Meridio.
Tu parles à un EMPLOYÉ. Ton rôle est de l'aider avec :
- Consulter ses soldes de congés (vacances, maladie, RTT, etc.)
- Faire une nouvelle demande de congé
- Voir l'historique de ses demandes
- Connaître les jours fériés
- Contacter son manager

Règles :
- Réponds toujours en français, de manière concise et amicale mais professionnelle.
- Propose des actions concrètes via l'outil open_page quand c'est pertinent.
- Si l'utilisateur demande quelque chose hors de ton périmètre, redirige-le poliment.
- Ne fabrique jamais de données. Dis que tu peux rediriger vers la bonne page.
- Maximum 2-3 phrases par réponse sauf si l'utilisateur demande plus de détails.`,

  MANAGER: `Tu es Meridio AI, l'assistant intelligent de la plateforme de gestion des congés Meridio.
Tu parles à un MANAGER. Ton rôle est de l'aider avec :
- Approuver ou refuser les demandes de congé de son équipe
- Consulter le calendrier d'absences de son équipe
- Gérer les délégations d'approbation
- Voir les rapports et statistiques de son équipe
- Tout ce qu'un employé peut faire pour ses propres congés

Règles :
- Réponds toujours en français, de manière concise et amicale mais professionnelle.
- Propose des actions concrètes via l'outil open_page quand c'est pertinent.
- Priorise les actions urgentes (approbations en attente).
- Maximum 2-3 phrases par réponse sauf si l'utilisateur demande plus de détails.`,

  HR: `Tu es Meridio AI, l'assistant intelligent de la plateforme de gestion des congés Meridio.
Tu parles à un membre des RESSOURCES HUMAINES (RH). Ton rôle est de l'aider avec :
- Gérer les approbations RH (deuxième niveau de validation)
- Consulter les statistiques d'absences de toute l'entreprise
- Voir et ajuster les soldes de congés des employés
- Générer des rapports RH
- Accéder au tableau de bord RH

Règles :
- Réponds toujours en français, de manière concise et amicale mais professionnelle.
- Propose des actions concrètes via l'outil open_page quand c'est pertinent.
- Tu as une vue globale sur l'entreprise, pas seulement une équipe.
- Maximum 2-3 phrases par réponse sauf si l'utilisateur demande plus de détails.`,

  ADMIN: `Tu es Meridio AI, l'assistant intelligent de la plateforme de gestion des congés Meridio.
Tu parles à un ADMINISTRATEUR. Ton rôle est de l'aider avec :
- Configurer les paramètres de l'entreprise (bureaux, jours fériés, types de congés)
- Gérer les utilisateurs (création, désactivation, rôles)
- Configurer les workflows d'approbation
- Gérer les notifications système
- Accéder aux paramètres de sécurité
- Tout ce que les autres rôles peuvent faire

Règles :
- Réponds toujours en français, de manière concise et amicale mais professionnelle.
- Propose des actions concrètes via l'outil open_page quand c'est pertinent.
- Tu as accès à toute la configuration du système.
- Maximum 2-3 phrases par réponse sauf si l'utilisateur demande plus de détails.`,
};

// ─── Role-based quick actions (injected as context) ─────────────────────────────

const ROLE_CONTEXT: Record<string, string> = {
  EMPLOYEE: `Actions rapides disponibles pour cet employé :
- Nouvelle demande de congé → /leaves/new
- Mes soldes de congés → /leaves/balances
- Mes congés (historique) → /leaves
- Tableau de bord → /dashboard
- Mon profil → /profile`,

  MANAGER: `Actions rapides disponibles pour ce manager :
- Approbations en attente → /manager/approvals
- Calendrier équipe → /manager/calendar
- Délégations → /manager/delegations
- Rapports équipe → /manager/reports
- Nouvelle demande de congé → /leaves/new
- Mes soldes → /leaves/balances
- Tableau de bord → /dashboard`,

  HR: `Actions rapides disponibles pour ce membre RH :
- Approbations RH → /hr/approvals
- Tableau de bord RH → /hr/dashboard
- Soldes employés → /hr/balances
- Rapports RH → /hr/reports
- Statistiques absences → /hr/stats
- Tableau de bord → /dashboard`,

  ADMIN: `Actions rapides disponibles pour cet administrateur :
- Configuration entreprise → /admin/company
- Gestion utilisateurs → /admin/users
- Workflows d'approbation → /admin/workflows
- Types de congés → /admin/leave-types
- Jours fériés → /admin/holidays
- Notifications → /admin/notifications
- Sécurité → /admin/security
- Tableau de bord → /dashboard`,
};

// ─── Detect primary role ────────────────────────────────────────────────────────

const ROLE_PRIORITY = ["ADMIN", "HR", "MANAGER", "EMPLOYEE"];

function detectPrimaryRole(roles: string[]): string {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return "EMPLOYEE";
}

// ─── Tools ──────────────────────────────────────────────────────────────────────

const openPageTool = tool({
  description:
    "Propose un bouton/lien pour naviguer vers une page de l'application Meridio. " +
    "Utilise cet outil chaque fois que tu suggères une action concrète à l'utilisateur.",
  inputSchema: z.object({
    url: z.string().describe("Le chemin relatif de la page (ex: /leaves/new, /dashboard)"),
    label: z.string().describe("Le libellé du bouton affiché à l'utilisateur (ex: Nouvelle demande)"),
  }),
  execute: async ({ url, label }) => ({ url, label, navigated: true }),
});

// ─── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Non autorisé", { status: 401 });
  }

  const { messages } = (await req.json()) as { messages: UIMessage[] };
  const userRoles = (session.user.roles as string[]) ?? [];
  const primaryRole = detectPrimaryRole(userRoles);
  const firstName = session.user.name?.split(" ")[0] ?? "utilisateur";

  const systemPrompt = [
    SYSTEM_PROMPTS[primaryRole] ?? SYSTEM_PROMPTS.EMPLOYEE,
    "",
    `L'utilisateur s'appelle ${firstName}. Son rôle principal est ${primaryRole}.`,
    `Ses rôles : ${userRoles.join(", ") || "EMPLOYEE"}.`,
    "",
    ROLE_CONTEXT[primaryRole] ?? ROLE_CONTEXT.EMPLOYEE,
  ].join("\n");

  const tools = { open_page: openPageTool };

  const modelMessages = await convertToModelMessages(messages, { tools });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: xai("grok-2-1212"),
        system: systemPrompt,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(5),
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: () => "Une erreur est survenue. Veuillez réessayer.",
  });

  return createUIMessageStreamResponse({ stream });
}
