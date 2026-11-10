-- ================================================================================
-- TurnoCerto: Migração 05 - Segurança RLS (Row Level Security) e Supabase Storage
-- Arquivo: supabase/migrations/20261108100005_seguranca_rls_storage.sql
-- Tipo: DCL/DDL (Políticas de Acesso a Tabelas e Mídias)
-- ================================================================================

-- 1. HABILITA RLS EM TODAS AS TABELAS
ALTER TABLE public.condominios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holerites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atestados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_info ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICAS DE ACESSO PARA TABELAS OPERACIONAIS
-- CONDOMINIOS
DROP POLICY IF EXISTS "policy_condominios_select" ON public.condominios;
CREATE POLICY "policy_condominios_select" ON public.condominios
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "policy_condominios_write" ON public.condominios;
CREATE POLICY "policy_condominios_write" ON public.condominios
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- COLABORADORES
DROP POLICY IF EXISTS "policy_colaboradores_select" ON public.colaboradores;
CREATE POLICY "policy_colaboradores_select" ON public.colaboradores
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "policy_colaboradores_write" ON public.colaboradores;
CREATE POLICY "policy_colaboradores_write" ON public.colaboradores
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- PROFILES
DROP POLICY IF EXISTS "policy_profiles_select" ON public.profiles;
CREATE POLICY "policy_profiles_select" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "policy_profiles_write" ON public.profiles;
CREATE POLICY "policy_profiles_write" ON public.profiles
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- POSTOS
DROP POLICY IF EXISTS "policy_postos_select" ON public.postos;
CREATE POLICY "policy_postos_select" ON public.postos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "policy_postos_write" ON public.postos;
CREATE POLICY "policy_postos_write" ON public.postos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- OCORRENCIAS
DROP POLICY IF EXISTS "policy_ocorrencias_select" ON public.ocorrencias;
CREATE POLICY "policy_ocorrencias_select" ON public.ocorrencias
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "policy_ocorrencias_write" ON public.ocorrencias;
CREATE POLICY "policy_ocorrencias_write" ON public.ocorrencias
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ALERTAS
DROP POLICY IF EXISTS "policy_alertas_select" ON public.alertas;
CREATE POLICY "policy_alertas_select" ON public.alertas
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "policy_alertas_write" ON public.alertas;
CREATE POLICY "policy_alertas_write" ON public.alertas
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- PONTOS (Libera inserção mobile de batidas e leituras)
DROP POLICY IF EXISTS "policy_pontos_select" ON public.pontos;
CREATE POLICY "policy_pontos_select" ON public.pontos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "policy_pontos_write" ON public.pontos;
CREATE POLICY "policy_pontos_write" ON public.pontos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- HOLERITES
DROP POLICY IF EXISTS "policy_holerites_select" ON public.holerites;
CREATE POLICY "policy_holerites_select" ON public.holerites
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "policy_holerites_write" ON public.holerites;
CREATE POLICY "policy_holerites_write" ON public.holerites
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ATESTADOS
DROP POLICY IF EXISTS "policy_atestados_select" ON public.atestados;
CREATE POLICY "policy_atestados_select" ON public.atestados
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "policy_atestados_write" ON public.atestados;
CREATE POLICY "policy_atestados_write" ON public.atestados
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- EMPRESA_INFO
DROP POLICY IF EXISTS "policy_empresa_info_select" ON public.empresa_info;
CREATE POLICY "policy_empresa_info_select" ON public.empresa_info
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "policy_empresa_info_write" ON public.empresa_info;
CREATE POLICY "policy_empresa_info_write" ON public.empresa_info
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. PROVISIONAMENTO DOS BUCKETS DE STORAGE DO SUPABASE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('fotos-colaboradores', 'fotos-colaboradores', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('documentos-atestados', 'documentos-atestados', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf']),
  ('documentos-holerites', 'documentos-holerites', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('ocorrencias-anexos', 'ocorrencias-anexos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. POLÍTICAS DE ACESSO AO STORAGE (storage.objects)
DROP POLICY IF EXISTS "Permitir download publico de fotos" ON storage.objects;
CREATE POLICY "Permitir download publico de fotos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('fotos-colaboradores', 'ocorrencias-anexos'));

DROP POLICY IF EXISTS "Permitir upload de fotos e documentos" ON storage.objects;
CREATE POLICY "Permitir upload de fotos e documentos" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id IN ('fotos-colaboradores', 'documentos-atestados', 'documentos-holerites', 'ocorrencias-anexos'));

DROP POLICY IF EXISTS "Permitir leitura de documentos pelo app" ON storage.objects;
CREATE POLICY "Permitir leitura de documentos pelo app" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('documentos-atestados', 'documentos-holerites'));
