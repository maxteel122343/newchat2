
-- ==========================================================
-- 1. EXTENSÕES E LIMPEZA (OPCIONAL)
-- ==========================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================================
-- 2. TABELA DE PERFIS (profiles)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  username TEXT UNIQUE,
  credits INT DEFAULT 50,
  profile_photo TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================================
-- 3. TABELA DE MENSAGENS (messages)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  text TEXT,
  card_data JSONB, -- Armazena o objeto MediaCard completo (JSON)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índice para busca rápida por sala
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);

-- ==========================================================
-- 4. TABELA DE VITRINE/GALLERY (cards)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.cards (
  id TEXT PRIMARY KEY, -- ID customizado do MediaCard
  creator_id UUID REFERENCES auth.users,
  type TEXT,
  title TEXT,
  description TEXT,
  thumbnail TEXT,
  credit_cost INT,
  media_url TEXT,
  category TEXT,
  tags TEXT[],
  duration INT,
  is_blur BOOLEAN,
  blur_level INT,
  default_width INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================================
-- 5. SEGURANÇA (RLS - ROW LEVEL SECURITY)
-- ==========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Políticas para Perfis
CREATE POLICY "Público pode ver perfis" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Usuários editam próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Políticas para Mensagens
CREATE POLICY "Mensagens visíveis para todos" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Qualquer um pode enviar mensagens" ON public.messages FOR INSERT WITH CHECK (true);

-- Políticas para Cards (Vitrine)
CREATE POLICY "Vitrine visível para todos" ON public.cards FOR SELECT USING (true);
CREATE POLICY "Apenas logados publicam na vitrine" ON public.cards FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ==========================================================
-- 6. AUTOMAÇÃO: CRIAR PERFIL AO CADASTRAR (Trigger)
-- ==========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, credits)
  VALUES (new.id, split_part(new.email, '@', 1), 50);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove se já existir para evitar erro ao colar várias vezes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================================
-- 7. REALTIME
-- ==========================================================
-- Habilita o Realtime para a tabela de mensagens
begin;
  -- Remove a publicação se já existir para evitar conflitos
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table messages;

-- ==========================================================
-- NOTA: Lembre-se de criar um Bucket chamado 'media' em
-- STORAGE no seu painel do Supabase e deixá-lo como PUBLIC.
-- ==========================================================
