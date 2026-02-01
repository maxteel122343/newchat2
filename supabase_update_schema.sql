
-- Adicionar coluna de repetição (auto-repeat)
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS repeat_interval INT DEFAULT 0;

-- Certificar que card_color existe (caso não tenha rodado o anterior)
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS card_color TEXT DEFAULT '#0f172a';
