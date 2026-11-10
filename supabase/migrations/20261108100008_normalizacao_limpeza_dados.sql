-- ================================================================================
-- TurnoCerto: Migração 08 - Normalização e Higienização de Dados Legados
-- Arquivo: supabase/migrations/20261108100008_normalizacao_limpeza_dados.sql
-- Tipo: DML (Higienização e Normalização de Registros)
-- ================================================================================

-- 1. HIGIENIZAÇÃO DE CPFs E NOMES (Remove espaços em excesso)
UPDATE public.colaboradores
SET 
  nome = TRIM(nome),
  full_name = COALESCE(full_name, TRIM(nome)),
  cpf = NULLIF(TRIM(cpf), '')
WHERE nome IS NOT NULL;

UPDATE public.profiles
SET 
  nome = TRIM(nome),
  full_name = COALESCE(full_name, TRIM(nome)),
  cpf = NULLIF(TRIM(cpf), '')
WHERE nome IS NOT NULL;

-- 2. ESPELHAMENTO DOS CONDOMÍNIOS EXISTENTES NA TABELA LEGADA POSTOS
INSERT INTO public.postos (id, nome, tipo, cnpj, endereco, bairro, cidade, supervisor, status, updated_at)
SELECT 
  c.id, c.nome, c.tipo, c.cnpj, c.endereco, c.bairro, c.cidade, c.supervisor, c.status, NOW()
FROM public.condominios c
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  tipo = EXCLUDED.tipo,
  cnpj = EXCLUDED.cnpj,
  endereco = EXCLUDED.endereco,
  bairro = EXCLUDED.bairro,
  cidade = EXCLUDED.cidade,
  supervisor = EXCLUDED.supervisor,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 3. RECÁLCULO GLOBAL DE VAGAS OCUPADAS EM TODOS OS CONDOMÍNIOS
UPDATE public.condominios c
SET 
  vagas_ocupadas = (
    SELECT COUNT(*) 
    FROM public.colaboradores col 
    WHERE col.condominio_id = c.id 
      AND col.status IN ('no_posto', 'ativo')
  ),
  cobertura_percentual = LEAST(
    100.00,
    ROUND(
      ((SELECT COUNT(*) FROM public.colaboradores col WHERE col.condominio_id = c.id AND col.status IN ('no_posto', 'ativo'))::numeric / 
      GREATEST(1, c.vagas_contratadas)::numeric) * 100,
      2
    )
  );

-- 4. GARANTE A EXISTÊNCIA DA EMPRESA MATRIZ
INSERT INTO public.empresa_info (
  id, razao_social, nome_fantasia, cnpj, telefone, whatsapp, email, endereco, bairro, cidade, estado, cep
) VALUES (
  'matriz-principal',
  'TurnoCerto Terceirização e Serviços Ltda.',
  'TurnoCerto Serviços',
  '12.345.678/0001-90',
  '(11) 3221-4000',
  '(11) 98842-1190',
  'operacional@turnocerto.com.br',
  'Av. Paulista, 1000 - Bela Vista',
  'Bela Vista',
  'São Paulo',
  'SP',
  '01310-100'
)
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();
