import { DirectGasEmissionSource } from "./DirectGasEmissionSource";
import type { SourceProps } from "./common";

export function AgricultureSource(props: SourceProps) {
  return (
    <DirectGasEmissionSource
      {...props}
      category="agriculture"
      title="Atividades de agricultura"
      description="Fermentação entérica, manejo de dejetos, solos agrícolas — massa do gás relatada diretamente."
      sourceRefLabel="Registro da fonte"
      sourceRefPlaceholder="ex.: BR-001"
      descriptionFieldLabel="Descrição da atividade agrícola"
    />
  );
}
