import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface OrgOption {
  id: string;
  name: string;
}

const MEMBER_ROLES = ["owner", "manager", "contributor", "viewer"] as const;

export function UsuariosPage() {
  const { canManageUsers } = useAuth();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState("");
  const [memberRole, setMemberRole] = useState<string>("viewer");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!canManageUsers) return;
    supabase
      .from("organizations")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        const rows = (data ?? []) as OrgOption[];
        setOrgs(rows);
        setOrgId((current) => current || rows[0]?.id || "");
      });
  }, [canManageUsers]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);

    const { error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        email,
        orgId,
        memberRole,
        redirectTo: `${window.location.origin}/redefinir-senha`,
      },
    });

    setSubmitting(false);
    if (error) {
      setError(error.message ?? "Erro ao criar usuário.");
    } else {
      setMessage(`Convite enviado para ${email}.`);
      setEmail("");
    }
  }

  if (!canManageUsers) {
    return (
      <section>
        <h1>Usuários</h1>
        <p>Você não tem permissão para gerenciar usuários.</p>
      </section>
    );
  }

  return (
    <section>
      <h1>Usuários</h1>
      <p>Convide um novo usuário e associe a uma organização. O convite chega por e-mail.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="new-user-email">E-mail</label>
        <input
          id="new-user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="new-user-org">Organização</label>
        <select id="new-user-org" value={orgId} onChange={(e) => setOrgId(e.target.value)} required>
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>

        <label htmlFor="new-user-role">Papel na organização</label>
        <select id="new-user-role" value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
          {MEMBER_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}

        <button type="submit" disabled={submitting || !orgId}>
          {submitting ? "Enviando..." : "Convidar usuário"}
        </button>
      </form>
    </section>
  );
}
