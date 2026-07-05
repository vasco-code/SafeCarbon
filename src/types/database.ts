// Placeholder de tipos do schema Supabase.
//
// Depois que a migration inicial (supabase/migrations/20260705000001_init_schema.sql)
// for aplicada num projeto Supabase real, regenerar este arquivo com:
//
//   supabase gen types typescript --project-id <ref> > src/types/database.ts
//
// Até lá, mantemos apenas os tipos mínimos usados pelo scaffold para não travar o build.

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          org_type:
            | "platform_operator"
            | "project_developer"
            | "proponent"
            | "verifier"
            | "buyer";
          tax_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
      };
      carbon_projects: {
        Row: {
          id: string;
          name: string;
          proponent_org_id: string;
          developer_org_id: string;
          methodology_version_id: string | null;
          registry_standard: "verra" | "gold_standard" | "mbre" | "none_yet";
          location_text: string | null;
          status: "design" | "validation" | "active" | "suspended" | "closed";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["carbon_projects"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["carbon_projects"]["Row"]>;
      };
    };
  };
}
