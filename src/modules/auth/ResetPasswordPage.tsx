import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PasswordInput } from "@/components/PasswordInput";
import { AuthLayout } from "@/components/AuthLayout";

export function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isInvite = window.location.hash.includes("type=invite");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      setError(error);
    } else {
      navigate("/projetos", { replace: true });
    }
  }

  if (loading) {
    return <p className="auth-loading">Carregando...</p>;
  }

  if (!session) {
    return (
      <AuthLayout>
        <h1>Link inválido ou expirado</h1>
        <p>Solicite um novo link de redefinição de senha.</p>
        <Link to="/esqueci-senha">Esqueci minha senha</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>{isInvite ? "Defina sua senha" : "Redefinir senha"}</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="password">Nova senha</label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <label htmlFor="confirm">Confirmar senha</label>
        <PasswordInput
          id="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : "Salvar senha"}
        </button>
      </form>
    </AuthLayout>
  );
}
