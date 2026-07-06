import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { UploadCloud } from "lucide-react";

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  hint?: string;
}

export function FileDropzone({ onFiles, accept, multiple, disabled, label, hint }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    onFiles(Array.from(fileList));
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!disabled) setIsDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  return (
    <div
      className={`file-dropzone${isDragging ? " dragging" : ""}${disabled ? " disabled" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      <UploadCloud size={26} />
      <p className="file-dropzone-title">{label ?? "Arraste arquivos aqui ou clique para escolher"}</p>
      {hint && <p className="file-dropzone-hint">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
        style={{ display: "none" }}
      />
    </div>
  );
}
