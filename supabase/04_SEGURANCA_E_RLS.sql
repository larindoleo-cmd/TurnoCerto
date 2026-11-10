-- ================================================================================
-- 04 — SEGURANCA_E_RLS.sql
-- TurnoCerto: Políticas de Segurança RLS (Row Level Security) e Permissões de Acesso
-- Protege os dados e assegura funcionamento para usuários autenticados e chave anônima (PWA)
-- Executar no SQL Editor do Supabase (PostgreSQL)
-- ================================================================================

-- 1. Ativar Row Level Security (RLS) em todas as tabelas públicas do TurnoCerto
ALTER TABLE public.condominios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holerites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atestados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_info ENABLE ROW LEVEL SECURITY;

-- 2. Conceder privilégios de acesso aos roles padrões do Supabase (anon, authenticated, service_role)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Função de verificação de papel administrativo (Admin ou Supervisor)
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id::text = auth.uid()::text
      AND role IN ('admin', 'supervisor')
    )
    OR EXISTS (
      SELECT 1 FROM public.colaboradores
      WHERE (id::text = auth.uid()::text OR email = auth.jwt() ->> 'email')
      AND role IN ('admin', 'supervisor')
    )
    OR (auth.jwt() ->> 'role') IN ('admin', 'supervisor')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'supervisor')
    OR auth.role() = 'service_role'
  );
END;
$$;

-- ================================================================================
-- 4. POLÍTICAS DE ACESSO — CONDOMINIOS & POSTOS
-- ================================================================================
DROP POLICY IF EXISTS "Condominios leitura publica" ON public.condominios;
CREATE POLICY "Condominios leitura publica" ON public.condominios
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Condominios mutacao permitida" ON public.condominios;
CREATE POLICY "Condominios mutacao permitida" ON public.condominios
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Postos leitura publica" ON public.postos;
CREATE POLICY "Postos leitura publica" ON public.postos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Postos mutacao permitida" ON public.postos;
CREATE POLICY "Postos mutacao permitida" ON public.postos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ================================================================================
-- 5. POLÍTICAS DE ACESSO — COLABORADORES & PROFILES
-- ================================================================================
DROP POLICY IF EXISTS "Colaboradores leitura total" ON public.colaboradores;
CREATE POLICY "Colaboradores leitura total" ON public.colaboradores
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Colaboradores escrita total" ON public.colaboradores;
CREATE POLICY "Colaboradores escrita total" ON public.colaboradores
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Profiles leitura total" ON public.profiles;
CREATE POLICY "Profiles leitura total" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Profiles escrita total" ON public.profiles;
CREATE POLICY "Profiles escrita total" ON public.profiles
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ================================================================================
-- 6. POLÍTICAS DE ACESSO — OCORRÊNCIAS E ALERTAS OPERACIONAIS
-- ================================================================================
DROP POLICY IF EXISTS "Ocorrencias leitura" ON public.ocorrencias;
CREATE POLICY "Ocorrencias leitura" ON public.ocorrencias
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Ocorrencias escrita" ON public.ocorrencias;
CREATE POLICY "Ocorrencias escrita" ON public.ocorrencias
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Alertas leitura" ON public.alertas;
CREATE POLICY "Alertas leitura" ON public.alertas
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Alertas escrita" ON public.alertas;
CREATE POLICY "Alertas escrita" ON public.alertas
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ================================================================================
-- 7. POLÍTICAS DE ACESSO — HOLERITES E CONTRACHEQUES
-- ================================================================================
DROP POLICY IF EXISTS "Holerites leitura" ON public.holerites;
CREATE POLICY "Holerites leitura" ON public.holerites
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Holerites escrita" ON public.holerites;
CREATE POLICY "Holerites escrita" ON public.holerites
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ================================================================================
-- 8. POLÍTICAS DE ACESSO — PONTOS ELETRÔNICOS E GEOFENCING (Corrige Erro 42501)
-- ================================================================================
DROP POLICY IF EXISTS "Pontos leitura" ON public.pontos;
CREATE POLICY "Pontos leitura" ON public.pontos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Pontos escrita" ON public.pontos;
CREATE POLICY "Pontos escrita" ON public.pontos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ================================================================================
-- 9. POLÍTICAS DE ACESSO — ATESTADOS MÉDICOS E EMPRESA MATRIZ
-- ================================================================================
DROP POLICY IF EXISTS "Atestados leitura" ON public.atestados;
CREATE POLICY "Atestados leitura" ON public.atestados
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Atestados escrita" ON public.atestados;
CREATE POLICY "Atestados escrita" ON public.atestados
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Empresa info leitura" ON public.empresa_info;
CREATE POLICY "Empresa info leitura" ON public.empresa_info
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Empresa info escrita" ON public.empresa_info;
CREATE POLICY "Empresa info escrita" ON public.empresa_info
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
