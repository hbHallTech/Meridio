"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  Search,
  Plus,
  Pencil,
  Eye,
  UserX,
  UserCheck,
  X,
  Copy,
  RefreshCw,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

// ─── Types ───

interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  isActive: boolean;
  hireDate: string;
  createdAt: string;
  office: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
}

interface OfficeOption {
  id: string;
  name: string;
  city: string;
}

interface TeamOption {
  id: string;
  name: string;
  officeId: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  officeId: string;
  teamId: string;
  roles: string[];
  hireDate: string;
  password: string;
}

type SortKey = "name" | "email" | "office" | "team" | "status";

const ROLES = ["EMPLOYEE", "MANAGER", "HR", "ADMIN"] as const;

const ROLE_COLORS: Record<string, string> = {
  EMPLOYEE: "bg-gray-100 text-gray-700",
  MANAGER: "bg-blue-100 text-blue-700",
  HR: "bg-purple-100 text-purple-700",
  ADMIN: "bg-red-100 text-red-700",
};

// ─── Generate password ───

function generatePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  let pw = "";
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < length; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  return pw
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

// ─── Component ───

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const router = useRouter();
  const lang = useLocale();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterOffice, setFilterOffice] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    officeId: "",
    teamId: "",
    roles: ["EMPLOYEE"],
    hireDate: new Date().toISOString().split("T")[0],
    password: "",
  });

  // Deactivation confirm
  const [deactivateUser, setDeactivateUser] = useState<UserRow | null>(null);

  // ─── Fetch ───

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterOffice) params.set("office", filterOffice);
      if (filterTeam) params.set("team", filterTeam);
      if (filterRole) params.set("role", filterRole);
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setOffices(data.offices);
        setTeams(data.teams);
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error loading users" : "Erreur de chargement" });
    } finally {
      setLoading(false);
    }
  }, [search, filterOffice, filterTeam, filterRole, filterStatus, addToast, lang]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ─── Sort ───

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name":
        cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        break;
      case "email":
        cmp = a.email.localeCompare(b.email);
        break;
      case "office":
        cmp = (a.office?.name ?? "").localeCompare(b.office?.name ?? "");
        break;
      case "team":
        cmp = (a.team?.name ?? "").localeCompare(b.team?.name ?? "");
        break;
      case "status":
        cmp = Number(b.isActive) - Number(a.isActive);
        break;
    }
    return sortAsc ? cmp : -cmp;
  });

  // ─── Modal handlers ───

  const openCreate = () => {
    setEditingUser(null);
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      officeId: offices[0]?.id ?? "",
      teamId: "",
      roles: ["EMPLOYEE"],
      hireDate: new Date().toISOString().split("T")[0],
      password: generatePassword(),
    });
    setModalOpen(true);
  };

  const openEdit = (user: UserRow) => {
    setEditingUser(user);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      officeId: user.office?.id ?? "",
      teamId: user.team?.id ?? "",
      roles: user.roles,
      hireDate: user.hireDate ? new Date(user.hireDate).toISOString().split("T")[0] : "",
      password: "",
    });
    setModalOpen(true);
  };

  const filteredTeams = teams.filter((t) => !form.officeId || t.officeId === form.officeId);

  const toggleRole = (role: string) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(form.password);
      addToast({ type: "success", title: lang === "en" ? "Password copied" : "Mot de passe copié" });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Copy failed" : "Copie échouée" });
    }
  };

  // ─── Submit ───

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.officeId || !form.roles.length || !form.hireDate) {
      addToast({ type: "error", title: lang === "en" ? "Please fill all required fields" : "Veuillez remplir tous les champs obligatoires" });
      return;
    }
    if (!editingUser && !form.password) {
      addToast({ type: "error", title: lang === "en" ? "Password is required" : "Le mot de passe est requis" });
      return;
    }

    setSaving(true);
    try {
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : "/api/admin/users";
      const method = editingUser ? "PATCH" : "POST";
      const payload = editingUser
        ? { ...form, password: form.password || undefined }
        : form;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        addToast({
          type: "success",
          title: editingUser
            ? lang === "en" ? "User updated" : "Utilisateur modifié"
            : lang === "en" ? "User created" : "Utilisateur créé",
        });
        setModalOpen(false);
        fetchUsers();
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Deactivate ───

  const handleToggleActive = async () => {
    if (!deactivateUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${deactivateUser.id}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        addToast({
          type: "success",
          title: data.isActive
            ? lang === "en" ? "User reactivated" : "Utilisateur réactivé"
            : lang === "en" ? "User deactivated" : "Utilisateur désactivé",
        });
        setDeactivateUser(null);
        fetchUsers();
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Sort icon ───

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp className="h-3 w-3 text-gray-300" />;
    return sortAsc
      ? <ChevronUp className="h-3 w-3 text-gray-700" />
      : <ChevronDown className="h-3 w-3 text-gray-700" />;
  };

  // ─── Render ───

  if (loading && users.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "User Management" : "Gestion des utilisateurs"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? `${users.length} user${users.length > 1 ? "s" : ""}`
              : `${users.length} utilisateur${users.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#15304D] transition-colors"
        >
          <Plus className="h-4 w-4" />
          {lang === "en" ? "Create user" : "Créer un utilisateur"}
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={lang === "en" ? "Search name, email…" : "Rechercher nom, email…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            />
          </div>

          <select
            value={filterOffice}
            onChange={(e) => { setFilterOffice(e.target.value); setFilterTeam(""); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
          >
            <option value="">{lang === "en" ? "All offices" : "Tous les bureaux"}</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>{o.name} — {o.city}</option>
            ))}
          </select>

          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
          >
            <option value="">{lang === "en" ? "All teams" : "Toutes les équipes"}</option>
            {teams
              .filter((t) => !filterOffice || t.officeId === filterOffice)
              .map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
          </select>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
          >
            <option value="">{lang === "en" ? "All roles" : "Tous les rôles"}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
          >
            <option value="">{lang === "en" ? "All statuses" : "Tous les statuts"}</option>
            <option value="active">{lang === "en" ? "Active" : "Actif"}</option>
            <option value="inactive">{lang === "en" ? "Inactive" : "Inactif"}</option>
          </select>
        </div>
      </div>

      {/* DataTable */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="cursor-pointer px-4 py-3 font-semibold text-gray-700" onClick={() => handleSort("name")}>
                  <span className="inline-flex items-center gap-1">
                    {lang === "en" ? "Name" : "Nom"} <SortIcon col="name" />
                  </span>
                </th>
                <th className="cursor-pointer px-4 py-3 font-semibold text-gray-700" onClick={() => handleSort("email")}>
                  <span className="inline-flex items-center gap-1">
                    Email <SortIcon col="email" />
                  </span>
                </th>
                <th className="cursor-pointer px-4 py-3 font-semibold text-gray-700" onClick={() => handleSort("office")}>
                  <span className="inline-flex items-center gap-1">
                    {lang === "en" ? "Office" : "Bureau"} <SortIcon col="office" />
                  </span>
                </th>
                <th className="cursor-pointer px-4 py-3 font-semibold text-gray-700" onClick={() => handleSort("team")}>
                  <span className="inline-flex items-center gap-1">
                    {lang === "en" ? "Team" : "Équipe"} <SortIcon col="team" />
                  </span>
                </th>
                <th className="px-4 py-3 font-semibold text-gray-700">
                  {lang === "en" ? "Roles" : "Rôles"}
                </th>
                <th className="cursor-pointer px-4 py-3 font-semibold text-gray-700" onClick={() => handleSort("status")}>
                  <span className="inline-flex items-center gap-1">
                    {lang === "en" ? "Status" : "Statut"} <SortIcon col="status" />
                  </span>
                </th>
                <th className="px-4 py-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedUsers.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${!user.isActive ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B3A5C] text-xs font-bold text-white">
                        {user.firstName[0]}{user.lastName[0]}
                      </div>
                      <span className="font-medium text-gray-900">{user.firstName} {user.lastName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3 text-gray-600">{user.office?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{user.team?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((r) => (
                        <span key={r} className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[r] ?? "bg-gray-100 text-gray-700"}`}>
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-green-500" : "bg-red-500"}`} />
                      {user.isActive
                        ? lang === "en" ? "Active" : "Actif"
                        : lang === "en" ? "Inactive" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/admin/users/${user.id}`)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B3A5C] transition-colors"
                        title={lang === "en" ? "View profile" : "Voir le profil"}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEdit(user)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                        title={lang === "en" ? "Edit" : "Modifier"}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeactivateUser(user)}
                        className={`rounded-lg p-1.5 transition-colors ${user.isActive ? "text-gray-400 hover:bg-red-50 hover:text-red-600" : "text-gray-400 hover:bg-green-50 hover:text-green-600"}`}
                        title={user.isActive
                          ? lang === "en" ? "Deactivate" : "Désactiver"
                          : lang === "en" ? "Reactivate" : "Réactiver"}
                      >
                        {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    {lang === "en" ? "No users found" : "Aucun utilisateur trouvé"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create / Edit Modal ─── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingUser
                  ? lang === "en" ? "Edit user" : "Modifier l'utilisateur"
                  : lang === "en" ? "Create user" : "Créer un utilisateur"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {lang === "en" ? "First name *" : "Prénom *"}
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {lang === "en" ? "Last name *" : "Nom *"}
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="prenom.nom@halley-technologies.ch"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  required
                />
                <p className="mt-1 text-xs text-gray-400">@halley-technologies.ch</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {lang === "en" ? "Office *" : "Bureau *"}
                  </label>
                  <select
                    value={form.officeId}
                    onChange={(e) => setForm({ ...form, officeId: e.target.value, teamId: "" })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                    required
                  >
                    <option value="">{lang === "en" ? "Select…" : "Sélectionner…"}</option>
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>{o.name} — {o.city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {lang === "en" ? "Team" : "Équipe"}
                  </label>
                  <select
                    value={form.teamId}
                    onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  >
                    <option value="">{lang === "en" ? "No team" : "Aucune équipe"}</option>
                    {filteredTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Roles *" : "Rôles *"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        form.roles.includes(role)
                          ? "bg-[#1B3A5C] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Hire date *" : "Date d'embauche *"}
                </label>
                <input
                  type="date"
                  value={form.hireDate}
                  onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {editingUser
                    ? lang === "en" ? "New password (leave empty to keep current)" : "Nouveau mot de passe (vide = inchangé)"
                    : lang === "en" ? "Initial password *" : "Mot de passe initial *"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editingUser ? "••••••••" : ""}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, password: generatePassword() })}
                    className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50 transition-colors"
                    title={lang === "en" ? "Generate" : "Générer"}
                  >
                    <RefreshCw className="h-4 w-4 text-gray-500" />
                  </button>
                  {form.password && (
                    <button
                      type="button"
                      onClick={copyPassword}
                      className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50 transition-colors"
                      title={lang === "en" ? "Copy" : "Copier"}
                    >
                      <Copy className="h-4 w-4 text-gray-500" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {lang === "en" ? "Cancel" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304D] disabled:opacity-50 transition-colors"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingUser
                    ? lang === "en" ? "Save changes" : "Enregistrer"
                    : lang === "en" ? "Create" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Deactivate / Reactivate Confirm Modal ─── */}
      {deactivateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto">
              {deactivateUser.isActive
                ? <UserX className="h-6 w-6 text-red-600" />
                : <UserCheck className="h-6 w-6 text-green-600" />}
            </div>
            <h3 className="text-center text-lg font-semibold text-gray-900">
              {deactivateUser.isActive
                ? lang === "en" ? "Deactivate user?" : "Désactiver l'utilisateur ?"
                : lang === "en" ? "Reactivate user?" : "Réactiver l'utilisateur ?"}
            </h3>
            <p className="mt-2 text-center text-sm text-gray-500">
              <strong>{deactivateUser.firstName} {deactivateUser.lastName}</strong>
              <br />
              {deactivateUser.isActive
                ? lang === "en"
                  ? "This user will no longer be able to log in."
                  : "Cet utilisateur ne pourra plus se connecter."
                : lang === "en"
                  ? "This user will be able to log in again."
                  : "Cet utilisateur pourra se reconnecter."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setDeactivateUser(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {lang === "en" ? "Cancel" : "Annuler"}
              </button>
              <button
                onClick={handleToggleActive}
                disabled={saving}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                  deactivateUser.isActive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {deactivateUser.isActive
                  ? lang === "en" ? "Deactivate" : "Désactiver"
                  : lang === "en" ? "Reactivate" : "Réactiver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
