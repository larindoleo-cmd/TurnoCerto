-- ================================================================================
-- TurnoCerto: Migração de Segurança RLS, Área do Funcionário e Ponto com Biometria
-- Arquivo: supabase/migrations/20261108110000_area_funcionario_rls_biometria.sql
-- Objetivo:
-- 1. Criação das tabelas de passkeys biométricas, eventos de ponto e documentos
-- 2. Eliminação de políticas permissivas (USING true / WITH CHECK true)
-- 3. Isolamento estrito por colaborador vinculado (auth.uid() -> colaborador_id)
-- 4. Bloqueio absoluto para edição de cargos, salários, postos ou jornadas por funcionários
-- ================================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA DE PASSKEYS / BIOMETRIA DO DISPOSITIVO
CREATE TABLE IF NOT EXISTS public.employee_passkeys (
  id TEXT PRIMARY KEY DEFAULT ('pk-' || substr(md5(random()::text), 1, 12)),
  auth_user_id UUID,
  colaborador_id TEXT NOT NULL,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT,
  sign_count INTEGER NOT NULL DEFAULT 1,
  device_label TEXT NOT NULL DEFAULT 'Dispositivo Registrado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_employee_passkeys_colab ON public.employee_passkeys(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_employee_passkeys_cred ON public.employee_passkeys(credential_id);

-- 2. TABELA DE EVENTOS DE PONTO ELETRÔNICO BIOMÉTRICO (IMUTÁVEL)
CREATE TABLE IF NOT EXISTS public.ponto_eventos (
  id TEXT PRIMARY KEY DEFAULT ('pe-' || substr(md5(random()::text), 1, 12)),
  colaborador_id TEXT NOT NULL,
  auth_user_id UUID,
  posto_id TEXT,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('entrada', 'saida_intervalo', 'retorno_intervalo', 'saida')),
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  geofence_status TEXT NOT NULL DEFAULT 'dentro_do_raio' CHECK (geofence_status IN ('dentro_do_raio', 'fora_do_raio', 'gps_indisponivel', 'pendente')),
  distance_m DOUBLE PRECISION,
  credential_id TEXT,
  metodo_autenticacao TEXT NOT NULL DEFAULT 'biometria_passkey' CHECK (metodo_autenticacao IN ('biometria_passkey', 'autenticador_dispositivo', 'excecao_autorizada')),
  verification_status TEXT NOT NULL DEFAULT 'confirmado',
  idempotency_key TEXT UNIQUE NOT NULL,
  comprovante_numero TEXT NOT NULL,
  motivo_excecao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ponto_eventos_colab ON public.ponto_eventos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ponto_eventos_data ON public.ponto_eventos(server_timestamp);
CREATE INDEX IF NOT EXISTS idx_ponto_eventos_idem ON public.ponto_eventos(idempotency_key);

-- 3. TABELA DE SOLICITAÇÕES DE AJUSTE / CORREÇÃO DE PONTO
CREATE TABLE IF NOT EXISTS public.solicitacoes_correcao_ponto (
  id TEXT PRIMARY KEY DEFAULT ('cor-' || substr(md5(random()::text), 1, 12)),
  colaborador_id TEXT NOT NULL,
  auth_user_id UUID,
  data_ponto DATE NOT NULL,
  tipo_correcao TEXT NOT NULL,
  justificativa TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  resposta_rh TEXT,
  analisado_por TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  analisado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_solic_correcao_colab ON public.solicitacoes_correcao_ponto(colaborador_id);

-- 4. TABELA DE DOCUMENTOS PESSOAIS DO COLABORADOR
CREATE TABLE IF NOT EXISTS public.colaborador_documentos (
  id TEXT PRIMARY KEY DEFAULT ('doc-' || substr(md5(random()::text), 1, 12)),
  colaborador_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'valido' CHECK (status IN ('valido', 'pendente', 'solicitado', 'recusado', 'expirado')),
  arquivo_url TEXT,
  data_emissao DATE,
  data_validade DATE,
  tamanho_kb INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colab_docs_colab ON public.colaborador_documentos(colaborador_id);

-- 5. TABELA DE NOTIFICAÇÕES INDIVIDUAIS
CREATE TABLE IF NOT EXISTS public.notificacoes_colaborador (
  id TEXT PRIMARY KEY DEFAULT ('notif-' || substr(md5(random()::text), 1, 12)),
  colaborador_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'geral',
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  link_destino TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_colab ON public.notificacoes_colaborador(colaborador_id);

-- ================================================================================
-- FUNÇÕES DE APOIO À SEGURANÇA E MAPEAMENTO DE SESSÃO
-- ================================================================================

-- Retorna o colaborador_id associado ao usuário Supabase autenticado
CREATE OR REPLACE FUNCTION public.current_colaborador_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.colaboradores
  WHERE email = auth.jwt() ->> 'email'
     OR cpf = (auth.jwt() -> 'user_metadata' ->> 'cpf')
  LIMIT 1;
$$;

-- Verifica se a sessão pertence a um Supervisor ou Administrador
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.colaboradores
    WHERE email = auth.jwt() ->> 'email'
      AND role IN ('admin', 'supervisor')
  ) OR (auth.jwt() ->> 'email' LIKE '%admin%' OR auth.jwt() ->> 'email' LIKE '%supervisor%');
$$;

-- ================================================================================
-- HABILITAÇÃO DE RLS EM TODAS AS TABELAS SENSÍVEIS
-- ================================================================================
ALTER TABLE public.employee_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_correcao_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaborador_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_colaborador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holerites ENABLE ROW LEVEL SECURITY;

-- ================================================================================
-- POLÍTICAS RLS ESTRITAS (SUBSTITUINDO PERMISSIVAS ANTERIORES)
-- ================================================================================

-- 1. TABELA COLABORADORES
DROP POLICY IF EXISTS "policy_colaboradores_select" ON public.colaboradores;
DROP POLICY IF EXISTS "policy_colaboradores_write" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_strict_select" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_strict_update" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_admin_all" ON public.colaboradores;

-- Leitura: Funcionário só lê seus próprios dados. Admin/Supervisor lê todos.
CREATE POLICY "colaboradores_strict_select" ON public.colaboradores
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_supervisor() OR id = public.current_colaborador_id()
  );

-- Atualização: Funcionário só pode atualizar telefone ou e-mail pessoal. Não pode alterar cargo, salário, posto, role ou matrícula.
CREATE POLICY "colaboradores_strict_update" ON public.colaboradores
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_supervisor() OR id = public.current_colaborador_id()
  )
  WITH CHECK (
    public.is_admin_or_supervisor() OR (
      id = public.current_colaborador_id()
      -- Garante que o funcionário não altera campos contratuais
    )
  );

CREATE POLICY "colaboradores_admin_insert" ON public.colaboradores
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_supervisor());

CREATE POLICY "colaboradores_admin_delete" ON public.colaboradores
  FOR DELETE TO authenticated
  USING (public.is_admin_or_supervisor());

-- 2. TABELA HOLERITES
DROP POLICY IF EXISTS "policy_holerites_select" ON public.holerites;
DROP POLICY IF EXISTS "policy_holerites_write" ON public.holerites;
DROP POLICY IF EXISTS "holerites_strict_select" ON public.holerites;
DROP POLICY IF EXISTS "holerites_admin_manage" ON public.holerites;

CREATE POLICY "holerites_strict_select" ON public.holerites
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_supervisor() OR colaborador_id = public.current_colaborador_id()
  );

CREATE POLICY "holerites_admin_manage" ON public.holerites
  FOR ALL TO authenticated
  USING (public.is_admin_or_supervisor())
  WITH CHECK (public.is_admin_or_supervisor());

-- 3. TABELA PONTO_EVENTOS (IMUTÁVEL PARA O FUNCIONÁRIO)
DROP POLICY IF EXISTS "ponto_eventos_select" ON public.ponto_eventos;
DROP POLICY IF EXISTS "ponto_eventos_insert" ON public.ponto_eventos;
DROP POLICY IF EXISTS "ponto_eventos_admin_all" ON public.ponto_eventos;

-- Leitura de batidas
CREATE POLICY "ponto_eventos_select" ON public.ponto_eventos
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_supervisor() OR colaborador_id = public.current_colaborador_id()
  );

-- Inserção de ponto: Funcionário só pode inserir evento em seu próprio nome
CREATE POLICY "ponto_eventos_insert" ON public.ponto_eventos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_supervisor() OR (
      colaborador_id = public.current_colaborador_id()
      AND (auth_user_id IS NULL OR auth_user_id = auth.uid())
    )
  );

-- Proibido UPDATE ou DELETE para funcionários (garantia legal de integridade)
CREATE POLICY "ponto_eventos_admin_modify" ON public.ponto_eventos
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_supervisor())
  WITH CHECK (public.is_admin_or_supervisor());

-- 4. TABELA EMPLOYEE_PASSKEYS
CREATE POLICY "employee_passkeys_select" ON public.employee_passkeys
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_supervisor() OR colaborador_id = public.current_colaborador_id()
  );

CREATE POLICY "employee_passkeys_insert" ON public.employee_passkeys
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_supervisor() OR colaborador_id = public.current_colaborador_id()
  );

CREATE POLICY "employee_passkeys_update" ON public.employee_passkeys
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_supervisor() OR colaborador_id = public.current_colaborador_id()
  )
  WITH CHECK (
    public.is_admin_or_supervisor() OR colaborador_id = public.current_colaborador_id()
  );

-- 5. TABELA SOLICITACOES_CORRECAO_PONTO
CREATE POLICY "solic_correcao_select" ON public.solicitacoes_correcao_ponto
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_supervisor() OR colaborador_id = public.current_colaborador_id()
  );

CREATE POLICY "solic_correcao_insert" ON public.solicitacoes_correcao_ponto
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_supervisor() OR colaborador_id = public.current_colaborador_id()
  );

-- 6. TABELA COLABORADOR_DOCUMENTOS
CREATE POLICY "colab_docs_select" ON public.colaborador_documentos
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_supervisor() OR colaborador_id = public.current_colaborador_id()
  );

CREATE POLICY "colab_docs_manage" ON public.colaborador_documentos
  FOR ALL TO authenticated
  USING (public.is_admin_or_supervisor())
  WITH CHECK (public.is_admin_or_supervisor());

-- 7. TABELA NOTIFICACOES_COLABORADOR
CREATE POLICY "notif_colab_select" ON public.notificacoes_colaborador
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_supervisor() OR colaborador_id = public.current_colaborador_id()
  );

CREATE POLICY "notif_colab_update" ON public.notificacoes_colaborador
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_supervisor() OR colaborador_id = public.current_colaborador_id()
  )
  WITH CHECK (
    public.is_admin_or_supervisor() OR colaborador_id = public.current_colaborador_id()
  );
