-- ============================================================================
-- Correções do vintage 2025 do Premix - Fator P — parte 3/3.
-- Rodar SÓ DEPOIS de recalcular o ciclo 2025 pela tela (motor PMX-EM v2.0).
-- O recálculo devolve o ciclo para 'calculated' e o lote para
-- 'pending_verification'; a verificação independente (RK-VER-2026-001 v02) já
-- foi concluída para exatamente 11.835,9 tCO2e, então o lote só volta a
-- 'approved' se o resultado do motor bater com essa quantidade (tolerância de
-- 0,1 tCO2e). Se não bater, esta migration não altera nada. A emissão
-- continua bloqueada por issuance_hold.
-- ============================================================================

update credit_batches
set status = 'approved'
where cycle_id = '33c7c6e9-120c-43be-82bc-00f55b3c02b7'
  and status = 'pending_verification'
  and abs(tco2e_amount - 11835.9) <= 0.1
  and exists (
    select 1 from credit_calculation_cycles c
    where c.id = credit_batches.cycle_id and c.status = 'calculated'
  );

update credit_calculation_cycles
set status = 'verified'
where id = '33c7c6e9-120c-43be-82bc-00f55b3c02b7'
  and status = 'calculated'
  and exists (
    select 1 from credit_batches b
    where b.cycle_id = credit_calculation_cycles.id and b.status = 'approved'
  );
