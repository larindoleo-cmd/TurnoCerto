-- ================================================================================
-- 07 — LIMPEZA_E_NORMALIZACAO.sql
-- TurnoCerto: Limpeza de Duplicidades, Normalização de Registros e Seed Inicial de Tabelas
-- Não apaga dados legítimos: Trata e sincroniza postos duplicados com segurança
-- Executar no SQL Editor do Supabase (PostgreSQL)
-- ================================================================================

-- 1. Unificar Condomínios Legítimos na Tabela Principal 'condominios'
INSERT INTO public.condominios (
  id, nome, tipo, cnpj, contrato_numero, endereco, bairro, cidade, supervisor, telefone_supervisor,
  vagas_contratadas, status, tipo_escala_padrao, cobertura_percentual, contato_sindico, telefone_sindico,
  instrucoes_guarita, foto_url
) VALUES
  ('cond-1', 'Residencial Alvorada', 'Residencial', '14.892.341/0001-92', 'CT-2024/089', 'Av. das Castanheiras, 1420', 'Águas Claras', 'Brasília - DF', 'Supervisora Silva', '(61) 98842-1190', 4, 'operacional', '12x36 Diurno / Noturno', 100, 'Dr. Roberto Meirelles (Síndico)', '(61) 99123-4567', 'Controle rigoroso de delivery com identificação facial.', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=500&auto=format&fit=crop&q=80'),
  ('cond-2', 'Boulevard Grand Park', 'Residencial', '28.114.772/0001-15', 'CT-2023/140', 'Rua das Figueiras, 850', 'Jardim Paulista', 'São Paulo - SP', 'Supervisora Silva', '(11) 97321-8844', 6, 'operacional', '12x36 e 6x1 Comercial', 100, 'Mariana Duarte (Adm Predial)', '(11) 98455-1234', 'Cadastramento biométrico e conferência de placas de visitantes na cancela.', 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=500&auto=format&fit=crop&q=80'),
  ('cond-3', 'Edifício Primavera', 'Residencial', '33.567.890/0001-44', 'CT-2024/012', 'Rua São Clemente, 310', 'Botafogo', 'Rio de Janeiro - RJ', 'Supervisora Silva', '(21) 98765-4321', 3, 'critico', '12x36 Diurno', 66, 'Sra. Beatriz Nogueira', '(21) 99876-5432', 'Alerta: Guarita 02 com cobertura emergencial preventiva.', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=500&auto=format&fit=crop&q=80'),
  ('cond-4', 'Solar das Palmeiras', 'Condomínio de Casas', '19.204.551/0001-80', 'CT-2022/204', 'Alameda dos Jacarandás, Lote 12', 'Alphaville', 'Barueri - SP', 'Supervisora Silva', '(11) 97321-8844', 4, 'operacional', '12x36 Diurno / Noturno', 100, 'Eng. Fernando Camargo', '(11) 97112-9988', 'Ronda perimetral a cada 90 minutos com bastão de ronda eletrônico.', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=500&auto=format&fit=crop&q=80')
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  tipo = EXCLUDED.tipo,
  cnpj = COALESCE(EXCLUDED.cnpj, condominios.cnpj),
  endereco = EXCLUDED.endereco,
  bairro = EXCLUDED.bairro,
  cidade = EXCLUDED.cidade,
  supervisor = EXCLUDED.supervisor,
  vagas_contratadas = EXCLUDED.vagas_contratadas,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 2. Limpar IDs duplicados com prefixo artificial 'c1111111...' na tabela 'postos' que não possuem vínculos
DELETE FROM public.postos
WHERE id LIKE 'c%1111111-1111-1111-1111-111111111111'
  AND id NOT IN (SELECT DISTINCT COALESCE(condominio_id, '') FROM public.colaboradores);

-- 3. Popular Tabela da Matriz Terceirizada (se vazia)
INSERT INTO public.empresa_info (
  id, razao_social, nome_fantasia, cnpj, telefone, whatsapp, email,
  endereco, bairro, cidade, estado, cep, responsavel_operacional, cargo_responsavel
) VALUES (
  'matriz-principal',
  'TurnoCerto Gestão de Terceirização e Serviços Ltda.',
  'TurnoCerto Facilities & Escalas',
  '45.892.114/0001-90',
  '(11) 3450-8800',
  '(11) 98842-1190',
  'contato@turnocerto.com.br',
  'Av. Paulista, 1842 - Torre Norte - 14º Andar',
  'Bela Vista',
  'São Paulo',
  'SP',
  '01310-200',
  'Supervisora Silva',
  'Diretora de Operações e Escalas'
) ON CONFLICT (id) DO NOTHING;

-- 4. Inserir Ocorrências Iniciais Operacionais (se tabela vazia)
INSERT INTO public.ocorrencias (id, posto_id, posto_nome, tipo, descricao, registrado_por, data_hora, urgencia, resolvida)
SELECT 'ocorr-init-1', 'cond-3', 'Edifício Primavera', 'Posto Descoberto', 'Guarita 02 sem porteiro titular na rendição da manhã. Volante despachado com sucesso.', 'Supervisora Silva', 'Hoje às 07:15', 'alta', FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.ocorrencias LIMIT 1);

-- 5. Inserir Alertas Operacionais Iniciais (se tabela vazia)
INSERT INTO public.alertas (id, tipo, gravidade, titulo, descricao, posto_id, posto_nome, horario, resolvido)
SELECT 'alert-init-1', 'posto_descoberto', 'critica', 'Posto Descoberto - Guarita 02', 'Plantão diurno sem rendição presencial às 07:00.', 'cond-3', 'Edifício Primavera', '07:05', FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.alertas LIMIT 1);
