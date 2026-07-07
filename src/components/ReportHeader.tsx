import { Leaf } from "lucide-react";

export function ReportHeader({
  platformLogoUrl,
  developerLogoUrl,
  developerName,
  proponentLogoUrl,
  proponentName,
}: {
  platformLogoUrl?: string | null;
  developerLogoUrl?: string | null;
  developerName?: string;
  proponentLogoUrl?: string | null;
  proponentName?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "2rem",
        alignItems: "center",
        padding: "1.5rem",
        borderBottom: "1px solid var(--sc-border)",
        marginBottom: "1.5rem",
        justifyContent: "center",
      }}
    >
      {/* Safe Carbon */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {platformLogoUrl ? (
          <img
            src={platformLogoUrl}
            alt="SafeCarbon"
            style={{ maxWidth: "40px", maxHeight: "40px", objectFit: "contain" }}
          />
        ) : (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", backgroundColor: "var(--sc-primary)", color: "white", borderRadius: "4px" }}>
            <Leaf size={20} strokeWidth={2.25} />
          </span>
        )}
        <span style={{ fontSize: "0.9375rem", fontWeight: 600 }}>SafeCarbon</span>
      </div>

      {/* Developer */}
      {(developerLogoUrl || developerName) && (
        <>
          <div style={{ color: "var(--sc-border)" }}>|</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {developerLogoUrl && (
              <img
                src={developerLogoUrl}
                alt={developerName}
                style={{ maxWidth: "40px", maxHeight: "40px", objectFit: "contain" }}
              />
            )}
            <span style={{ fontSize: "0.8125rem", color: "var(--sc-muted)" }}>{developerName}</span>
          </div>
        </>
      )}

      {/* Proponent */}
      {(proponentLogoUrl || proponentName) && (
        <>
          <div style={{ color: "var(--sc-border)" }}>|</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {proponentLogoUrl && (
              <img
                src={proponentLogoUrl}
                alt={proponentName}
                style={{ maxWidth: "40px", maxHeight: "40px", objectFit: "contain" }}
              />
            )}
            <span style={{ fontSize: "0.8125rem", color: "var(--sc-muted)" }}>{proponentName}</span>
          </div>
        </>
      )}
    </div>
  );
}
