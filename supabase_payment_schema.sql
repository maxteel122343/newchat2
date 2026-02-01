
-- ==========================================================
-- TABELA DE TRANSAÇÕES DE PAGAMENTO (COPIE E COLE NO SQL EDITOR)
-- ==========================================================

-- 1. Cria a tabela para armazenar os pagamentos gerados
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  mp_payment_id TEXT UNIQUE, -- ID do pagamento no Mercado Pago
  amount NUMERIC NOT NULL,   -- Valor em Reais
  credits_amount INT NOT NULL, -- Quantidade de créditos comprados
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  qr_code TEXT,       -- Código Copia e Cola
  qr_code_base64 TEXT, -- Imagem em Base64
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilita segurança (Row Level Security)
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- 3. Cria políticas de acesso
-- Usuários podem ver apenas suas próprias transações
CREATE POLICY "Users can view own transactions" 
ON public.payment_transactions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Permitir que a Edge Function (Service Role) gerencie tudo
CREATE POLICY "Service role manages transactions" 
ON public.payment_transactions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. Habilita Realtime para esta tabela
-- Isso permite que o frontend saiba instantaneamente quando o status mudar para 'approved'
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table messages, payment_transactions;

-- DICA: Se a publication já existir e der erro, rode apenas:
-- alter publication supabase_realtime add table payment_transactions;
