
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Plus, Home, Wallet, Share2, MessageSquare, LayoutGrid, QrCode, X, User as UserIcon, LogIn, Camera, Settings, Sun, Moon, Menu, ChevronLeft, ChevronRight, Copy, CheckCircle, Loader2, RefreshCw, DollarSign, ArrowUpRight, Mic, Video, Upload, StopCircle, Trash2, Aperture, Lock, Zap, History, CreditCard, Mail, ShoppingCart } from 'lucide-react';
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

interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
  estimated_payout_at: string;
}

interface Sale {
  id: string;
  buyer_name: string;
  card_title: string;
  amount: number;
  created_at: string;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ user, updateCredits, openAuth, theme, toggleTheme }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Card Creation/Editing
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<MediaCard | null>(null);

  const [activeTab, setActiveTab] = useState<'chat' | 'showcase'>('chat');
  const [showQrCode, setShowQrCode] = useState(false);
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [withdrawalPending, setWithdrawalPending] = useState(false);
  
  // Withdrawal & Sales State
  const [withdrawalMethod, setWithdrawalMethod] = useState<'pix' | 'picpay' | 'paypal' | 'stripe'>('pix');
  const [withdrawalKey, setWithdrawalKey] = useState('');
  const [withdrawalHistory, setWithdrawalHistory] = useState<Withdrawal[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  
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

  // Load Withdrawal Settings & History when modal opens
  useEffect(() => {
    if (showEarningsModal && user.isLoggedIn) {
        const fetchSettings = async () => {
            const { data } = await supabase.from('profiles').select('pix_key, picpay_email, paypal_email, stripe_email').eq('id', user.id).single();
            if (data) {
                if (withdrawalMethod === 'pix') setWithdrawalKey(data.pix_key || '');
                else if (withdrawalMethod === 'picpay') setWithdrawalKey(data.picpay_email || '');
                else if (withdrawalMethod === 'paypal') setWithdrawalKey(data.paypal_email || '');
                else if (withdrawalMethod === 'stripe') setWithdrawalKey(data.stripe_email || '');
            }
            
            const { data: history } = await supabase.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            if (history) setWithdrawalHistory(history as any);

            const { data: sales } = await supabase.from('sales_transactions').select('*').eq('seller_id', user.id).order('created_at', { ascending: false });
            if (sales) setSalesHistory(sales as any);
        };
        fetchSettings();
    }
  }, [showEarningsModal, user.isLoggedIn, withdrawalMethod]);

  // PRIVATE ROOM GATEKEEPER CHECK
  useEffect(() => {
    const checkPrivateAccess = async () => {
        setIsPrivateLocked(false);
        setPrivateRoomCard(null);

        if (roomId?.startsWith('priv-')) {
            const cardId = roomId.split('priv-')[1];
            const { data: cardData, error } = await supabase.from('cards').select('*').eq('id', cardId).single();
            
            if (error || !cardData) return;

            const mediaCard = { ...cardData, type: cardData.type as CardType } as MediaCard;
            setPrivateRoomCard(mediaCard);

            if (user.isLoggedIn && (user.id === cardData.creator_id)) return;

            setIsPrivateLocked(true);
        }
    };
    checkPrivateAccess();
  }, [roomId, user.id, user.isLoggedIn]);

  const handleUnlockPrivateRoom = async () => {
      if (!user.isLoggedIn) { openAuth(); return; }
      if (!privateRoomCard) return;
      if (user.credits < privateRoomCard.creditCost) { setShowQrCode(true); return; }

      updateCredits(-privateRoomCard.creditCost);
      const earnings = Math.floor(privateRoomCard.creditCost * 0.8);
      // Use direct property access now that type definition is updated
      if (privateRoomCard.creator_id) { 
          await supabase.rpc('process_card_purchase', { 
               p_card_id: privateRoomCard.id, 
               p_buyer_id: user.id, 
               p_creator_id: privateRoomCard.creator_id, 
               p_amount: privateRoomCard.creditCost, 
               p_earnings: earnings 
          });
          
          // Log sales transaction manually for history display
          await supabase.from('sales_transactions').insert([{
              seller_id: privateRoomCard.creator_id,
              buyer_id: user.id,
              buyer_name: user.name,
              card_id: privateRoomCard.id,
              card_title: privateRoomCard.title,
              amount: earnings
          }]);
      }
      setIsPrivateLocked(false);
      alert(`Sala desbloqueada! -${privateRoomCard.creditCost} créditos.`);
  };

  useEffect(() => {
    if (!roomId) return;
    if (isPrivateLocked) return; 

    const fetchMessages = async () => {
      const { data } = await supabase.from('messages').select('*').eq('room_id', roomId).order('created_at', { ascending: true });
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

    const channel = supabase.channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, 
      (payload) => {
        const m = payload.new;
        setMessages(prev => [...prev, { id: m.id, senderId: m.sender_id, senderName: m.sender_name, text: m.text, card: m.card_data, timestamp: new Date(m.created_at).getTime() }]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      (payload) => { setMessages(prev => prev.filter(m => m.id !== payload.old.id)); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      (payload) => { 
          const m = payload.new;
          setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, card: m.card_data, text: m.text } : msg));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, isPrivateLocked]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, activeTab]);

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

  // --- HANDLERS ---

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user.isLoggedIn) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}.${fileExt}`; // Fixed filename for profile to avoid accumulation
    const filePath = `profiles/${fileName}`;
    
    // Use upsert to overwrite existing file
    const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file, { upsert: true });
    
    if (uploadError) {
        console.error(uploadError);
        return alert('Erro ao subir foto. Verifique permissões ou tamanho do arquivo.');
    }
    
    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
    const publicUrlWithTimestamp = `${publicUrl}?t=${Date.now()}`; // Bust cache
    
    // Update Supabase
    await supabase.from('profiles').update({ profile_photo: publicUrlWithTimestamp }).eq('id', user.id);
    
    // Update local state and force re-render
    user.profilePhoto = publicUrlWithTimestamp;
    setProfileRefresh(prev => prev + 1); 
  };

  const onCardCreated = async (card: MediaCard) => {
    if (!roomId) return;
    
    if (editingCard) {
        // UPDATE existing message
        const { error } = await supabase.from('messages')
            .update({ card_data: card })
            .contains('card_data', { id: editingCard.id }); 
            
        if (error) alert('Erro ao atualizar card');
        
        await supabase.from('cards').update({
            title: card.title,
            description: card.description,
            credit_cost: card.creditCost,
            group: card.group,
            tags: card.tags,
            thumbnail: card.thumbnail,
            media_url: card.mediaUrl
        }).eq('id', editingCard.id);

    } else {
        // CREATE new message
        const { error } = await supabase.from('messages').insert([{
          room_id: roomId,
          sender_id: user.id,
          sender_name: user.name,
          card_data: card
        }]);
        if (error) alert('Erro ao criar card');
        
        if (card.type === CardType.CHAT) addPrivateSession(card.id, card.title);
        if (card.saveToGallery && user.isLoggedIn) {
          await supabase.from('cards').upsert([{
            id: card.id,
            creator_id: user.id,
            type: card.type,
            title: card.title,
            description: card.description,
            thumbnail: card.thumbnail,
            credit_cost: card.creditCost,
            media_url: card.mediaUrl,
            category: card.category,
            tags: card.tags,
            duration: card.duration,
            is_blur: card.isBlur,
            blur_level: card.blurLevel,
            default_width: card.defaultWidth,
            group: card.group,
            repeat_interval: card.repeatInterval,
            card_color: card.cardColor
          }]);
        }
    }
    setIsCardModalOpen(false);
    setEditingCard(null);
  };

  const handleEditCard = (card: MediaCard) => {
      setEditingCard(card);
      setIsCardModalOpen(true);
  };

  const handleDeleteCard = async (cardId: string) => {
      const { error } = await supabase.from('messages').delete().contains('card_data', { id: cardId });
      if (error) alert("Erro ao excluir.");
      // Also try deleting from 'cards' table just in case
      await supabase.from('cards').delete().eq('id', cardId);
  };

  const handleWithdraw = async () => {
    if (!withdrawalKey) return alert("Por favor, preencha os dados de pagamento.");
    setWithdrawalPending(true);
    
    // Save withdrawal request to history
    const { error } = await supabase.from('withdrawals').insert([{
        user_id: user.id,
        amount: user.earnings,
        method: withdrawalMethod,
        target_key: withdrawalKey,
        status: 'pending',
        estimated_payout_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
    }]);

    // Save preferences
    const updateData: any = {};
    if (withdrawalMethod === 'pix') updateData.pix_key = withdrawalKey;
    if (withdrawalMethod === 'picpay') updateData.picpay_email = withdrawalKey;
    if (withdrawalMethod === 'paypal') updateData.paypal_email = withdrawalKey;
    if (withdrawalMethod === 'stripe') updateData.stripe_email = withdrawalKey;
    
    await supabase.from('profiles').update(updateData).eq('id', user.id);

    if (error) {
        alert("Erro ao solicitar saque.");
    } else {
        alert("Solicitação de saque enviada! O processamento leva 24 horas.");
        setShowEarningsModal(false);
    }
    setWithdrawalPending(false);
  };

  // ... (Keep existing helpers like addPrivateSession, handleInteractWithCard, etc.) ...
  const addPrivateSession = (cardId: string, title: string) => {
    const sessionId = `priv-${cardId}`;
    if (!sessions.find(s => s.id === sessionId)) {
      setSessions(prev => [{ id: sessionId, name: `Privado: ${title}`, lastMessage: 'Sessão iniciada', time: 'Agora', isActive: false }, ...prev]);
    }
  };

  const handleInteractWithCard = async (card: MediaCard): Promise<boolean> => {
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
             
             // Log transaction for frontend history
             await supabase.from('sales_transactions').insert([{
                 seller_id: cardData.creator_id,
                 buyer_id: user.id,
                 buyer_name: user.name,
                 card_id: card.id,
                 card_title: card.title,
                 amount: earnings
             }]);
         }
       }
    }
    return true;
  };

  const handleApprovedPayment = (transaction: PaymentTransaction) => {
    if (activePayment?.status === 'approved') return;
    setActivePayment(transaction);
    updateCredits(transaction.credits_amount);
    setTimeout(() => { setShowQrCode(false); setActivePayment(null); setPaymentAmount(null); alert(`Pagamento confirmado! +${transaction.credits_amount} créditos.`); }, 2500);
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

  // Quick Action functions
  const createQuickCard = (mediaUrl: string, type: CardType, thumbnail?: string) => {
    const newCard: MediaCard = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        title: 'Quick Capture',
        description: 'Captured via Quick Actions',
        creditCost: 0,
        category: 'Quick',
        group: 'General',
        tags: [],
        duration: 0,
        expirySeconds: 0,
        repeatInterval: 0,
        isBlur: false,
        blurLevel: 0,
        saveToGallery: false,
        createdAt: Date.now(),
        mediaType: 'upload',
        mediaUrl: mediaUrl,
        thumbnail: thumbnail || mediaUrl,
        defaultWidth: 250,
        layoutStyle: 'classic',
        cardColor: '#0f172a'
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
      const constraints = { 
          audio: type !== 'photo', 
          video: type !== 'audio' ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user"
          } : false 
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setQuickStream(stream);
      setQuickRecordingType(type);
      setIsQuickRecording(true);
      setRecordingTime(0);
      
      if ((type === 'video' || type === 'photo') && quickVideoRef.current) {
        // Delay slighty to ensure element is rendered
        setTimeout(() => { 
            if (quickVideoRef.current) {
                quickVideoRef.current.srcObject = stream; 
                quickVideoRef.current.play().catch(e => console.log("Play error", e));
            }
        }, 100);
      }
      
      if (type !== 'photo') {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => { if(e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = () => {
             const blob = new Blob(chunksRef.current, { type: quickRecordingType === 'video' ? 'video/webm' : 'audio/webm' });
             const url = URL.createObjectURL(blob);
             
             let capturedThumbnail: string | undefined = undefined;
             // Try to capture last frame as thumb if video
             if (quickRecordingType === 'video' && quickVideoRef.current) {
                try {
                   const canvas = document.createElement('canvas');
                   canvas.width = quickVideoRef.current.videoWidth;
                   canvas.height = quickVideoRef.current.videoHeight;
                   const ctx = canvas.getContext('2d');
                   if (ctx) {
                      ctx.drawImage(quickVideoRef.current, 0, 0);
                      capturedThumbnail = canvas.toDataURL('image/jpeg', 0.8);
                   }
                } catch(e) { console.error("Thumb error", e); }
             }

             createQuickCard(url, quickRecordingType === 'video' ? CardType.VIDEO : CardType.AUDIO, capturedThumbnail);
             cleanupQuickRecording();
        };
        recorder.start();
        recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      }
    } catch (err) { 
        console.error(err);
        alert('Erro ao acessar dispositivos de mídia. Verifique as permissões.'); 
    }
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else { cleanupQuickRecording(); }
  };

  const cancelQuickRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Remove onstop handler to prevent creation
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanupQuickRecording();
  };

  const cleanupQuickRecording = () => {
    if (quickStream) quickStream.getTracks().forEach(t => t.stop());
    clearInterval(recordingTimerRef.current);
    setIsQuickRecording(false);
    setQuickStream(null);
    setQuickRecordingType(null);
    setRecordingTime(0);
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

  const handleCopyPix = () => {
    if (activePayment?.qr_code) { navigator.clipboard.writeText(activePayment.qr_code); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }
  };
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
            {/* Earnings Icon in Sidebar - Re-added for visibility */}
            {user.isLoggedIn && (
                <button onClick={() => setShowEarningsModal(true)} className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-emerald-500 hover:bg-emerald-500/20 transition-all cursor-pointer">
                    <DollarSign size={20} />
                    <span className="text-[9px] font-black">{user.earnings}</span>
                </button>
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
          {/* Header Content */}
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"><Menu size={20} className={colors.textHighlight} /></button>
            <button onClick={() => navigate('/')} className={`p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg ${colors.text}`}><Home size={20} /></button>
            <div><h2 className={`text-sm font-black ${colors.textHighlight} uppercase tracking-tighter`}>{sessions.find(s => s.id === roomId)?.name || 'Conversa'}</h2><div className="flex items-center gap-2 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div><span className={`text-[9px] font-black ${colors.text} uppercase tracking-widest`}>{isHost ? 'MEU ESPAÇO' : 'ONLINE'}</span></div></div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={toggleTheme} className={`p-2 rounded-xl border ${colors.border} ${colors.text} hover:opacity-70 transition-all`}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <div onClick={() => setShowQrCode(true)} className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-xs border border-emerald-500/20 font-black cursor-pointer hover:bg-emerald-500/20 transition-all`}><Wallet size={16} /><span>{user.credits} c</span></div>
            {/* Added Earnings Icon to Header for ease of access */}
            {user.isLoggedIn && (
                <button onClick={() => setShowEarningsModal(true)} className="flex sm:hidden items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 font-black">
                    <DollarSign size={16} />
                </button>
            )}
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

                <div className={`absolute bottom-0 left-0 right-0 p-4 md:p-6 border-t ${colors.border} ${isDark ? 'bg-[#070d18]/90' : 'bg-white/90'} backdrop-blur-md transition-all duration-300`}>
                <div className="max-w-4xl mx-auto">
                    {/* ... (Existing Quick Input) ... */}
                    <input type="file" ref={quickUploadRef} onChange={handleQuickUpload} className="hidden" accept="image/*,video/*,audio/*" />
                    {isQuickRecording ? (
                        <div className="w-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-5">
                            {/* ENHANCED VIDEO PREVIEW CONTAINER */}
                            {(quickRecordingType === 'video' || quickRecordingType === 'photo') && (
                                <div className="relative w-full h-64 md:h-80 bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
                                    <video 
                                        ref={quickVideoRef} 
                                        autoPlay 
                                        muted 
                                        playsInline 
                                        className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
                                    />
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <div className="w-16 h-16 border-2 border-white/20 rounded-full border-dashed animate-spin-slow" />
                                    </div>
                                    <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full flex items-center gap-2 backdrop-blur-md">
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                        <span className="text-white font-mono font-black text-xs uppercase tracking-wider">
                                            {quickRecordingType === 'photo' ? 'CÂMERA ATIVA' : `GRAVANDO • ${formatTime(recordingTime)}`}
                                        </span>
                                    </div>
                                </div>
                            )}
                            
                            {/* RECORDING CONTROLS BAR */}
                            <div className="w-full h-16 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between px-4 shadow-xl">
                                {quickRecordingType === 'audio' && (
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                            <Mic className="text-red-500 animate-pulse" size={20} />
                                        </div>
                                        <div className="h-8 flex gap-1 items-center">
                                            {[...Array(5)].map((_,i) => (
                                                <div key={i} className="w-1 bg-slate-700 rounded-full animate-pulse" style={{ height: Math.random() * 20 + 10 + 'px', animationDelay: i * 0.1 + 's' }} />
                                            ))}
                                        </div>
                                        <span className="text-white font-mono font-bold">{formatTime(recordingTime)}</span>
                                    </div>
                                )}
                                
                                {(quickRecordingType === 'video' || quickRecordingType === 'photo') && <div />} 

                                <div className="flex gap-2 ml-auto">
                                    <button onClick={cancelQuickRecording} className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:bg-red-900/30 hover:text-red-500 transition-all border border-slate-700"><Trash2 size={20} /></button>
                                    {quickRecordingType === 'photo' ? (
                                        <button onClick={handleQuickPhotoCapture} className="px-6 py-3 rounded-xl bg-white text-black hover:bg-slate-200 transition-all shadow-lg font-black uppercase text-xs tracking-widest flex items-center gap-2"><Aperture size={18} /> Capturar</button>
                                    ) : (
                                        <button onClick={stopQuickRecording} className="px-6 py-3 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-all shadow-lg shadow-red-500/20 font-black uppercase text-xs tracking-widest flex items-center gap-2"><StopCircle size={18} /> Parar</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ... (Same simplified input bar logic as previous) ... */
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

        {isCardModalOpen && <CardModal onClose={() => { setIsCardModalOpen(false); setEditingCard(null); }} onSubmit={onCardCreated} userId={user.id} initialData={editingCard} />}
        
        {/* Earnings Modal with Withdraw Tabs */}
        {showEarningsModal && (
           <div className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-hide">
                  <button onClick={() => setShowEarningsModal(false)} className="absolute top-6 right-6 p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-all"><X size={20} /></button>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-6">Central de Ganhos</h3>
                  
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl mb-8 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-20"><DollarSign size={64} className="text-emerald-500" /></div>
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-2 relative z-10">Disponível para Saque</span>
                      <span className="text-5xl font-black text-white relative z-10 tracking-tight">{user.earnings} <span className="text-sm font-bold text-slate-500">CR</span></span>
                  </div>

                  <div className="mb-6">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Método de Recebimento</label>
                      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                          <button onClick={() => setWithdrawalMethod('pix')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${withdrawalMethod === 'pix' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}><QrCode size={14} /> PIX</button>
                          <button onClick={() => setWithdrawalMethod('picpay')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${withdrawalMethod === 'picpay' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}><Wallet size={14} /> PicPay</button>
                          <button onClick={() => setWithdrawalMethod('paypal')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${withdrawalMethod === 'paypal' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}><CreditCard size={14} /> PayPal</button>
                          <button onClick={() => setWithdrawalMethod('stripe')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${withdrawalMethod === 'stripe' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}><CreditCard size={14} /> Stripe</button>
                      </div>
                      
                      <input 
                        value={withdrawalKey}
                        onChange={(e) => setWithdrawalKey(e.target.value)}
                        placeholder={withdrawalMethod === 'pix' ? "Chave PIX (CPF, Email, Aleatória)" : "Seu E-mail da conta"}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                      />
                  </div>

                  <button 
                    onClick={handleWithdraw} 
                    disabled={user.earnings < 100 || withdrawalPending || !withdrawalKey}
                    className="w-full py-4 bg-white text-slate-900 font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-slate-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all mb-4"
                  >
                    {withdrawalPending ? <Loader2 className="animate-spin" /> : <ArrowUpRight size={16} />}
                    {withdrawalPending ? 'Processando...' : 'Solicitar Saque (24h)'}
                  </button>
                  <p className="text-[9px] text-center text-slate-500 uppercase font-bold mb-8">Mínimo para saque: 100 créditos</p>

                  <div className="border-t border-slate-800 pt-6">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><History size={12} /> Histórico de Saques</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide mb-6">
                          {withdrawalHistory.length === 0 ? (
                              <p className="text-center text-slate-600 text-xs italic">Nenhum saque registrado.</p>
                          ) : (
                              withdrawalHistory.map(w => (
                                  <div key={w.id} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl">
                                      <div className="flex flex-col">
                                          <span className="text-white font-bold text-xs">{w.amount} CR</span>
                                          <span className="text-[9px] text-slate-500 uppercase">{w.method}</span>
                                      </div>
                                      <div className="text-right">
                                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${w.status === 'paid' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-yellow-500/20 text-yellow-500'}`}>{w.status}</span>
                                          <span className="text-[8px] text-slate-600 block mt-1">{new Date(w.created_at).toLocaleDateString()}</span>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>

                      {/* SALES HISTORY SECTION */}
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><ShoppingCart size={12} /> Histórico de Vendas (Quem comprou)</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
                          {salesHistory.length === 0 ? (
                              <p className="text-center text-slate-600 text-xs italic">Nenhuma venda realizada ainda.</p>
                          ) : (
                              salesHistory.map(sale => (
                                  <div key={sale.id} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                                      <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-xs">
                                              {sale.buyer_name ? sale.buyer_name.charAt(0).toUpperCase() : '?'}
                                          </div>
                                          <div className="flex flex-col max-w-[120px]">
                                              <span className="text-white font-bold text-xs truncate">{sale.buyer_name || 'Usuário'}</span>
                                              <span className="text-[9px] text-slate-500 truncate">{sale.card_title}</span>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <span className="text-emerald-400 font-black text-xs">+{sale.amount} CR</span>
                                          <span className="text-[8px] text-slate-600 block mt-1">{new Date(sale.created_at).toLocaleDateString()}</span>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>
           </div>
        )}
        
        {/* ... (Existing QR Code Modal) ... */}
      </main>
    </div>
  );
};

export default ChatRoom;
