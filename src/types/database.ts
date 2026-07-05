// Placeholder de tipos do schema Supabase.
//
// Depois que a migration inicial (supabase/migrations/20260705000001_init_schema.sql)
// for aplicada num projeto Supabase real, regenerar este arquivo com:
//
//   supabase gen types typescript --project-id <ref> > src/types/database.ts
//
// Até lá, mantemos apenas os tipos mínimos usados pelo scaffold para não travar o build.
// `Relationships: []` é exigido pela constraint genérica GenericTable do postgrest-js — sem
// isso, o TypeScript não resolve os overloads de insert/update e cai silenciosamente em `never`.

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
        Relationships: [];
      };
      org_members: {
        Row: {
          org_id: string;
          user_id: string;
          member_role: "owner" | "manager" | "contributor" | "viewer";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["org_members"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["org_members"]["Row"]>;
        Relationships: [];
      };
      methodologies: {
        Row: {
          id: string;
          name: string;
          sector: string;
          ipcc_category: string | null;
          owner_org_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["methodologies"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["methodologies"]["Row"]>;
        Relationships: [];
      };
      methodology_versions: {
        Row: {
          id: string;
          methodology_id: string;
          version_label: string;
          status: "draft" | "published" | "deprecated";
          supersedes_version_id: string | null;
          sections: Record<string, { titulo: string; corpo: string }>;
          published_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["methodology_versions"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["methodology_versions"]["Row"]>;
        Relationships: [];
      };
      methodology_parameters: {
        Row: {
          id: string;
          methodology_version_id: string;
          param_key: string;
          value: number;
          unit: string | null;
          source_citation: string | null;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["methodology_parameters"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["methodology_parameters"]["Row"]>;
        Relationships: [];
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
        Relationships: [];
      };
      production_records: {
        Row: {
          id: string;
          project_id: string;
          period_year: number;
          period_month: number | null;
          quantity_kg: number;
          source: "erp_integration" | "manual_entry";
          evidence_doc_url: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["production_records"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["production_records"]["Row"]>;
        Relationships: [];
      };
      commercialization_documents: {
        Row: {
          id: string;
          project_id: string;
          nfe_key: string;
          nfe_number: string | null;
          issue_date: string;
          buyer_tax_id: string | null;
          quantity_kg: number;
          raw_file_url: string | null;
          linked_production_period_year: number | null;
          already_credited: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["commercialization_documents"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["commercialization_documents"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      production_period_summary: {
        Row: {
          project_id: string;
          period_year: number;
          total_produced_kg: number;
          total_commercialized_kg: number;
          commercialization_factor: number | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}
