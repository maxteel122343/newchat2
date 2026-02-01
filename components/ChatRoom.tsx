
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Plus, Home, Wallet, Share2, MessageSquare, LayoutGrid, QrCode, X, User as UserIcon, LogIn, Camera, Settings, Sun, Moon, Menu, ChevronLeft, ChevronRight, Copy, CheckCircle, Loader2, RefreshCw, DollarSign, ArrowUpRight, Mic, Video, Upload, StopCircle, Trash2, Aperture, Lock, Zap } from 'lucide-react';
import { User, Message, MediaCard, ChatSession, CardType, PaymentTransaction, CardDefaults } from '../types';
import { supabase } from '../lib/supabase';
import CardModal from './CardModal';
import MediaCardItem from './MediaCardItem';
import Gallery from './Gallery';

interface ChatRoomProps {
  user: User;
  updateCredits: (amount: number) => void;
  openAuth: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

const DEFAULT_SETTINGS_KEY = 'linkcard_defaults';

const ChatRoom: React.FC<ChatRoomProps> = ({ user, updateCredits, openAuth, theme, toggleTheme }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'showcase'>('chat');
  const [showQrCode, setShowQrCode] = useState(false);
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [withdrawalPending, setWithdrawalPending] = useState(false);
  
  // Private Room Logic
  const [isPrivateLocked, setIsPrivateLocked] = useState(false);
  const [privateRoomCard, setPrivateRoomCard] = useState<MediaCard | null>(null);
  
  // Quick Action States
  const [isQuickRecording, setIsQuickRecording] = useState(false);
  const [quickRecordingType, setQuickRecordingType] = useState<'audio' | 'video' | 'photo' | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [quickStream, setQuickStream] = useState<MediaStream | null>(null);
  
  // Payment States
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [activePayment, setActivePayment] = useState<PaymentTransaction | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // UI States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profileRefresh, setProfileRefresh] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickUploadRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const quickVideoRef = useRef<HTMLVideoElement>(null);

  const isHost = !!(user.isLoggedIn && (roomId === user.id || roomId?.startsWith('priv-') || roomId?.startsWith('room-')));
  const isDark = theme === 'dark';

  const colors = {
    bg: isDark ? 'bg-[#050a14]' : 'bg-gray-50',
    sidebarBg: isDark ? 'bg-[#0a111f]' : 'bg-white',
    headerBg: isDark ? 'bg-[#0a111f]/80' : 'bg-white/80',
    border: isDark ? 'border-slate-800/50' : 'border-gray-200',
    text: isDark ? 'text-slate-300' : 'text-slate-600',
    textHighlight: isDark ? 'text-white' : 'text-slate-900',
    primary: isDark ? 'bg-blue-600' : 'bg-red-600',
    primaryText: isDark ? 'text-blue-500' : 'text-red-600',
    primarySoft: isDark ? 'bg-blue-600/10' : 'bg-red-600/10',
    primaryBorder: isDark ? 'border-blue-500/20' : 'border-red-500/20',
    inputBg: isDark ? 'bg-slate-800/40' : 'bg-gray-100',
  };

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('chat_sessions');
    const baseRoom = { 
      id: roomId || 'main', 
      name: `Sala: ${roomId?.slice(0, 6) || 'Principal'}`, 
      lastMessage: 'Bem-vindo!', 
      time: 'Agora', 
      isActive: true 
    };
    if (saved) {
      const parsed = JSON.parse(saved);
      if (roomId && !parsed.find((s: ChatSession) => s.id === roomId)) {
        parsed.unshift(baseRoom);
      }
      return parsed;
    }
    return [baseRoom];
  });

  useEffect(() => {
    localStorage.setItem('chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // PRIVATE ROOM GATEKEEPER CHECK
  useEffect(() => {
    const checkPrivateAccess = async () => {
        setIsPrivateLocked(false); // Reset default
        setPrivateRoomCard(null);

        if (roomId?.startsWith('priv-')) {
            const cardId = roomId.split('priv-')[1];
            
            // 1. Fetch Card Details
            const { data: cardData, error } = await supabase.from('cards').select('*').eq('id', cardId).single();
            
            if (error || !cardData) {
                // Card doesn't exist, assume unlocked or deleted
                return;
            }

            const mediaCard = {
                ...cardData,
                type: cardData.type as CardType
            } as MediaCard;

            setPrivateRoomCard(mediaCard);

            // 2. Check Ownership
            if (user.isLoggedIn && (user.id === cardData.creator_id)) {
                return; // Owner access
            }

            // 3. Check Payment/Unlock status (Currently mocked via 'unlocked_cards' check, here we assume lock unless owner)
            // Real implementation would check a 'purchases' table.
            // For MVP, we force pay if it's not the owner.
            setIsPrivateLocked(true);
        }
    };
    checkPrivateAccess();
  }, [roomId, user.id, user.isLoggedIn]);

  const handleUnlockPrivateRoom = async () => {
      if (!user.isLoggedIn) {
          openAuth();
          return;
      }
      if (!privateRoomCard) return;

      if (user.credits < privateRoomCard.creditCost) {
          setShowQrCode(true);
          return;
      }

      // Deduct credits
      updateCredits(-privateRoomCard.creditCost);
      
      // Process Creator Earnings
      const earnings = Math.floor(privateRoomCard.creditCost * 0.8);
      // Warning: creator_id might be null if not loaded correctly, handle safely
      if (privateRoomCard['creator_id']) { // Assuming creator_id exists on the object fetched from Supabase
          await supabase.rpc('process_card_purchase', { 
               p_card_id: privateRoomCard.id, 
               p_buyer_id: user.id, 
               p_creator_id: privateRoomCard['creator_id'], 
               p_amount: privateRoomCard.creditCost,
               p_earnings: earnings 
          });
      }

      setIsPrivateLocked(false);
      alert(`Sala desbloqueada! -${privateRoomCard.creditCost} créditos.`);
  };

  useEffect(() => {
    if (!roomId) return;
    if (isPrivateLocked) return; // Don't fetch messages if locked

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      
      if (data) {
        setMessages(data.map(m => ({
          id: m.id,
          senderId: m.sender_id,
          senderName: m.sender_name,
          text: m.text,
          card: m.card_data,
          timestamp: new Date(m.created_at).getTime()
        })));
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, 
      (payload) => {
        const m = payload.new;
        setMessages(prev => [...prev, {
          id: m.id,
          senderId: m.sender_id,
          senderName: m.sender_name,
          text: m.text,
          card: m.card_data,
          timestamp: new Date(m.created_at).getTime()
        }]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      (payload) => {
         setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, isPrivateLocked]);

  // ... (Remaining useEffects for scroll, payment, recording cleanup kept same) ...
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  useEffect(() => {
    if (!activePayment) return;
    const channel = supabase.channel(`payment:${activePayment.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payment_transactions', filter: `id=eq.${activePayment.id}` }, 
      (payload) => {
        const updated = payload.new as PaymentTransaction;
        if (updated.status === 'approved') handleApprovedPayment(updated);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activePayment]);

  useEffect(() => {
     return () => {
        if (quickStream) quickStream.getTracks().forEach(track => track.stop());
        clearInterval(recordingTimerRef.current);
     };
  }, [quickStream]);

  // --- QUICK ACTION LOGIC (Keeping existing logic but ensuring imports) ---
  // ... (Keep existing Quick Action functions: getDefaults, createQuickCard, etc.) ...
  
  const getDefaults = (): CardDefaults => {
    const saved = localStorage.getItem(DEFAULT_SETTINGS_KEY);
    if (saved) return JSON.parse(saved);
    return {
      title: 'Conteúdo Rápido',
      description: 'Toque para liberar.',
      creditCost: 10,
      duration: 60,
      expirySeconds: 0,
      group: 'Geral',
      tags: 'quick',
      blurLevel: 30,
      layoutStyle: 'classic',
      defaultWidth: 250,
      repeatInterval: 0,
      category: 'Premium',
      cardColor: '#0f172a'
    };
  };

  const createQuickCard = (mediaUrl: string, type: CardType, thumbnail?: string) => {
    const defaults = getDefaults();
    const effectiveThumbnail = thumbnail || (type === CardType.AUDIO ? 'https://picsum.photos/seed/audio/800/800' : mediaUrl);
    const newCard: MediaCard = {
      id: Math.random().toString(36).substr(2, 9),
      type: type,
      title: defaults.title,
      description: defaults.description,
      creditCost: defaults.creditCost,
      category: defaults.category,
      tags: defaults.tags.split(',').map(t => t.trim()),
      duration: defaults.duration,
      expirySeconds: defaults.expirySeconds * 60,
      group: defaults.group,
      repeatInterval: defaults.repeatInterval,
      isBlur: true,
      blurLevel: defaults.blurLevel,
      saveToGallery: true,
      mediaType: 'upload',
      thumbnail: effectiveThumbnail,
      mediaUrl: mediaUrl,
      createdAt: Date.now(),
      defaultWidth: defaults.defaultWidth,
      layoutStyle: defaults.layoutStyle,
      cardColor: defaults.cardColor
    };
    onCardCreated(newCard);
  };

  const handleQuickUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      let type = CardType.IMAGE;
      if (file.type.startsWith('video/')) type = CardType.VIDEO;
      if (file.type.startsWith('audio/')) type = CardType.AUDIO;
      const reader = new FileReader();
      reader.onloadend = () => { createQuickCard(reader.result as string, type); };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const startQuickRecording = async (type: 'audio' | 'video' | 'photo') => {
    try {
      const constraints = { audio: type !== 'photo', video: type !== 'audio' };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setQuickStream(stream);
      setQuickRecordingType(type);
      setIsQuickRecording(true);
      setRecordingTime(0);
      if ((type === 'video' || type === 'photo') && quickVideoRef.current) {
        setTimeout(() => { if (quickVideoRef.current) quickVideoRef.current.srcObject = stream; }, 100);
      }
      if (type !== 'photo') {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => { if(e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = () => { /* Card creation moved to stopQuickRecording */ };
        recorder.start();
        recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      }
    } catch (err) { alert('Erro ao acessar dispositivos de mídia.'); }
  };

  const handleQuickPhotoCapture = () => {
    if (quickVideoRef.current && quickStream) {
      const canvas = document.createElement('canvas');
      canvas.width = quickVideoRef.current.videoWidth;
      canvas.height = quickVideoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(quickVideoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        createQuickCard(dataUrl, CardType.IMAGE, dataUrl);
        cleanupQuickRecording();
      }
    }
  };

  const stopQuickRecording = () => {
    let capturedThumbnail: string | undefined = undefined;
    if (quickRecordingType === 'video' && quickVideoRef.current) {
       const canvas = document.createElement('canvas');
       canvas.width = quickVideoRef.current.videoWidth;
       canvas.height = quickVideoRef.current.videoHeight;
       const ctx = canvas.getContext('2d');
       if (ctx) {
          ctx.drawImage(quickVideoRef.current, 0, 0);
          capturedThumbnail = canvas.toDataURL('image/png');
       }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
         const blob = new Blob(chunksRef.current, { type: quickRecordingType === 'video' ? 'video/webm' : 'audio/webm' });
         const url = URL.createObjectURL(blob);
         createQuickCard(url, quickRecordingType === 'video' ? CardType.VIDEO : CardType.AUDIO, capturedThumbnail);
         cleanupQuickRecording();
      };
      mediaRecorderRef.current.stop();
    } else { cleanupQuickRecording(); }
  };

  const cleanupQuickRecording = () => {
    if (quickStream) quickStream.getTracks().forEach(t => t.stop());
    clearInterval(recordingTimerRef.current);
    setIsQuickRecording(false);
    setQuickStream(null);
    setQuickRecordingType(null);
    setRecordingTime(0);
  };

  const cancelQuickRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanupQuickRecording();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ... (Other handlers like Payment, Photos, Session Creation, Messages) ...
  const handleApprovedPayment = (transaction: PaymentTransaction) => {
    if (activePayment?.status === 'approved') return;
    setActivePayment(transaction);
    updateCredits(transaction.credits_amount);
    setTimeout(() => { setShowQrCode(false); setActivePayment(null); setPaymentAmount(null); alert(`Pagamento confirmado! +${transaction.credits_amount} créditos.`); }, 2500);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user.isLoggedIn) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `profiles/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);
    if (uploadError) return alert('Erro ao subir foto.');
    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
    await supabase.from('profiles').update({ profile_photo: publicUrl }).eq('id', user.id);
    user.profilePhoto = publicUrl;
    setProfileRefresh(prev => prev + 1);
  };

  const handleCreateNewSession = () => {
    const newId = 'room-' + Math.random().toString(36).substr(2, 6);
    const newSession = { id: newId, name: `Nova Sala: ${newId.split('-')[1]}`, lastMessage: 'Chat iniciado', time: 'Agora', isActive: false };
    setSessions(prev => [newSession, ...prev]);
    navigate(`/chat/${newId}`);
    setIsMobileMenuOpen(false);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !roomId) return;
    const { error } = await supabase.from('messages').insert([{ room_id: roomId, sender_id: user.id, sender_name: user.name, text: inputText }]);
    if (error) alert('Erro ao enviar');
    setInputText('');
  };

  const onCardCreated = async (card: MediaCard) => {
    if (!roomId) return;
    const { error } = await supabase.from('messages').insert([{ room_id: roomId, sender_id: user.id, sender_name: user.name, card_data: card }]);
    if (error) alert('Erro ao criar card');
    setIsCardModalOpen(false);
    if (card.type === CardType.CHAT) addPrivateSession(card.id, card.title);
    if (card.saveToGallery && user.isLoggedIn) {
      await supabase.from('cards').upsert([{ id: card.id, creator_id: user.id, type: card.type, title: card.title, description: card.description, thumbnail: card.thumbnail, credit_cost: card.creditCost, media_url: card.mediaUrl, category: card.category, tags: card.tags, duration: card.duration, is_blur: card.isBlur, blur_level: card.blurLevel, default_width: card.defaultWidth, group: card.group, repeat_interval: card.repeatInterval, card_color: card.cardColor }]);
    }
  };

  const addPrivateSession = (cardId: string, title: string) => {
    const sessionId = `priv-${cardId}`;
    if (!sessions.find(s => s.id === sessionId)) {
      setSessions(prev => [{ id: sessionId, name: `Privado: ${title}`, lastMessage: 'Sessão iniciada', time: 'Agora', isActive: false }, ...prev]);
    }
  };

  const handleInteractWithCard = async (card: MediaCard) => {
    if (card.type === CardType.CHAT) {
      addPrivateSession(card.id, card.title);
      navigate(`/chat/priv-${card.id}`);
      return true;
    }
    const isMyCard = user.id === card.id || (card as any).creator_id === user.id; 
    if (!isMyCard) {
       if (user.credits < card.creditCost) { setShowQrCode(true); return false; }
       updateCredits(-card.creditCost);
       const earnings = Math.floor(card.creditCost * 0.8);
       if (user.isLoggedIn) {
         const { data: cardData } = await supabase.from('cards').select('creator_id').eq('id', card.id).single();
         if (cardData && cardData.creator_id) {
             await supabase.rpc('process_card_purchase', { p_card_id: card.id, p_buyer_id: user.id, p_creator_id: cardData.creator_id, p_amount: card.creditCost, p_earnings: earnings });
         }
       }
    }
    return true;
  };

  const handleDeleteCard = async (messageId: string) => {
      const { error } = await supabase.from('messages').delete().contains('card_data', { id: messageId });
      if (error) alert("Erro ao excluir.");
  };

  const handleEditCard = (card: MediaCard) => { alert("Edição rápida não implementada neste demo."); };
  
  const handleWithdraw = () => {
    setWithdrawalPending(true);
    setTimeout(() => { alert("Solicitação enviada!"); setWithdrawalPending(false); setShowEarningsModal(false); }, 1500);
  };

  const handleGeneratePix = async () => { /* ... reuse existing logic ... */ 
    if (!paymentAmount || !user.isLoggedIn) { if (!user.isLoggedIn) openAuth(); return; }
    setIsGeneratingPix(true);
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser || !authUser.email) throw new Error("Erro auth.");
      const creditsMap: Record<number, number> = { 5: 50, 10: 120, 20: 300 };
      const credits = creditsMap[paymentAmount] || paymentAmount * 10;
      const { data, error } = await supabase.functions.invoke('mercadopago-create-payment', { body: JSON.stringify({ amount: paymentAmount, description: `${credits} Créditos`, user_id: user.id, credits: credits, email: authUser.email }), headers: { 'Content-Type': 'application/json' } });
      if (error || !data) throw new Error(error?.message || "Erro backend.");
      setActivePayment({ id: data.payment_id_db, qr_code: data.qr_code, qr_code_base64: data.qr_code_base64, status: 'pending', amount: paymentAmount, credits_amount: credits });
    } catch (err: any) { alert(`Falha PIX: ${err.message}`); } finally { setIsGeneratingPix(false); }
  };

  const handleCheckStatus = async () => { /* ... reuse existing ... */ 
    if (!activePayment) return;
    setIsCheckingStatus(true);
    try {
      const { data } = await supabase.from('payment_transactions').select('*').eq('id', activePayment.id).single();
      if (data && data.status === 'approved') handleApprovedPayment(data as PaymentTransaction);
      else alert("Pendente...");
    } finally { setIsCheckingStatus(false); }
  };

  const handleCopyPix = () => { /* ... reuse existing ... */
    if (activePayment?.qr_code) { navigator.clipboard.writeText(activePayment.qr_code); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }
  };

  const SidebarContent = () => (
    <div className={`flex flex-col h-full ${colors.sidebarBg} transition-colors duration-300`}>
      <div className={`p-6 flex flex-col items-center border-b ${colors.border} gap-4`}>
        <div className="flex items-center justify-center gap-4 w-full">
            <div onClick={() => user.isLoggedIn ? fileInputRef.current?.click() : openAuth()} className={`relative w-16 h-16 rounded-[2rem] border-2 ${colors.border} flex items-center justify-center cursor-pointer overflow-hidden group shadow-lg ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
            {user.profilePhoto ? <img src={user.profilePhoto} className="w-full h-full object-cover" key={profileRefresh} /> : <UserIcon size={32} className="text-slate-500" />}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={20} className="text-white" /></div>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />
            </div>
            {user.isLoggedIn && (
                <button onClick={() => setShowEarningsModal(true)} className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-emerald-500 hover:bg-emerald-500/20 transition-all"><DollarSign size={20} /><span className="text-[9px] font-black">{user.earnings}</span></button>
            )}
        </div>
        {!isSidebarCollapsed && (
          <div className="text-center animate-in fade-in">
            <h2 className={`text-xs font-black ${colors.textHighlight} uppercase tracking-[0.2em]`}>{user.name}</h2>
            <div className="flex flex-col gap-1 mt-2"><p className={`text-[9px] ${colors.text} font-bold uppercase`}>{user.isLoggedIn ? 'Autenticado' : 'Visitante'}</p></div>
          </div>
        )}
      </div>
      <div className="p-4 flex items-center justify-between">
        {!isSidebarCollapsed && <h1 className={`text-[10px] font-black ${colors.text} tracking-[0.3em] uppercase`}>Conversas</h1>}
        <button onClick={handleCreateNewSession} className={`p-1.5 ${colors.primarySoft} ${colors.primaryText} rounded-lg hover:opacity-80 transition-all border ${colors.primaryBorder} ${isSidebarCollapsed ? 'mx-auto' : ''}`}><Plus size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
        {sessions.map(session => (
          <div key={session.id} onClick={() => { navigate(`/chat/${session.id}`); setIsMobileMenuOpen(false); }} className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 group ${roomId === session.id ? `${colors.primarySoft} ${colors.primaryBorder}` : `hover:bg-gray-100 dark:hover:bg-slate-800/60 ${colors.border}`} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className={`w-10 h-10 min-w-[2.5rem] rounded-xl flex items-center justify-center transition-colors ${roomId === session.id ? `${colors.primary} text-white shadow-lg` : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>{session.id.startsWith('priv-') ? <Settings size={16} /> : <MessageSquare size={18} />}</div>
            {!isSidebarCollapsed && (<div className="flex-1 min-w-0 animate-in fade-in"><div className="flex justify-between items-center"><h3 className={`text-sm font-semibold truncate ${colors.textHighlight}`}>{session.name}</h3><span className={`text-[10px] ${colors.text}`}>{session.time}</span></div><p className={`text-[11px] ${colors.text} truncate opacity-70`}>{session.lastMessage}</p></div>)}
          </div>
        ))}
      </div>
      <div className={`p-4 border-t ${colors.border}`}>
        {!user.isLoggedIn && !isSidebarCollapsed && (<button onClick={openAuth} className={`w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl ${colors.primarySoft} ${colors.primaryText} border ${colors.primaryBorder} text-[10px] font-black uppercase hover:opacity-80 transition-all`}><LogIn size={14} /> Entrar</button>)}
        <div className="flex items-center justify-between">{!isSidebarCollapsed && <span className={`text-[9px] ${colors.text} font-bold tracking-[0.2em] uppercase`}>v2.3</span>}<button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`hidden md:flex p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 ${colors.text} ${isSidebarCollapsed ? 'mx-auto' : ''}`}>{isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button></div>
      </div>
    </div>
  );

  return (
    <div className={`flex h-screen overflow-hidden ${colors.text} ${colors.bg}`}>
      {isMobileMenuOpen && (<div className="fixed inset-0 z-50 bg-black/80 md:hidden" onClick={() => setIsMobileMenuOpen(false)}><div className="w-[80%] h-full" onClick={e => e.stopPropagation()}><SidebarContent /></div></div>)}
      <aside className={`hidden md:flex flex-col border-r ${colors.border} transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-[80px]' : 'w-[300px]'}`}><SidebarContent /></aside>
      
      <main className={`flex-1 flex flex-col relative ${colors.bg}`}>
        <header className={`h-[64px] border-b ${colors.border} flex items-center justify-between px-4 md:px-6 ${colors.headerBg} backdrop-blur-md`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"><Menu size={20} className={colors.textHighlight} /></button>
            <button onClick={() => navigate('/')} className={`p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg ${colors.text}`}><Home size={20} /></button>
            <div><h2 className={`text-sm font-black ${colors.textHighlight} uppercase tracking-tighter`}>{sessions.find(s => s.id === roomId)?.name || 'Conversa'}</h2><div className="flex items-center gap-2 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div><span className={`text-[9px] font-black ${colors.text} uppercase tracking-widest`}>{isHost ? 'MEU ESPAÇO' : 'ONLINE'}</span></div></div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={toggleTheme} className={`p-2 rounded-xl border ${colors.border} ${colors.text} hover:opacity-70 transition-all`}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <div onClick={() => setShowQrCode(true)} className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-xs border border-emerald-500/20 font-black cursor-pointer hover:bg-emerald-500/20 transition-all`}><Wallet size={16} /><span>{user.credits} c</span></div>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/#/chat/${roomId}`); alert('Link copiado!'); }} className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 ${colors.primarySoft} ${colors.primaryText} rounded-xl border ${colors.primaryBorder} hover:opacity-80 transition-all font-black text-xs uppercase tracking-tighter`}><Share2 size={16} /><span className="hidden sm:inline">Convidar</span></button>
          </div>
        </header>

        {isPrivateLocked ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="p-8 rounded-[3rem] bg-slate-900 border border-slate-800 shadow-2xl animate-in zoom-in">
                    <Lock size={64} className="text-slate-500 mx-auto mb-6" />
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Sala Privada</h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-8">Esta sala é exclusiva e requer acesso.</p>
                    
                    {!user.isLoggedIn ? (
                        <button onClick={openAuth} className="px-8 py-4 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-blue-500 transition-all shadow-xl">
                            Fazer Login para Entrar
                        </button>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-center items-baseline gap-2">
                                <span className="text-4xl font-black text-white">{privateRoomCard?.creditCost || 0}</span>
                                <span className="text-sm font-bold text-slate-500">créditos</span>
                            </div>
                            <button onClick={handleUnlockPrivateRoom} className="w-full px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-xl flex items-center justify-center gap-2">
                                <Zap size={16} /> Pagar e Entrar
                            </button>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Seu saldo: {user.credits} créditos</p>
                        </div>
                    )}
                </div>
            </div>
        ) : (
            <>
                <nav className={`flex px-6 border-b ${colors.border} ${isDark ? 'bg-slate-900/10' : 'bg-gray-100'}`}>
                <button onClick={() => setActiveTab('chat')} className={`px-4 md:px-8 py-4 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'chat' ? `border-b-2 ${isDark ? 'border-blue-500 text-white' : 'border-red-600 text-red-600'}` : `${colors.text} hover:opacity-70`}`}><MessageSquare size={14} /> Feed</button>
                <button onClick={() => setActiveTab('showcase')} className={`px-4 md:px-8 py-4 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'showcase' ? `border-b-2 ${isDark ? 'border-blue-500 text-white' : 'border-red-600 text-red-600'}` : `${colors.text} hover:opacity-70`}`}><LayoutGrid size={14} /> Vitrine</button>
                </nav>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col scrollbar-hide">
                {activeTab === 'chat' ? (
                    <div className="flex-1 space-y-8 max-w-5xl mx-auto w-full py-4 pb-24">
                    {messages.length === 0 && (<div className="h-full flex flex-col items-center justify-center opacity-30 select-none"><div className={`p-8 rounded-[3rem] ${isDark ? 'bg-slate-800/40 border-white/5' : 'bg-gray-200 border-black/5'} mb-4`}><MessageSquare size={48} className={colors.text} /></div><span className={`text-[10px] ${colors.text} border ${colors.border} px-6 py-2 rounded-full uppercase tracking-[0.4em] font-black`}>Silêncio no chat...</span></div>)}
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.senderId === user.id ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-3 duration-500`}>
                        {msg.text && (<div className={`max-w-[85%] md:max-w-[80%] px-5 py-3.5 rounded-2xl text-sm shadow-sm font-medium ${msg.senderId === user.id ? `${colors.primary} text-white rounded-tr-none` : `${isDark ? 'bg-slate-800/80 text-slate-200 border-slate-700/30' : 'bg-white text-slate-800 border-gray-200'} border rounded-tl-none`}`}>{msg.text}</div>)}
                        {msg.card && (<MediaCardItem card={msg.card} canManage={msg.senderId === user.id} onUnlock={() => handleInteractWithCard(msg.card!)} isHostMode={isHost} onDelete={() => handleDeleteCard(msg.card!.id)} onEdit={() => handleEditCard(msg.card!)} />)}
                        <span className={`text-[9px] ${colors.text} mt-2 uppercase font-black tracking-widest px-1 opacity-60`}>{msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                    </div>
                ) : (
                    <div className="max-w-6xl mx-auto w-full pb-24"><Gallery user={user} /></div>
                )}
                </div>

                <div className={`absolute bottom-0 left-0 right-0 p-4 md:p-6 border-t ${colors.border} ${isDark ? 'bg-[#070d18]/90' : 'bg-white/90'} backdrop-blur-md`}>
                <div className="max-w-4xl mx-auto">
                    <input type="file" ref={quickUploadRef} onChange={handleQuickUpload} className="hidden" accept="image/*,video/*,audio/*" />
                    {isQuickRecording ? (
                        <div className="w-full h-14 bg-slate-900 rounded-2xl border border-red-500/30 flex items-center justify-between px-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-3"><div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" /><span className="text-red-500 font-mono font-black">{formatTime(recordingTime)}</span><span className="text-slate-500 text-xs uppercase font-bold tracking-wider">{quickRecordingType === 'photo' ? 'Câmera Ativa' : `Gravando ${quickRecordingType === 'audio' ? 'Áudio' : 'Vídeo'}...`}</span></div>
                        {(quickRecordingType === 'video' || quickRecordingType === 'photo') && (<video ref={quickVideoRef} autoPlay muted playsInline className="h-10 w-16 bg-black rounded object-cover border border-slate-700" />)}
                        <div className="flex gap-2">
                            <button onClick={cancelQuickRecording} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"><Trash2 size={20} /></button>
                            {quickRecordingType === 'photo' ? (<button onClick={handleQuickPhotoCapture} className="p-2 rounded-lg bg-white text-black hover:bg-slate-200 transition-all shadow-lg"><Aperture size={20} /></button>) : (<button onClick={stopQuickRecording} className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-all shadow-lg shadow-red-500/20"><Send size={20} /></button>)}
                        </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 md:gap-3">
                        <button onClick={() => quickUploadRef.current?.click()} className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-200 text-slate-500 hover:bg-gray-300'} rounded-2xl transition-all`} title="Upload Rápido"><Upload size={20} /></button>
                        <button onClick={() => startQuickRecording('photo')} className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-200 text-slate-500 hover:bg-gray-300'} rounded-2xl transition-all`} title="Foto Rápida"><Camera size={20} /></button>
                        <button onClick={() => setIsCardModalOpen(true)} className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center ${colors.primary} text-white rounded-2xl shadow-xl hover:opacity-90 transform hover:-translate-y-1 transition-all`} title="Criar Card Avançado"><Plus size={24} /></button>
                        <div className={`flex-1 ${colors.inputBg} rounded-2xl border ${colors.border} flex items-center px-4 focus-within:border-current transition-all ${isDark ? 'focus-within:border-blue-500/50' : 'focus-within:border-red-500/50'}`}><input value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Mensagem..." className={`w-full bg-transparent border-none text-sm py-4 md:py-5 ${colors.textHighlight} outline-none placeholder:opacity-50 font-medium`} /></div>
                        <div className="flex gap-2">
                            <button onClick={() => startQuickRecording('audio')} className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:text-red-400' : 'bg-gray-200 text-slate-500 hover:text-red-500'} rounded-2xl transition-all`} title="Áudio Rápido"><Mic size={20} /></button>
                            <button onClick={() => startQuickRecording('video')} className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:text-blue-400' : 'bg-gray-200 text-slate-500 hover:text-blue-500'} rounded-2xl transition-all`} title="Vídeo Rápido"><Video size={20} /></button>
                            <button onClick={handleSendMessage} disabled={!inputText.trim()} className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center ${colors.primary} text-white rounded-2xl hover:opacity-90 shadow-xl transition-all disabled:opacity-20`}><Send size={20} /></button>
                        </div>
                        </div>
                    )}
                </div>
                </div>
            </>
        )}

        {isCardModalOpen && <CardModal onClose={() => setIsCardModalOpen(false)} onSubmit={onCardCreated} userId={user.id} />}
        {showEarningsModal && (
           <div className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] w-full max-w-md shadow-2xl relative">
                  <button onClick={() => setShowEarningsModal(false)} className="absolute top-6 right-6 p-2 bg-slate-800 rounded-full text-white"><X size={20} /></button>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-1">Seus Ganhos</h3>
                  <p className="text-slate-500 text-xs mb-8">Receba 80% do valor de cada card desbloqueado.</p>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl mb-6 text-center"><span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-2">Disponível para Saque</span><span className="text-4xl font-black text-white">{user.earnings} <span className="text-lg text-slate-500">Créditos</span></span></div>
                  <button onClick={handleWithdraw} disabled={user.earnings < 100 || withdrawalPending} className="w-full py-4 bg-white text-slate-900 font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-slate-200 flex items-center justify-center gap-2 disabled:opacity-50">{withdrawalPending ? <Loader2 className="animate-spin" /> : <ArrowUpRight size={16} />}{withdrawalPending ? 'Processando...' : 'Solicitar Saque (24h)'}</button>
                  <p className="text-[9px] text-center text-slate-500 mt-4 uppercase font-bold">Mínimo para saque: 100 créditos</p>
              </div>
           </div>
        )}
        {showQrCode && ( /* ... Existing QR Code Modal ... */ 
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in">
            <div className={`bg-slate-900 border border-slate-800 p-8 rounded-[3rem] w-full max-w-sm flex flex-col items-center gap-6 shadow-2xl relative`}>
              <div className="w-full flex justify-between items-center mb-2">
                <h3 className="font-black text-white uppercase tracking-tighter text-xl">Recarregar</h3>
                <button onClick={() => { setShowQrCode(false); setActivePayment(null); setPaymentAmount(null); }} className="p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400"><X size={24} /></button>
              </div>
              {!activePayment ? (
                <>
                  <div className="space-y-3 w-full">
                    <button onClick={() => setPaymentAmount(5)} className={`w-full p-4 rounded-2xl border transition-all flex justify-between items-center ${paymentAmount === 5 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}><span className="font-bold text-sm">50 Créditos</span><span className="font-black text-lg">R$ 5,00</span></button>
                    <button onClick={() => setPaymentAmount(10)} className={`w-full p-4 rounded-2xl border transition-all flex justify-between items-center ${paymentAmount === 10 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}><div><span className="font-bold text-sm block">120 Créditos</span><span className="text-[9px] bg-emerald-500 text-slate-900 px-2 py-0.5 rounded font-black uppercase">Mais Popular</span></div><span className="font-black text-lg">R$ 10,00</span></button>
                    <button onClick={() => setPaymentAmount(20)} className={`w-full p-4 rounded-2xl border transition-all flex justify-between items-center ${paymentAmount === 20 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}><div><span className="font-bold text-sm block">300 Créditos</span><span className="text-[9px] bg-indigo-500 text-white px-2 py-0.5 rounded font-black uppercase">Super Bônus</span></div><span className="font-black text-lg">R$ 20,00</span></button>
                  </div>
                  <button onClick={handleGeneratePix} disabled={!paymentAmount || isGeneratingPix} className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.3em] shadow-2xl hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">{isGeneratingPix ? <Loader2 className="animate-spin" /> : <QrCode size={18} />}{isGeneratingPix ? 'Gerando PIX...' : 'Gerar PIX Agora'}</button>
                </>
              ) : activePayment.status === 'approved' ? (
                 <div className="flex flex-col items-center justify-center py-10 space-y-4 animate-in zoom-in"><CheckCircle size={64} className="text-emerald-500" /><h3 className="text-2xl font-black text-white uppercase tracking-tighter">Pagamento Aprovado!</h3><p className="text-slate-400 text-sm">Seus créditos foram adicionados.</p></div>
              ) : (
                <div className="flex flex-col items-center w-full animate-in fade-in">
                  <div className="p-4 bg-white rounded-3xl mb-4 relative"><img src={`data:image/png;base64,${activePayment.qr_code_base64}`} alt="QR Code PIX" className="w-48 h-48 mix-blend-multiply" />{activePayment.status === 'pending' && (<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="bg-slate-900/10 backdrop-blur-[1px] absolute inset-0 rounded-3xl" /><Loader2 className="animate-spin text-slate-900 w-8 h-8 relative z-10" /></div>)}</div>
                  <div className="text-center mb-6"><p className="text-white font-bold text-lg">R$ {activePayment.amount.toFixed(2).replace('.', ',')}</p><p className="text-slate-500 text-xs mt-1">Escaneie o QR Code ou copie o código abaixo</p></div>
                  <div className="w-full flex flex-col gap-3"><div className="w-full flex gap-2"><div className="flex-1 bg-slate-800 rounded-xl p-3 border border-slate-700 overflow-hidden"><p className="text-slate-400 text-xs truncate font-mono">{activePayment.qr_code}</p></div><button onClick={handleCopyPix} className={`p-3 rounded-xl border transition-all ${copySuccess ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'}`}>{copySuccess ? <CheckCircle size={20} /> : <Copy size={20} />}</button></div><button onClick={handleCheckStatus} disabled={isCheckingStatus} className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2">{isCheckingStatus ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />} Já Paguei / Verificar</button></div>
                  <div className="mt-4 flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest"><div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" /> Aguardando confirmação...</div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ChatRoom;
