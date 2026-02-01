
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import ChatRoom from './components/ChatRoom';
import Home from './components/Home';
import Gallery from './components/Gallery';
import AuthModal from './components/AuthModal';
import { User } from './types';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [user, setUser] = useState<User>({
    id: 'guest_' + Math.random().toString(36).substr(2, 5),
    name: 'Visitante',
    credits: 50,
    earnings: 0,
    isHost: false,
    isLoggedIn: false
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  // Alterado para 'light' como padrão
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        syncUser(session.user);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        syncUser(session.user);
      } else {
        setUser({
          id: 'guest_' + Math.random().toString(36).substr(2, 5),
          name: 'Visitante',
          credits: 50,
          earnings: 0,
          isHost: false,
          isLoggedIn: false
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncUser = async (sbUser: any) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sbUser.id)
      .single();

    if (profile) {
      setUser({
        id: profile.id,
        name: profile.username || sbUser.email?.split('@')[0],
        credits: profile.credits ?? 50,
        earnings: profile.earnings ?? 0,
        isLoggedIn: true,
        profilePhoto: profile.profile_photo,
        isHost: true // Authenticated users can be hosts
      });
    } else {
      // Create profile if not exists
      const newProfile = {
        id: sbUser.id,
        username: sbUser.email?.split('@')[0],
        credits: 50,
        earnings: 0
      };
      await supabase.from('profiles').insert([newProfile]);
      setUser({ ...newProfile, isLoggedIn: true, name: newProfile.username, isHost: true });
    }
  };

  const updateCredits = async (amount: number) => {
    const newCredits = user.credits + amount;
    setUser(prev => ({ ...prev, credits: newCredits }));
    
    if (user.isLoggedIn) {
      await supabase
        .from('profiles')
        .update({ credits: newCredits })
        .eq('id', user.id);
    }
  };

  return (
    <Router>
      <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950 text-white selection:bg-indigo-500/30' : 'bg-gray-50 text-slate-900 selection:bg-red-500/30'}`}>
        <Routes>
          <Route 
            path="/" 
            element={<Home user={user} openAuth={() => setIsAuthModalOpen(true)} theme={theme} toggleTheme={toggleTheme} />} 
          />
          <Route 
            path="/chat/:roomId" 
            element={<ChatRoom user={user} updateCredits={updateCredits} openAuth={() => setIsAuthModalOpen(true)} theme={theme} toggleTheme={toggleTheme} />} 
          />
          <Route 
            path="/gallery" 
            element={<Gallery user={user} />} 
          />
        </Routes>
        {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
      </div>
    </Router>
  );
};

export default App;
