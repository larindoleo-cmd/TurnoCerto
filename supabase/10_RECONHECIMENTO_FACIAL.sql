-- ============================================================================
-- AVISO IMPORTANTE: NÃO EXECUTAR ESTE ARQUIVO DIRETAMENTE EM PRODUÇÃO!
-- Este script legado supõe IDs UUID. O TurnoCerto utiliza identificadores TEXT
-- para colaboradores (ex: 'colab-1731...').
-- A migração oficial compatível e segura é:
-- supabase/migrations/20261110_biometria_facial_core_v3.sql
-- ============================================================================

-- 1. HABILITAR EXTENSÃO PGVECTOR (Recomendado para busca e similaridade vetorial)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABELA DE COLABORADORES
-- Armazena dados cadastrais, cargo, status e o descritor facial mestre (128 dimensões)
CREATE TABLE IF NOT EXISTS public.colaboradores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    cargo VARCHAR(100) NOT NULL,
    matricula VARCHAR(50) UNIQUE,
    condominio_id UUID,
    posto_nome VARCHAR(150),
    foto_url TEXT,
    
    -- Vetor facial de 128 dimensões gerado pelo modelo de IA (FaceNet / ResNet-34)
    -- Utiliza a extensão vector(128) para cálculo rápido de distância L2
    face_descriptor vector(128),
    
    -- Coluna de contingência / fallback caso a extensão vector não esteja instalada:
    -- face_descriptor_array FLOAT8[], 
    -- face_descriptor_json JSONB,

    biometria_cadastrada BOOLEAN DEFAULT FALSE,
    biometria_atualizada_em TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'ativo',
    criado_em TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    atualizado_em TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 3. TABELA DE AMOSTRAS FACIAIS (MULTI-TEMPLATE POR COLABORADOR)
-- Permite cadastrar até 3 amostras por colaborador (frontal, leve rotação, com/sem óculos)
CREATE TABLE IF NOT EXISTS public.colaborador_faces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
    descriptor vector(128) NOT NULL,
    foto_storage_path TEXT,
    qualidade_score FLOAT DEFAULT 1.0,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 4. TABELA DE REGISTROS DE PONTO (BATIDAS COM BIOMETRIA E AUDITORIA)
CREATE TABLE IF NOT EXISTS public.ponto_registros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    tipo_registro VARCHAR(50) NOT NULL, -- 'entrada', 'saida_intervalo', 'retorno_intervalo', 'saida'
    
    -- Dados de validação biométrica facial
    metodo_autenticacao VARCHAR(50) DEFAULT 'biometria_facial',
    face_distance FLOAT, -- Distância Euclidiana calculada (ex: 0.32)
    face_similarity_percent FLOAT, -- Similaridade calculada (ex: 94.5%)
    verification_status VARCHAR(30) DEFAULT 'confirmado', -- 'confirmado', 'pendente_auditoria', 'rejeitado'
    
    -- Evidência fotográfica armazenada no Supabase Storage
    foto_comprovante_url TEXT,
    
    -- Geolocalização e conformidade MTE Portaria 671
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy_metros FLOAT,
    geofence_status VARCHAR(40) DEFAULT 'dentro_do_raio',
    distancia_posto_metros FLOAT,
    comprovante_numero VARCHAR(100) UNIQUE NOT NULL,
    idempotency_key VARCHAR(120) UNIQUE NOT NULL,
    
    criado_em TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 5. ÍNDICES DE ALTA PERFORMANCE
-- Índice HNSW (Hierarchical Navigable Small World) para buscas vetoriais sub-milissegundo
CREATE INDEX IF NOT EXISTS idx_colaboradores_face_hnsw 
ON public.colaboradores 
USING hnsw (face_descriptor vector_l2_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_colaborador_faces_hnsw 
ON public.colaborador_faces 
USING hnsw (descriptor vector_l2_ops);

-- Índices relacionais e cronológicos
CREATE INDEX IF NOT EXISTS idx_ponto_colaborador_time 
ON public.ponto_registros (colaborador_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ponto_comprovante 
ON public.ponto_registros (comprovante_numero);

-- 6. FUNÇÃO RPC DE IDENTIFICAÇÃO FACIAL 1:N (MATCHING NO BANCO)
-- Recebe o vetor da câmera (query_descriptor) e acha o colaborador mais parecido
CREATE OR REPLACE FUNCTION public.identificar_face(
    query_descriptor vector(128),
    threshold_distancia FLOAT DEFAULT 0.60
)
RETURNS TABLE (
    colaborador_id UUID,
    nome VARCHAR,
    cpf VARCHAR,
    cargo VARCHAR,
    distancia FLOAT,
    similaridade_percent FLOAT
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        c.id AS colaborador_id,
        c.nome,
        c.cpf,
        c.cargo,
        (c.face_descriptor <-> query_descriptor) AS distancia,
        ROUND((1.0 - ((c.face_descriptor <-> query_descriptor) / 1.1)) * 100, 1) AS similaridade_percent
    FROM public.colaboradores c
    WHERE c.face_descriptor IS NOT NULL
      AND (c.face_descriptor <-> query_descriptor) <= threshold_distancia
    ORDER BY c.face_descriptor <-> query_descriptor ASC
    LIMIT 1;
$$;

-- 7. FUNÇÃO FALLBACK PARA POSTGRESQL SEM EXTENSÃO PGVECTOR (ARRAY FLOAT8[])
-- Permite calcular a distância euclidiana puramente com arrays nativos
CREATE OR REPLACE FUNCTION public.distancia_euclidiana_array(a FLOAT8[], b FLOAT8[])
RETURNS FLOAT8 AS $$
DECLARE
    dist FLOAT8 := 0;
    i INT;
BEGIN
    IF array_length(a, 1) <> array_length(b, 1) THEN
        RAISE EXCEPTION 'Dimensões incompatíveis dos vetores';
    END IF;
    FOR i IN 1..array_length(a, 1) LOOP
        dist := dist + ((a[i] - b[i]) ^ 2);
    END LOOP;
    RETURN sqrt(dist);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaborador_faces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_registros ENABLE ROW LEVEL SECURITY;

-- Colaboradores podem ler seus próprios dados, Admins/Supervisores leem todos
CREATE POLICY "Leitura de colaboradores autenticados" 
ON public.colaboradores FOR SELECT 
TO authenticated 
USING (true);

-- Apenas Admin/Supervisor pode atualizar vetores biométricos
CREATE POLICY "Atualização de biometria por gestores" 
ON public.colaboradores FOR UPDATE 
TO authenticated 
USING (auth.jwt() ->> 'role' IN ('admin', 'supervisor', 'service_role'))
WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'supervisor', 'service_role'));

-- Colaborador pode inserir seus registros de ponto
CREATE POLICY "Inserção de ponto pelo próprio colaborador" 
ON public.ponto_registros FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Leitura de registros de ponto" 
ON public.ponto_registros FOR SELECT 
TO authenticated 
USING (
    colaborador_id = (SELECT id FROM public.colaboradores WHERE id = colaborador_id LIMIT 1)
    OR auth.jwt() ->> 'role' IN ('admin', 'supervisor', 'service_role')
);

-- 9. CONFIGURAÇÃO DO BUCKET DE ARMAZENAMENTO (SUPABASE STORAGE)
-- Insert para criar buckets privados para fotos biométricas
INSERT INTO storage.buckets (id, name, public)
VALUES ('biometria-fotos', 'biometria-fotos', false),
       ('comprovantes-ponto', 'comprovantes-ponto', false)
ON CONFLICT (id) DO NOTHING;
