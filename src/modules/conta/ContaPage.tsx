import { useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PasswordInput } from "@/components/PasswordInput";

export function ContaPage() {
  const { user, memberships, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      setError(error);
    } else {
      setMessage("Senha atualizada.");
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <section>
      <h1>Minha conta</h1>
      <p>{user?.email}</p>

      <ul>
        {memberships.map((m) => (
          <li key={m.orgId}>
            {m.orgName} — {m.memberRole}
          </li>
        ))}
      </ul>

      <h2>Trocar senha</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="new-password">Nova senha</label>
        <PasswordInput
          id="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <label htmlFor="confirm-password">Confirmar senha</label>
        <PasswordInput
          id="confirm-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </section>
  );
}
