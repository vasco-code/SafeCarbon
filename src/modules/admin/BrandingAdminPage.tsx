import { useEffect, useState, type FormEvent } from "react";
import { Palette } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BrandingConfig } from "@/hooks/useBranding";

const DEFAULT_BRANDING: BrandingConfig = {
  subdomain: "default",
  logo_url: null,
  favicon_url: null,
  primary_oklch: "oklch(0.440 0.150 269)",
  accent_oklch: "oklch(0.700 0.130 195)",
  success_oklch: "oklch(0.500 0.140 145)",
  danger_oklch: "oklch(0.520 0.180 25)",
  warning_oklch: "oklch(0.680 0.150 70)",
};

function getSubdomainFromHostname(): string {
  const hostname = window.location.hostname;
  if (hostname === "localhost") return "default";
  const parts = hostname.split(".");
  return parts[0];
}

function parseOklch(oklchString: string): { l: number; c: number; h: number } | null {
  const match = oklchString.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  if (!match) return null;
  return { l: parseFloat(match[1]), c: parseFloat(match[2]), h: parseFloat(match[3]) };
}

function formatOklch(l: number, c: number, h: number): string {
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}

export function BrandingAdminPage() {
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [subdomains, setSubdomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currentSubdomain = getSubdomainFromHostname();
  const [selectedSubdomain, setSelectedSubdomain] = useState(currentSubdomain);

  useEffect(() => {
    loadBranding();
  }, [selectedSubdomain]);

  async function loadBranding() {
    setLoading(true);
    const { data } = await supabase
      .from("branding_configs")
      .select("*")
      .eq("subdomain", selectedSubdomain)
      .single();

    if (data) {
      setBranding(data as BrandingConfig);
    } else {
      setBranding({ ...DEFAULT_BRANDING, subdomain: selectedSubdomain });
    }

    const { data: all } = await supabase
      .from("branding_configs")
      .select("subdomain")
      .order("subdomain");

    const domains = new Set(all?.map((d: any) => d.subdomain) ?? []);
    domains.add("default");
    setSubdomains(Array.from(domains).sort());

    setLoading(false);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("branding_configs")
      .upsert({
        subdomain: branding.subdomain,
        logo_url: branding.logo_url,
        favicon_url: branding.favicon_url,
        primary_oklch: branding.primary_oklch,
        accent_oklch: branding.accent_oklch,
        success_oklch: branding.success_oklch,
        danger_oklch: branding.danger_oklch,
        warning_oklch: branding.warning_oklch,
        updated_at: new Date().toISOString(),
      })
      .eq("subdomain", branding.subdomain);

    setSaving(false);
    if (error) {
      setMessage(`Erro: ${error.message}`);
    } else {
      setMessage("Configuração salva com sucesso!");
      setTimeout(() => setMessage(null), 3000);
    }
  }

  function handleOklchChange(field: string, value: string) {
    const parsed = parseOklch(value);
    if (parsed) {
      setBranding((prev) => ({ ...prev, [field]: value }));
    }
  }

  function handleColorSlider(field: string, subfield: "l" | "c" | "h", value: string) {
    const num = parseFloat(value);
    const parsed = parseOklch(branding[field as keyof BrandingConfig] as string);
    if (parsed) {
      const updated = { ...parsed, [subfield]: num };
      setBranding((prev) => ({
        ...prev,
        [field]: formatOklch(updated.l, updated.c, updated.h),
      }));
    }
  }

  if (loading) return <p>Carregando...</p>;

  return (
    <section>
      <h1 className="module-heading">
        <Palette size={22} /> Configuração de Branding
      </h1>
      <p>Customizar cores e logos da plataforma por subdomínio (admin apenas).</p>

      <div style={{ marginBottom: "1.5rem" }}>
        <label htmlFor="subdomain-select">Subdomínio</label>
        <select
          id="subdomain-select"
          value={selectedSubdomain}
          onChange={(e) => setSelectedSubdomain(e.target.value)}
        >
          {subdomains.map((sub) => (
            <option key={sub} value={sub}>
              {sub === "default" ? "Default (global)" : sub}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSave}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          {/* Coluna 1: Cores */}
          <div>
            <h2 style={{ fontSize: "1.125rem", marginTop: 0 }}>Paleta de Cores</h2>

            {(
              [
                { field: "primary_oklch", label: "Primária (marca)" },
                { field: "accent_oklch", label: "Acento" },
                { field: "success_oklch", label: "Sucesso" },
                { field: "danger_oklch", label: "Perigo" },
                { field: "warning_oklch", label: "Aviso" },
              ] as const
            ).map(({ field, label }) => {
              const parsed = parseOklch(branding[field] as string);
              return (
                <div key={field} style={{ marginBottom: "1rem" }}>
                  <label>{label}</label>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        backgroundColor: branding[field],
                        borderRadius: "4px",
                        border: "1px solid var(--sc-border)",
                      }}
                    />
                    <input
                      type="text"
                      value={branding[field]}
                      onChange={(e) => handleOklchChange(field, e.target.value)}
                      placeholder="oklch(0.44 0.15 269)"
                      style={{ flex: 1 }}
                    />
                  </div>
                  {parsed && (
                    <div style={{ fontSize: "0.8125rem", color: "var(--sc-muted)" }}>
                      <div>
                        L:{" "}
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={parsed.l}
                          onChange={(e) =>
                            handleColorSlider(field, "l", e.target.value)
                          }
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div>
                        C:{" "}
                        <input
                          type="range"
                          min="0"
                          max="0.4"
                          step="0.01"
                          value={parsed.c}
                          onChange={(e) =>
                            handleColorSlider(field, "c", e.target.value)
                          }
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div>
                        H:{" "}
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="1"
                          value={parsed.h}
                          onChange={(e) =>
                            handleColorSlider(field, "h", e.target.value)
                          }
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Coluna 2: Logos + Preview */}
          <div>
            <h2 style={{ fontSize: "1.125rem", marginTop: 0 }}>Logos & Assets</h2>

            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="logo-url">Logo Principal (URL)</label>
              <input
                id="logo-url"
                type="text"
                value={branding.logo_url ?? ""}
                onChange={(e) =>
                  setBranding((prev) => ({ ...prev, logo_url: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="favicon-url">Favicon (URL)</label>
              <input
                id="favicon-url"
                type="text"
                value={branding.favicon_url ?? ""}
                onChange={(e) =>
                  setBranding((prev) => ({ ...prev, favicon_url: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            <div style={{ border: "1px solid var(--sc-border)", borderRadius: "8px", padding: "1rem" }}>
              <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9375rem" }}>Preview</h3>
              <div
                style={{
                  backgroundColor: "var(--sc-surface)",
                  padding: "1rem",
                  borderRadius: "4px",
                  display: "flex",
                  gap: "1rem",
                  alignItems: "flex-start",
                }}
              >
                {branding.logo_url && (
                  <img
                    src={branding.logo_url}
                    alt="Logo"
                    style={{ maxWidth: "80px", maxHeight: "80px", objectFit: "contain" }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <button style={{ backgroundColor: branding.primary_oklch, color: "white" }} disabled>
                    Botão Primário
                  </button>
                  <div
                    style={{
                      marginTop: "0.5rem",
                      display: "flex",
                      gap: "0.25rem",
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: branding.success_oklch,
                        color: "white",
                        padding: "0.15rem 0.55rem",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      Sucesso
                    </span>
                    <span
                      style={{
                        backgroundColor: branding.danger_oklch,
                        color: "white",
                        padding: "0.15rem 0.55rem",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      Erro
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <p
            style={{
              padding: "0.75rem",
              borderRadius: "4px",
              backgroundColor: message.startsWith("Erro") ? "var(--sc-danger-bg)" : "var(--sc-success-bg)",
              color: message.startsWith("Erro") ? "var(--sc-danger)" : "var(--sc-success)",
              marginBottom: "1rem",
            }}
          >
            {message}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Salvando..." : "Aplicar Configuração"}
        </button>
      </form>
    </section>
  );
}
