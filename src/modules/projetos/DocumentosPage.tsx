import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FolderOpen, Download, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectRole } from "@/hooks/useProjectRole";
import { FileDropzone } from "@/components/FileDropzone";

type DocType = "dcp" | "resumo_calculo" | "auditoria_aprovacao" | "plano_melhorias" | "checklist" | "foto" | "outro";

interface ProjectDocument {
  id: string;
  doc_type: DocType;
  title: string;
  storage_path: string;
  uploaded_by_org_id: string | null;
  created_at: string;
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  dcp: "DCP",
  resumo_calculo: "Resumo de Cálculo",
  auditoria_aprovacao: "Aprovação de Auditoria",
  plano_melhorias: "Plano de Melhorias",
  checklist: "Checklist",
  foto: "Foto",
  outro: "Outro",
};

const DOC_TYPE_ORDER: DocType[] = ["dcp", "resumo_calculo", "checklist", "auditoria_aprovacao", "plano_melhorias", "foto", "outro"];

export function DocumentosPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { orgId } = useProjectRole(projectId);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<DocType>("dcp");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDocuments() {
    if (!projectId) return;
    const { data } = await supabase
      .from("project_documents")
      .select("id, doc_type, title, storage_path, uploaded_by_org_id, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setDocuments((data as ProjectDocument[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  async function handleFiles(files: File[]) {
    if (!projectId || files.length === 0) return;
    setUploading(true);
    setError(null);

    for (const file of files) {
      const path = `${projectId}/${docType}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("project-documents").upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        continue;
      }
      const { error: insertError } = await supabase.from("project_documents").insert({
        project_id: projectId,
        doc_type: docType,
        title: title.trim() || file.name,
        file_url: path,
        storage_path: path,
        uploaded_by: user?.id,
        uploaded_by_org_id: orgId,
      });
      if (insertError) setError(insertError.message);
    }

    setUploading(false);
    setTitle("");
    loadDocuments();
  }

  async function handleDownload(doc: ProjectDocument) {
    const { data, error: signError } = await supabase.storage
      .from("project-documents")
      .createSignedUrl(doc.storage_path, 3600);
    if (signError || !data) {
      setError(signError?.message ?? "Não foi possível gerar o link do arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(doc: ProjectDocument) {
    if (!confirm(`Excluir "${doc.title}"?`)) return;
    await supabase.storage.from("project-documents").remove([doc.storage_path]);
    const { error: deleteError } = await supabase.from("project_documents").delete().eq("id", doc.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      loadDocuments();
    }
  }

  const grouped = DOC_TYPE_ORDER.map((type) => ({
    type,
    docs: documents.filter((d) => d.doc_type === type),
  })).filter((g) => g.docs.length > 0 || g.type === docType);

  return (
    <section>
      <h2 className="module-heading">
        <FolderOpen size={20} /> Documentos
      </h2>
      <p>Repositório central do projeto — DCP, resumo de cálculo, documentos de auditoria, checklist e outros arquivos.</p>

      <div className="action-bar">
        <div className="action-bar-field">
          <label htmlFor="doc-type">Tipo</label>
          <select id="doc-type" value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
            {DOC_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {DOC_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="action-bar-field">
          <label htmlFor="doc-title">Título (opcional)</label>
          <input id="doc-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>

      <FileDropzone
        multiple
        onFiles={handleFiles}
        disabled={uploading}
        label={uploading ? "Enviando..." : "Arraste arquivos aqui ou clique para escolher"}
        hint="PDF, DOCX, imagens — qualquer formato."
      />

      {error && <p className="auth-error">{error}</p>}

      {loading && <p>Carregando...</p>}

      {!loading &&
        grouped.map((group) => (
          <div key={group.type} style={{ marginTop: "1.5rem" }}>
            <h3>{DOC_TYPE_LABELS[group.type]}</h3>
            {group.docs.length === 0 ? (
              <div className="empty-state">
                <p>Nenhum documento deste tipo ainda.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Enviado em</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {group.docs.map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.title}</td>
                      <td>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="row-actions">
                        <button type="button" onClick={() => handleDownload(doc)}>
                          <Download size={14} /> Baixar
                        </button>
                        <button type="button" className="btn-icon-danger" onClick={() => handleDelete(doc)}>
                          <Trash2 size={14} /> Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
    </section>
  );
}
