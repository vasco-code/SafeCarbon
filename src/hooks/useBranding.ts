import { useEffect, useLayoutEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface BrandingConfig {
  subdomain: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_oklch: string;
  accent_oklch: string;
  success_oklch: string;
  danger_oklch: string;
  warning_oklch: string;
}

// Espelha o registro "default" de branding_configs — é o que já roda em
// produção, então usá-lo como fallback evita o flash de outra paleta
// enquanto a query ao Supabase não resolve.
const DEFAULT_BRANDING: BrandingConfig = {
  subdomain: "default",
  logo_url: "/logos/safecarbon-logo.png",
  favicon_url: "/logos/safecarbon-logo.png",
  primary_oklch: "oklch(0.444 0.100 145.0)",
  accent_oklch: "oklch(0.820 0.360 273.0)",
  success_oklch: "oklch(0.686 0.200 140.2)",
  danger_oklch: "oklch(0.560 0.240 43.0)",
  warning_oklch: "oklch(0.680 0.150 70)",
};

function getSubdomainFromHostname(): string {
  const hostname = window.location.hostname;
  if (hostname === "localhost") return "default";
  const parts = hostname.split(".");
  return parts[0];
}

function brandingCacheKey(subdomain: string): string {
  return `sc-branding:${subdomain}`;
}

function readCachedBranding(subdomain: string): BrandingConfig | null {
  try {
    const raw = localStorage.getItem(brandingCacheKey(subdomain));
    return raw ? (JSON.parse(raw) as BrandingConfig) : null;
  } catch {
    return null;
  }
}

function writeCachedBranding(subdomain: string, branding: BrandingConfig) {
  try {
    localStorage.setItem(brandingCacheKey(subdomain), JSON.stringify(branding));
  } catch {
    // localStorage indisponível (modo privado, quota) — segue sem cache
  }
}

export function useBranding() {
  const subdomain = getSubdomainFromHostname();
  const [branding, setBranding] = useState<BrandingConfig>(
    () => readCachedBranding(subdomain) ?? DEFAULT_BRANDING,
  );
  const [loading, setLoading] = useState(true);

  // useLayoutEffect (não useEffect) para aplicar antes do primeiro paint —
  // elimina o flash para tenants já cacheados de uma visita anterior.
  useLayoutEffect(() => {
    applyBrandingVars(branding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadBranding() {
      const { data, error } = await supabase
        .from("branding_configs")
        .select("*")
        .eq("subdomain", subdomain)
        .single();

      if (data) {
        const loaded = data as BrandingConfig;
        setBranding(loaded);
        applyBrandingVars(loaded);
        writeCachedBranding(subdomain, loaded);
      } else {
        console.log("No branding config found for subdomain:", subdomain, error);
        applyBrandingVars(DEFAULT_BRANDING);
      }
      setLoading(false);
    }

    loadBranding();
  }, [subdomain]);

  return { branding, loading };
}

function applyBrandingVars(branding: BrandingConfig) {
  const root = document.documentElement;
  root.style.setProperty("--sc-primary", branding.primary_oklch);
  root.style.setProperty("--sc-accent", branding.accent_oklch);
  root.style.setProperty("--sc-success", branding.success_oklch);
  root.style.setProperty("--sc-danger", branding.danger_oklch);
  root.style.setProperty("--sc-warning", branding.warning_oklch);

  if (branding.favicon_url) {
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (link) link.href = branding.favicon_url;
  }
}
