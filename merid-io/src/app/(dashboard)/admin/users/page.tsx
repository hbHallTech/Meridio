"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm, Controller, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Users, Plus, Pencil, Trash2, KeyRound, Copy, Check, Mail } from "lucide-react";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { userSchema } from "@/lib/validators";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const createUserSchema = userSchema.extend({
  password: z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s]).{8,}$/,
      "Min. 8 car., 1 maj., 1 min., 1 chiffre, 1 spécial"
    ),
  isActive: z.boolean().optional(),
  forcePasswordChange: z.boolean().optional(),
  sendNotification: z.boolean().optional(),
});

const editUserSchema = userSchema.extend({
  isActive: z.boolean().optional(),
  password: z.string().optional(),
  forcePasswordChange: z.boolean().optional(),
  sendNotification: z.boolean().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type EditUserForm = z.infer<typeof editUserSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isActive: boolean;
  hireDate: string;
  language: string;
  forcePasswordChange: boolean;
  createdAt: string;
  office: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
}

interface OfficeOption {
  id: string;
  name: string;
}

interface TeamOption {
  id: string;
  name: string;
}

const ALL_ROLES = ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] as const;

const roleConfig: Record<string, { bg: string; text: string }> = {
  ADMIN: { bg: "bg-purple-100", text: "text-purple-700" },
  HR: { bg: "bg-blue-100", text: "text-blue-700" },
  MANAGER: { bg: "bg-amber-100", text: "text-amber-700" },
  EMPLOYEE: { bg: "bg-gray-100", text: "text-gray-700" },
};

// ---------------------------------------------------------------------------
// Password generator
// ---------------------------------------------------------------------------
function generateStrongPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*+-=?";

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  // Ensure at least one of each
  const required = [pick(upper), pick(lower), pick(digits), pick(special)];

  // Fill remaining 12 chars
  const all = upper + lower + digits + special;
  const extra = Array.from({ length: 12 }, () => pick(all));

  // Shuffle
  const password = [...required, ...extra];
  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminUsersPage() {
  const { addToast } = useToast();

  // Data state
  const [users, setUsers] = useState<UserData[]>([]);
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Generated password display
  const [generatedPwd, setGeneratedPwd] = useState("");
  const [copiedPwd, setCopiedPwd] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch helpers
  // -------------------------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Erreur lors du chargement des utilisateurs");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      addToast({
        type: "error",
        title: "Erreur",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }, [addToast]);

  const fetchOffices = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/offices");
      if (!res.ok) throw new Error("Erreur lors du chargement des bureaux");
      const data = await res.json();
      setOffices(data.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })));
    } catch (err) {
      addToast({
        type: "error",
        title: "Erreur",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }, [addToast]);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/teams");
      if (!res.ok) throw new Error("Erreur lors du chargement des équipes");
      const data = await res.json();
      setTeams(data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
    } catch (err) {
      addToast({
        type: "error",
        title: "Erreur",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }, [addToast]);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchOffices(), fetchTeams()]).finally(() => setLoading(false));
  }, [fetchUsers, fetchOffices, fetchTeams]);

  // -------------------------------------------------------------------------
  // Password helpers
  // -------------------------------------------------------------------------
  const handleGeneratePassword = (form: UseFormReturn<CreateUserForm> | UseFormReturn<EditUserForm>) => {
    const pwd = generateStrongPassword();
    setGeneratedPwd(pwd);
    setCopiedPwd(false);
    form.setValue("password" as never, pwd as never);
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(generatedPwd);
      setCopiedPwd(true);
      addToast({ type: "success", title: "Copié", message: "Mot de passe copié dans le presse-papier" });
      setTimeout(() => setCopiedPwd(false), 2000);
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de copier" });
    }
  };

  // -------------------------------------------------------------------------
  // Create form
  // -------------------------------------------------------------------------
  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      roles: ["EMPLOYEE"],
      officeId: "",
      teamId: "",
      hireDate: "",
      isActive: true,
      forcePasswordChange: true,
      sendNotification: true,
    },
  });

  const handleCreate = async (data: CreateUserForm) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la création");
      }
      addToast({ type: "success", title: "Succès", message: "Utilisateur créé avec succès" });
      setCreateOpen(false);
      createForm.reset();
      setGeneratedPwd("");
      await fetchUsers();
    } catch (err) {
      addToast({
        type: "error",
        title: "Erreur",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Edit form
  // -------------------------------------------------------------------------
  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      roles: [],
      officeId: "",
      teamId: "",
      hireDate: "",
      isActive: true,
      forcePasswordChange: false,
      sendNotification: false,
    },
  });

  const openEdit = (user: UserData) => {
    setSelectedUser(user);
    setGeneratedPwd("");
    setCopiedPwd(false);
    editForm.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: "",
      roles: user.roles as ("EMPLOYEE" | "MANAGER" | "HR" | "ADMIN")[],
      officeId: user.office?.id || "",
      teamId: user.team?.id || "",
      hireDate: user.hireDate ? new Date(user.hireDate).toISOString().split("T")[0] : "",
      isActive: user.isActive,
      forcePasswordChange: user.forcePasswordChange,
      sendNotification: false,
    });
    setEditOpen(true);
  };

  const handleEdit = async (data: EditUserForm) => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        id: selectedUser.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        roles: data.roles,
        officeId: data.officeId,
        teamId: data.teamId || null,
        hireDate: data.hireDate,
        isActive: data.isActive,
        forcePasswordChange: data.forcePasswordChange,
        sendNotification: data.sendNotification,
      };
      if (data.password && data.password.trim().length > 0) {
        payload.password = data.password;
      }
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la mise à jour");
      }
      addToast({ type: "success", title: "Succès", message: "Utilisateur mis à jour avec succès" });
      setEditOpen(false);
      setSelectedUser(null);
      setGeneratedPwd("");
      await fetchUsers();
    } catch (err) {
      addToast({
        type: "error",
        title: "Erreur",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------
  const openDelete = (user: UserData) => {
    setSelectedUser(user);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedUser.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la suppression");
      }
      addToast({ type: "success", title: "Succès", message: "Utilisateur désactivé avec succès" });
      setDeleteOpen(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (err) {
      addToast({
        type: "error",
        title: "Erreur",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Shared form fields renderer
  // -------------------------------------------------------------------------
  function UserFormFields({
    form,
    isCreate,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: UseFormReturn<any>;
    isCreate: boolean;
  }) {
    return (
      <div className="space-y-4">
        {/* Prénom + Nom */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Prénom</label>
            <input
              {...form.register("firstName")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            />
            {form.formState.errors.firstName && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.firstName.message as string}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
            <input
              {...form.register("lastName")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            />
            {form.formState.errors.lastName && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.lastName.message as string}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            {...form.register("email")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
          />
          {form.formState.errors.email && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.email.message as string}</p>
          )}
        </div>

        {/* Password + Generate */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Mot de passe{!isCreate && " (laisser vide pour ne pas changer)"}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              {...form.register("password")}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              placeholder={isCreate ? "" : "Laisser vide pour ne pas changer"}
            />
            <button
              type="button"
              onClick={() => handleGeneratePassword(form)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
              title="Générer un mot de passe"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Générer
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.password.message as string}</p>
          )}

          {/* Generated password display + copy */}
          {generatedPwd && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <code className="flex-1 text-sm font-mono text-green-800">{generatedPwd}</code>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
              >
                {copiedPwd ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copier
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Roles */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Rôles</label>
          <Controller
            control={form.control}
            name="roles"
            render={({ field }) => (
              <div className="flex flex-wrap gap-3">
                {ALL_ROLES.map((role) => {
                  const checked = (field.value as string[]).includes(role);
                  return (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const current = field.value as string[];
                          if (checked) {
                            field.onChange(current.filter((r) => r !== role));
                          } else {
                            field.onChange([...current, role]);
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
                      />
                      {role}
                    </label>
                  );
                })}
              </div>
            )}
          />
          {form.formState.errors.roles && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.roles.message as string}</p>
          )}
        </div>

        {/* Bureau + Équipe */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Bureau</label>
            <select
              {...form.register("officeId")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            >
              <option value="">-- Sélectionner --</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {form.formState.errors.officeId && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.officeId.message as string}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Équipe</label>
            <select
              {...form.register("teamId")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            >
              <option value="">-- Aucune --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date embauche */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Date d&apos;embauche</label>
          <input
            type="date"
            {...form.register("hireDate")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
          />
          {form.formState.errors.hireDate && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.hireDate.message as string}</p>
          )}
        </div>

        {/* Toggles row */}
        <div className="flex flex-wrap items-center gap-6">
          {/* Statut */}
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <label className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value ?? true}
                  onClick={() => field.onChange(!field.value)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    field.value ? "bg-[#1B3A5C]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      field.value ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  {field.value ? "Actif" : "Inactif"}
                </span>
              </label>
            )}
          />

          {/* Force password change */}
          <Controller
            control={form.control}
            name="forcePasswordChange"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
                />
                <span className="font-medium text-gray-700">Forcer changement mot de passe</span>
              </label>
            )}
          />

          {/* Send notification */}
          <Controller
            control={form.control}
            name="sendNotification"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
                />
                <Mail className="h-3.5 w-3.5 text-gray-500" />
                <span className="font-medium text-gray-700">Notifier par email</span>
              </label>
            )}
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="mt-1 text-sm text-gray-500">
            {users.length} utilisateur{users.length !== 1 ? "s" : ""} enregistré
            {users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              createForm.reset();
              setGeneratedPwd("");
              setCopiedPwd(false);
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nouvel utilisateur
          </button>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
          >
            <Users className="h-5 w-5" style={{ color: "#1B3A5C" }} />
          </div>
        </div>
      </div>

      {/* Table */}
      {users.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucun utilisateur trouvé.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Nom</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Email</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Rôles</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Bureau</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Équipe</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Statut</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Embauche</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50/50 cursor-pointer"
                    onClick={() => openEdit(user)}
                  >
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                      {user.forcePasswordChange && (
                        <span className="ml-2 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700" title="Doit changer son mot de passe">
                          MDP
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => {
                          const cfg = roleConfig[role] ?? {
                            bg: "bg-gray-100",
                            text: "text-gray-700",
                          };
                          return (
                            <span
                              key={role}
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
                            >
                              {role}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {user.office?.name ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {user.team?.name ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {user.isActive ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {new Date(user.hireDate).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(user);
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B3A5C] transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDelete(user);
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => { setCreateOpen(false); setGeneratedPwd(""); }}
        title="Nouvel utilisateur"
        description="Remplissez les informations du nouvel utilisateur"
        maxWidth="lg"
      >
        <form onSubmit={createForm.handleSubmit(handleCreate)}>
          <UserFormFields form={createForm} isCreate={true} />
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setCreateOpen(false); setGeneratedPwd(""); }}
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer
            </button>
          </div>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelectedUser(null);
          setGeneratedPwd("");
        }}
        title="Modifier l'utilisateur"
        description={
          selectedUser
            ? `${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email})`
            : undefined
        }
        maxWidth="lg"
      >
        <form onSubmit={editForm.handleSubmit(handleEdit)}>
          <UserFormFields form={editForm} isCreate={false} />
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setEditOpen(false);
                setSelectedUser(null);
                setGeneratedPwd("");
              }}
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete ConfirmDialog */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedUser(null);
        }}
        onConfirm={handleDelete}
        title="Désactiver l'utilisateur"
        message={
          selectedUser
            ? `Êtes-vous sûr de vouloir désactiver ${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email}) ? L'utilisateur ne pourra plus se connecter.`
            : ""
        }
        confirmLabel="Désactiver"
        loading={submitting}
      />
    </div>
  );
}
