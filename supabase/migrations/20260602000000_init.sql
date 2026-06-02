-- ============================================================
-- 20260602000000_init.sql
-- Initial schema for Triador AI (Story 1.2)
-- Tables: profiles, triagens, itens
-- Plus: enums, triggers, indexes, RLS policies
-- ============================================================

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE plan_tier AS ENUM ('free', 'pro');
CREATE TYPE bucket_type AS ENUM ('prioridade', 'roi_alto', 'delega', 'depois', 'descarta');
CREATE TYPE status_triagem AS ENUM ('pendente', 'classificando', 'classificada', 'erro');

-- ============================================================
-- profiles — extensão de auth.users
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  plan plan_tier NOT NULL DEFAULT 'free',
  criterios_personalizados jsonb,
  onboarding_completed boolean NOT NULL DEFAULT false,
  stripe_customer_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_stripe_customer ON profiles(stripe_customer_id);

-- Trigger pra criar profile automaticamente após signup em auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- triagens
-- ============================================================
CREATE TABLE public.triagens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto_bruto text,
  imagem_url text,
  status status_triagem NOT NULL DEFAULT 'pendente',
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  custo_estimado_usd numeric(10, 6) NOT NULL DEFAULT 0,
  modelo_usado text,
  created_at timestamptz NOT NULL DEFAULT now(),
  classified_at timestamptz,
  CHECK (texto_bruto IS NOT NULL OR imagem_url IS NOT NULL)
);

CREATE INDEX idx_triagens_user_created ON triagens(user_id, created_at DESC);
CREATE INDEX idx_triagens_status ON triagens(status) WHERE status IN ('pendente', 'classificando');

-- ============================================================
-- itens
-- ============================================================
CREATE TABLE public.itens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  triagem_id uuid NOT NULL REFERENCES triagens(id) ON DELETE CASCADE,
  texto text NOT NULL,
  bucket bucket_type NOT NULL,
  justificativa text NOT NULL,
  posicao integer NOT NULL DEFAULT 0,
  concluido boolean NOT NULL DEFAULT false,
  concluido_at timestamptz,
  gatilho_retorno jsonb,
  delegacao jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_itens_triagem ON itens(triagem_id);
CREATE INDEX idx_itens_bucket ON itens(triagem_id, bucket, posicao);
CREATE INDEX idx_itens_concluido ON itens(triagem_id) WHERE concluido = false;

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE triagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens ENABLE ROW LEVEL SECURITY;

-- profiles: usuário só vê e atualiza o próprio
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- triagens: usuário só vê/manipula próprias
CREATE POLICY "triagens_select_own" ON triagens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "triagens_insert_own" ON triagens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "triagens_update_own" ON triagens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "triagens_delete_own" ON triagens FOR DELETE USING (auth.uid() = user_id);

-- itens: acesso via dono da triagem (FK)
CREATE POLICY "itens_select_own" ON itens FOR SELECT
  USING (EXISTS (SELECT 1 FROM triagens t WHERE t.id = itens.triagem_id AND t.user_id = auth.uid()));
CREATE POLICY "itens_insert_own" ON itens FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM triagens t WHERE t.id = itens.triagem_id AND t.user_id = auth.uid()));
CREATE POLICY "itens_update_own" ON itens FOR UPDATE
  USING (EXISTS (SELECT 1 FROM triagens t WHERE t.id = itens.triagem_id AND t.user_id = auth.uid()));
CREATE POLICY "itens_delete_own" ON itens FOR DELETE
  USING (EXISTS (SELECT 1 FROM triagens t WHERE t.id = itens.triagem_id AND t.user_id = auth.uid()));
