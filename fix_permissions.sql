
-- =================================================================
-- SCRIPT DE CORREÇÃO DE PERMISSÕES E REALTIME (RODE NO SQL EDITOR)
-- =================================================================

-- 1. Garantir que a tabela existe com a estrutura correta
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  mp_payment_id TEXT UNIQUE,
  amount NUMERIC NOT NULL,
  credits_amount INT NOT NULL,
  status TEXT DEFAULT 'pending',
  qr_code TEXT,
  qr_code_base64 TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar Segurança em Nível de Linha (RLS)
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas para evitar conflitos ou duplicações
DROP POLICY IF EXISTS "Users can view own transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Service role manages transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Enable read access for users" ON public.payment_transactions;
DROP POLICY IF EXISTS "Enable insert for service role" ON public.payment_transactions;

-- 4. Criar Política de Visualização para Usuários
-- O usuário só pode ver transações onde user_id é igual ao seu ID de login
CREATE POLICY "Users can view own transactions" 
ON public.payment_transactions 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- 5. Criar Política de Gerenciamento Total para Service Role (Edge Functions)
-- A função do Mercado Pago usa a role 'service_role', que precisa de permissão total
CREATE POLICY "Service role manages transactions" 
ON public.payment_transactions 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- 6. Garantir permissões de baixo nível (Grants)
-- Garante que o usuário autenticado possa fazer SELECT
GRANT SELECT ON public.payment_transactions TO authenticated;

-- Garante que a Service Role possa fazer tudo
GRANT ALL ON public.payment_transactions TO service_role;

-- 7. CORREÇÃO CRÍTICA DO REALTIME
-- Isso garante que o Supabase envie o evento de 'UPDATE' para o frontend quando o pagamento for aprovado
DO $$
BEGIN
  -- Cria a publicação se ela não existir (padrão do Supabase)
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- Adiciona a tabela à publicação realtime (se já estiver adicionada, este comando não quebra nada)
ALTER PUBLICATION supabase_realtime ADD TABLE payment_transactions;

-- Confirmação visual
SELECT 'Permissões corrigidas com sucesso!' as status;
