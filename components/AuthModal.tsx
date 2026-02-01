
import React, { useState } from 'react';
import { X, LogIn, UserPlus, Mail, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Cadastro realizado! Verifique seu e-mail se necessário.');
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in">
      <div className="bg-[#111827] border border-slate-800 p-10 rounded-[3rem] w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400">
          <X size={24} />
        </button>

        <div className="flex flex-col items-center gap-6">
          <div className="p-4 bg-indigo-600/10 rounded-2xl text-indigo-500">
            {isLogin ? <LogIn size={32} /> : <UserPlus size={32} />}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-white">
              {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h2>
            <p className="text-sm text-slate-500 mt-2">Para salvar seus créditos e vitrine permanentemente.</p>
          </div>

          <form onSubmit={handleAuth} className="w-full space-y-4">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800/40 border border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-sm outline-none focus:border-indigo-500 transition-all" 
                  placeholder="exemplo@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800/40 border border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-sm outline-none focus:border-indigo-500 transition-all" 
                  placeholder="********"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.3em] shadow-xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (isLogin ? 'Entrar Agora' : 'Cadastrar Grátis')}
            </button>
          </form>

          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] font-black uppercase text-slate-500 hover:text-white transition-all tracking-widest"
          >
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre aqui'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
