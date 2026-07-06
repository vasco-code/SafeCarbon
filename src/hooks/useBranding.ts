import { useEffect, useState } from "react";
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

export function useBranding() {
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBranding() {
      const subdomain = getSubdomainFromHostname();
      const { data, error } = await supabase
        .from("branding_configs")
        .select("*")
        .eq("subdomain", subdomain)
        .single();

      if (data) {
        console.log("Branding loaded:", data);
        setBranding(data as BrandingConfig);
        applyBrandingVars(data as BrandingConfig);
      } else {
        console.log("No branding config found for subdomain:", subdomain, error);
        applyBrandingVars(DEFAULT_BRANDING);
      }
      setLoading(false);
    }

    loadBranding();
  }, []);

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
