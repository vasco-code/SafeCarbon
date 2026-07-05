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
          created_by: string | null;
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
      project_roles: {
        Row: {
          project_id: string;
          org_id: string;
          role: "proponent" | "developer" | "verifier" | "admin";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["project_roles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["project_roles"]["Row"]>;
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
      emission_factors: {
        Row: {
          id: string;
          category: string;
          value: number;
          unit: string | null;
          gwp_version: string | null;
          source_citation: string | null;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["emission_factors"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["emission_factors"]["Row"]>;
        Relationships: [];
      };
      emission_inventory_entries: {
        Row: {
          id: string;
          project_id: string;
          period_year: number;
          source_type: string;
          activity_quantity: number;
          activity_unit: string;
          emission_factor_ids: string[];
          calculated_tco2e: number;
          justification: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["emission_inventory_entries"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["emission_inventory_entries"]["Row"]>;
        Relationships: [];
      };
      leakage_assessments: {
        Row: {
          id: string;
          project_id: string;
          period_year: number;
          category:
            | "rebound_effect"
            | "technology_substitution"
            | "supply_chain"
            | "geographic_displacement"
            | "other";
          conclusion: string;
          justification: string;
          leakage_factor_pct: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["leakage_assessments"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["leakage_assessments"]["Row"]>;
        Relationships: [];
      };
      credit_calculation_cycles: {
        Row: {
          id: string;
          project_id: string;
          period_year: number;
          methodology_version_id: string;
          status:
            | "draft"
            | "calculated"
            | "in_verification"
            | "verified"
            | "approved"
            | "issued"
            | "rejected";
          calculated_at: string | null;
          calculated_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["credit_calculation_cycles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["credit_calculation_cycles"]["Row"]>;
        Relationships: [];
      };
      credit_calculation_steps: {
        Row: {
          id: string;
          cycle_id: string;
          step_number: number;
          step_key: string;
          input_values: Record<string, unknown>;
          output_value: number;
          unit: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["credit_calculation_steps"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["credit_calculation_steps"]["Row"]>;
        Relationships: [];
      };
      credit_batches: {
        Row: {
          id: string;
          cycle_id: string;
          tco2e_amount: number;
          commercialization_factor: number | null;
          eligibility_factor: number;
          status: "pending_verification" | "verified" | "approved" | "issued" | "retired";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["credit_batches"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["credit_batches"]["Row"]>;
        Relationships: [];
      };
      dcp_documents: {
        Row: {
          id: string;
          project_id: string;
          version_number: number;
          status: "draft" | "published";
          exported_docx_url: string | null;
          exported_pdf_url: string | null;
          generated_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["dcp_documents"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["dcp_documents"]["Row"]>;
        Relationships: [];
      };
      dcp_sections: {
        Row: {
          id: string;
          dcp_document_id: string;
          section_key: string;
          content: { texto: string };
          is_generated: boolean;
          source_reference: Record<string, unknown> | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["dcp_sections"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["dcp_sections"]["Row"]>;
        Relationships: [];
      };
      resumo_calculo_documents: {
        Row: {
          id: string;
          cycle_id: string;
          narrative_text: string;
          exported_docx_url: string | null;
          exported_pdf_url: string | null;
          generated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["resumo_calculo_documents"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["resumo_calculo_documents"]["Row"]>;
        Relationships: [];
      };
      verification_cycles: {
        Row: {
          id: string;
          project_id: string;
          period_start_year: number;
          period_end_year: number;
          vvb_org_id: string | null;
          status: "scheduled" | "in_progress" | "approved" | "rejected";
          verification_statement_url: string | null;
          findings: { texto: string } | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["verification_cycles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["verification_cycles"]["Row"]>;
        Relationships: [];
      };
      monitoring_reports: {
        Row: {
          id: string;
          project_id: string;
          period_year: number;
          exported_docx_url: string | null;
          exported_pdf_url: string | null;
          generated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["monitoring_reports"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["monitoring_reports"]["Row"]>;
        Relationships: [];
      };
      credit_issuances: {
        Row: {
          id: string;
          credit_batch_id: string;
          verification_cycle_id: string | null;
          issued_amount_tco2e: number;
          serial_number_start: string | null;
          serial_number_end: string | null;
          issued_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["credit_issuances"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["credit_issuances"]["Row"]>;
        Relationships: [];
      };
      blockchain_tokens: {
        Row: {
          id: string;
          credit_issuance_id: string;
          token_id: string;
          tx_hash: string;
          ledger_ref: string | null;
          status: "active" | "transferred" | "retired";
          owner_reference: string | null;
          retired_at: string | null;
          retired_reason: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["blockchain_tokens"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["blockchain_tokens"]["Row"]>;
        Relationships: [];
      };
      project_sites: {
        Row: {
          id: string;
          project_id: string;
          label: string;
          latitude: number | null;
          longitude: number | null;
          safegistrace_analysis_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["project_sites"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["project_sites"]["Row"]>;
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
    Functions: {
      get_org_members_with_email: {
        Args: { p_org_id: string };
        Returns: {
          user_id: string;
          email: string;
          member_role: string;
          created_at: string;
        }[];
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      has_project_role: {
        Args: { p_project_id: string; p_roles: string[] };
        Returns: boolean;
      };
    };
  };
}
