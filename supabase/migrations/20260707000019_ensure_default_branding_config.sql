-- Garante que sempre haja um registro de branding para subdomain "default"
INSERT INTO branding_configs (
  subdomain,
  logo_url,
  favicon_url,
  primary_oklch,
  accent_oklch,
  success_oklch,
  danger_oklch,
  warning_oklch,
  updated_at
)
VALUES (
  'default',
  '/logos/safecarbon-logo.png',
  '/logos/safecarbon-logo.png',
  'oklch(0.440 0.150 269)',
  'oklch(0.700 0.130 195)',
  'oklch(0.500 0.140 145)',
  'oklch(0.520 0.180 25)',
  'oklch(0.680 0.150 70)',
  NOW()
)
ON CONFLICT (subdomain) DO NOTHING;
