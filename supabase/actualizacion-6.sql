-- Actualización 6: IVA opcional (12% o 5%) sobre honorarios en precios y expedientes de B&C.
-- Pegar completo en Supabase > SQL Editor > New query > Run (se puede correr más de una vez).
alter table tarifas add column if not exists iva_pct numeric default 0;
alter table expedientes add column if not exists iva_pct numeric default 0;
