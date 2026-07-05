import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await requestPasswordReset(email);
    setSubmitting(false);
    if (error) {
      setError(error);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <section className="auth-card">
        <h1>Verifique seu e-mail</h1>
        <p>Se {email} estiver cadastrado, enviamos um link para redefinir a senha.</p>
        <Link to="/login">Voltar para o login</Link>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <h1>Esqueci minha senha</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Enviando..." : "Enviar link"}
        </button>
      </form>
      <Link to="/login">Voltar para o login</Link>
    </section>
  );
}
