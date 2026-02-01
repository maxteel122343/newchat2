
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, LayoutGrid, MessageCircle, LogIn, TrendingUp, User as UserIcon, LogOut, Sun, Moon } from 'lucide-react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface HomeProps {
  user: User;
  openAuth: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

const Home: React.FC<HomeProps> = ({ user, openAuth, theme, toggleTheme }) => {
  const navigate = useNavigate();
  const personalRoomId = user.id;
  const isDark = theme === 'dark';

  const handleStartChat = () => {
    navigate(`/chat/${personalRoomId}`);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/#/chat/${personalRoomId}`;
    navigator.clipboard.writeText(link);
    alert('Seu link de convite foi copiado!');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const colors = {
    text: isDark ? 'text-white' : 'text-slate-900',
    subText: isDark ? 'text-slate-400' : 'text-slate-600',
    cardBg: isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-xl',
    primary: isDark ? 'bg-indigo-600' : 'bg-red-600',
    primaryText: isDark ? 'text-indigo-400' : 'text-red-600',
    glass: isDark ? 'glass' : 'bg-white/80 backdrop-blur-md border border-gray-200 shadow-sm'
  };

  return (
    <div className={`max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in duration-700 ${isDark ? '' : 'text-slate-900'}`}>
      <header className="flex justify-between items-center py-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl shadow-xl ${colors.primary} shadow-indigo-600/20`}>
            <UserIcon size={24} className="text-white" />
          </div>
          <h1 className={`text-2xl font-black tracking-tighter uppercase ${colors.text}`}>Meu Painel</h1>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={toggleTheme}
            className={`p-3 rounded-2xl ${colors.glass} hover:opacity-80 transition-all ${colors.text}`}
          >
             {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={() => navigate('/gallery')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl ${colors.glass} hover:bg-white/10 transition-all text-xs font-black uppercase tracking-widest ${colors.text}`}
          >
            <LayoutGrid size={18} />
            <span className="hidden sm:inline">Vitrine</span>
          </button>
          {user.isLoggedIn ? (
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white transition-all font-black text-xs uppercase tracking-widest"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          ) : (
            <button 
              onClick={openAuth}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl ${isDark ? 'bg-white text-slate-950 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'} transition-all font-black text-xs uppercase tracking-widest`}
            >
              <LogIn size={18} />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className={`p-10 rounded-[3rem] ${colors.cardBg} flex flex-col justify-between space-y-10 relative overflow-hidden`}>
          <div className={`absolute top-0 right-0 w-32 h-32 ${isDark ? 'bg-indigo-600/10' : 'bg-red-600/10'} blur-3xl -mr-10 -mt-10 rounded-full`}></div>
          <div>
            <h2 className={`text-4xl font-black mb-6 leading-tight ${colors.text} uppercase tracking-tighter`}>Convide e interaja agora.</h2>
            <p className={`${colors.subText} text-lg font-medium`}>Você é o host do seu próprio espaço. Crie cards e monetize suas interações.</p>
          </div>
          
          <div className="space-y-4">
            <div className={`p-5 rounded-3xl ${isDark ? 'bg-black/40 border-white/5' : 'bg-gray-50 border-gray-200'} border flex items-center justify-between group`}>
              <div className="overflow-hidden">
                <span className="text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Link de Host</span>
                <code className={`${colors.primaryText} text-sm truncate block font-bold`}>.../chat/{personalRoomId}</code>
              </div>
              <button onClick={copyLink} className={`p-4 rounded-2xl transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-white hover:bg-gray-100 text-slate-900 border border-gray-100'}`}>
                <Share2 size={20} />
              </button>
            </div>
            
            <button 
              onClick={handleStartChat}
              className={`w-full flex items-center justify-center gap-4 ${colors.primary} text-white font-black py-6 rounded-[2rem] hover:opacity-90 transition-all transform hover:-translate-y-1 shadow-2xl uppercase tracking-[0.2em] text-sm`}
            >
              <MessageCircle size={22} />
              ACESSAR MEU CHAT
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div className={`p-10 rounded-[3rem] ${colors.cardBg}`}>
            <h3 className={`text-lg font-black mb-8 flex items-center gap-3 uppercase tracking-widest ${colors.text}`}>
              <TrendingUp size={24} className={colors.primaryText} />
              Sua Carteira
            </h3>
            <div className="space-y-6">
              <div className={`flex justify-between items-center p-6 rounded-[2rem] border shadow-inner ${isDark ? 'bg-black/40 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                <span className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Créditos Disponíveis</span>
                <div className="flex items-center gap-3">
                   <span className="font-black text-4xl text-emerald-400">{user.credits}</span>
                   <span className="text-[10px] font-black text-emerald-400/50 uppercase tracking-widest">CR</span>
                </div>
              </div>
              
              {!user.isLoggedIn && (
                <div className={`p-6 rounded-3xl border ${isDark ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  <p className={`text-xs leading-relaxed font-bold ${isDark ? 'text-indigo-200' : 'text-red-800'}`}>
                    CONTA VISITANTE: Faça login para que seus créditos e cards criados não sejam perdidos ao limpar o cache do navegador.
                  </p>
                  <button onClick={openAuth} className={`mt-4 text-[10px] font-black uppercase text-white ${colors.primary} px-4 py-2 rounded-lg hover:opacity-90 transition-all`}>Logar Agora</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="pt-10">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 px-1">Tópicos em Alta</h4>
        <div className="flex flex-wrap gap-4">
          {['Call Premium', 'VIP Content', 'Podcasts', 'Gaming Live', 'Consultoria', 'Meet 1on1'].map((cat) => (
            <div key={cat} className={`px-8 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${isDark ? 'glass border-white/5 hover:bg-indigo-600 hover:text-white' : 'bg-white border-gray-200 hover:bg-red-600 hover:text-white shadow-sm'}`}>
              {cat}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
