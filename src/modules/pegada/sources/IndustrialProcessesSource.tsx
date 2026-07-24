import { DirectGasEmissionSource } from "./DirectGasEmissionSource";
import type { SourceProps } from "./common";

export function IndustrialProcessesSource(props: SourceProps) {
  return (
    <DirectGasEmissionSource
      {...props}
      category="industrial_processes"
      title="Processos industriais"
      description="Emissões de processos de manufatura (ex.: fundição, produção de cimento, cal, amônia) — massa do gás relatada diretamente."
      sourceRefLabel="Registro da fonte"
      sourceRefPlaceholder="ex.: BR-001"
      descriptionFieldLabel="Descrição do processo industrial"
    />
  );
}
