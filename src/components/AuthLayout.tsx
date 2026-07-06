import type { ReactNode } from "react";
import { Leaf, ShieldCheck, Link2, MapPinned } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";

const FEATURES = [
  { icon: ShieldCheck, label: "MRV auditável, do inventário ao ciclo de verificação" },
  { icon: Link2, label: "Créditos tokenizados e verificáveis publicamente" },
  { icon: MapPinned, label: "Rastreabilidade geográfica da distribuição" },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  const { branding } = useBranding();

  return (
    <div className="auth-layout">
      <div className="auth-layout-brand">
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt="SafeCarbon"
              style={{ maxWidth: "44px", maxHeight: "44px", objectFit: "contain" }}
            />
          ) : (
            <span className="auth-layout-logo">
              <Leaf size={22} strokeWidth={2.25} />
            </span>
          )}
          <h2 style={{ margin: 0, fontSize: "1.125rem" }}>SafeCarbon</h2>
        </div>
        <div style={{ fontSize: "0.8125rem", opacity: 0.7, marginBottom: "0.5rem" }}>Powered by</div>
        <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, marginBottom: "1rem" }}>Safe Trace</h3>
        <p>Plataforma de MRV e tokenização de créditos de carbono — da produção em campo ao token verificável.</p>
        <div className="auth-layout-features">
          {FEATURES.map((f) => (
            <div key={f.label} className="auth-layout-feature">
              <f.icon size={17} />
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="auth-layout-form">
        <div className="auth-layout-form-inner">
          <div className="app-logo auth-layout-form-logo" style={{ justifyContent: "center", flexDirection: "column", gap: "0.75rem" }}>
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt="SafeCarbon"
                style={{ maxWidth: "100px", maxHeight: "100px", objectFit: "contain", margin: "0 auto" }}
              />
            ) : (
              <span className="app-logo-mark">
                <Leaf size={48} strokeWidth={2.25} />
              </span>
            )}
            <strong style={{ fontSize: "1.375rem", textAlign: "center" }}>SafeCarbon</strong>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
