import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface OrgOption {
  id: string;
  name: string;
}

interface OrgMemberRow {
  user_id: string;
  email: string;
  member_role: string;
}

const MEMBER_ROLES = ["owner", "manager", "contributor", "viewer"] as const;
type MemberRole = (typeof MEMBER_ROLES)[number];

export function UsuariosPage() {
  const { canManageUsers, user } = useAuth();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState("");
  const [memberRole, setMemberRole] = useState<string>("viewer");
  const [members, setMembers] = useState<OrgMemberRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadMembers(targetOrgId: string) {
    if (!targetOrgId) {
      setMembers([]);
      return;
    }
    const { data } = await supabase.rpc("get_org_members_with_email", { p_org_id: targetOrgId });
    setMembers((data ?? []) as OrgMemberRow[]);
  }

  useEffect(() => {
    if (!canManageUsers) return;
    supabase
      .from("organizations")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        const rows = (data ?? []) as OrgOption[];
        setOrgs(rows);
        setOrgId((current) => {
          const next = current || rows[0]?.id || "";
          loadMembers(next);
          return next;
        });
      });
  }, [canManageUsers]);

  function handleOrgChange(value: string) {
    setOrgId(value);
    loadMembers(value);
  }

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
      loadMembers(orgId);
    }
  }

  async function handleRoleChange(memberUserId: string, newRole: MemberRole) {
    const { error } = await supabase
      .from("org_members")
      .update({ member_role: newRole })
      .eq("org_id", orgId)
      .eq("user_id", memberUserId);
    if (error) {
      setError(error.message);
    } else {
      loadMembers(orgId);
    }
  }

  async function handleRemoveMember(memberUserId: string) {
    if (!confirm("Remover este usuário da organização?")) return;
    const { error } = await supabase.from("org_members").delete().eq("org_id", orgId).eq("user_id", memberUserId);
    if (error) {
      setError(error.message);
    } else {
      loadMembers(orgId);
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
        <select id="new-user-org" value={orgId} onChange={(e) => handleOrgChange(e.target.value)} required>
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

      <h2>Membros de {orgs.find((o) => o.id === orgId)?.name ?? "—"}</h2>
      {members.length === 0 && (
        <div className="empty-state">
          <p>Nenhum membro visível nesta organização ainda (ou o convite ainda não foi aceito).</p>
        </div>
      )}
      {members.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Papel</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td>{m.email}</td>
                <td>
                  <select
                    value={m.member_role}
                    onChange={(e) => handleRoleChange(m.user_id, e.target.value as MemberRole)}
                  >
                    {MEMBER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="row-actions">
                  {m.user_id !== user?.id && (
                    <button type="button" className="btn-icon-danger" onClick={() => handleRemoveMember(m.user_id)}>
                      Remover
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
