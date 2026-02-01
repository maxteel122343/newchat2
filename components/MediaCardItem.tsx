
import React, { useState, useEffect, useRef } from 'react';
import { Lock, Play, Volume2, Camera, Phone, MessageSquare, Eye, Clock, Tag, MoreVertical, X, Check, Maximize2, DownloadCloud, Timer, ImageOff, Trash2, Edit, AlertTriangle, LogIn, Link as LinkIcon } from 'lucide-react';
import { MediaCard, CardType } from '../types';

interface MediaCardItemProps {
  card: MediaCard;
  canManage: boolean;
  onUnlock: () => boolean | Promise<boolean>;
  isHostMode: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (card: MediaCard) => void;
}

const MediaCardItem: React.FC<MediaCardItemProps> = ({ card, canManage, onUnlock, isHostMode, onDelete, onEdit }) => {
  const [isUnlocked, setIsUnlocked] = useState(canManage);
  const [showSession, setShowSession] = useState(false);
  const [timeLeft, setTimeLeft] = useState(card.duration);
  const [callStatus, setCallStatus] = useState<'none' | 'requesting' | 'accepted' | 'declined'>('none');
  const [cardWidth, setCardWidth] = useState(card.defaultWidth || 200);
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  const bgColor = card.cardColor || '#0a111f';

  useEffect(() => {
    let timer: any;
    if (showSession && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setShowSession(false);
      setTimeLeft(card.duration);
    }
    return () => clearInterval(timer);
  }, [showSession, timeLeft, card.duration]);

  useEffect(() => {
    if (card.expirySeconds && card.expirySeconds > 0) {
      if (card.id === 'preview') {
         setExpiresIn(card.expirySeconds);
         return;
      }
      const expirationTime = card.createdAt + (card.expirySeconds * 1000);
      const updateExpiry = () => {
        const now = Date.now();
        const diff = Math.floor((expirationTime - now) / 1000);
        if (diff <= 0) setExpiresIn(0);
        else setExpiresIn(diff);
      };
      updateExpiry();
      const interval = setInterval(updateExpiry, 1000);
      return () => clearInterval(interval);
    } else {
      setExpiresIn(null);
    }
  }, [card.expirySeconds, card.createdAt, card.id]);

  useEffect(() => {
      if (canManage) setIsUnlocked(true);
  }, [canManage]);

  const handleInteraction = async () => {
    if (expiresIn === 0) return;
    if (card.type === CardType.CHAT) {
        await onUnlock(); 
        return;
    }
    if (isUnlocked) {
      if (card.type === CardType.AUDIO_CALL || card.type === CardType.VIDEO_CALL) {
        if (callStatus === 'none') setCallStatus('requesting');
        else if (callStatus === 'accepted') setShowSession(true);
      } else {
        setShowSession(true);
      }
      return;
    }
    
    // Handle potential promise from onUnlock
    const result = onUnlock();
    const success = result instanceof Promise ? await result : result;

    if (success) {
      setIsUnlocked(true);
      if (card.type === CardType.AUDIO_CALL || card.type === CardType.VIDEO_CALL) setCallStatus('requesting');
      else setShowSession(true);
    }
  };

  const handleCopyLink = (e: React.MouseEvent) => {
      e.stopPropagation();
      const baseUrl = window.location.origin + window.location.pathname;
      const link = `${baseUrl}#/chat/priv-${card.id}`;
      navigator.clipboard.writeText(link);
      alert("Link da sala privada copiado!");
  };

  const handleDeleteAttempt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (expiresIn !== null && expiresIn > 0) {
        if (window.confirm(`ATENÇÃO: Card ativo por ${formatExpiry(expiresIn)}. Excluir agora?`)) onDelete(card.id);
    } else {
        if (window.confirm("Excluir este card permanentemente?")) onDelete(card.id);
    }
  };

  const handleEditAttempt = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onEdit) onEdit(card);
  }

  const handleDownload = async () => {
    if (!card.mediaUrl) return;
    try {
      const response = await fetch(card.mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${card.title.replace(/\s+/g, '_')}_LinkCard.${card.type === CardType.VIDEO ? 'mp4' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Erro ao baixar:", e);
      window.open(card.mediaUrl, '_blank');
    }
  };

  const getIcon = () => {
    switch (card.type) {
      case CardType.VIDEO: return <Play size={20} />;
      case CardType.AUDIO: return <Volume2 size={20} />;
      case CardType.IMAGE: return <Eye size={20} />;
      case CardType.VIDEO_CALL: return <Camera size={20} />;
      case CardType.AUDIO_CALL: return <Phone size={20} />;
      case CardType.CHAT: return <MessageSquare size={20} />;
      default: return <Play size={20} />;
    }
  };

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = cardWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setCardWidth(Math.max(150, Math.min(600, startWidth + deltaX)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const blurPixels = (!isUnlocked && card.isBlur) ? (card.blurLevel || 30) : 0;
  const imageStyle = { 
    filter: `blur(${blurPixels}px)`,
    transition: 'filter 0.5s ease-out, transform 0.5s ease'
  };

  const formatExpiry = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (expiresIn === 0 && !isHostMode && card.id !== 'preview') {
     return (
        <div style={{ width: `${cardWidth}px` }} className="p-4 rounded-[2.5rem] bg-slate-900/50 border border-slate-800 flex items-center justify-center my-4 opacity-50 select-none">
           <span className="text-[10px] font-black uppercase text-slate-500">Conteúdo Expirado</span>
        </div>
     );
  }

  const renderThumbnail = () => {
    if (imgError || !card.thumbnail) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-600">
           <ImageOff size={32} />
           <span className="text-[9px] mt-2 font-black uppercase">Sem Imagem</span>
        </div>
      );
    }
    return (
      <img 
        src={card.thumbnail} 
        alt={card.title}
        style={imageStyle}
        onError={() => setImgError(true)}
        className={`w-full h-full object-cover absolute inset-0 z-0 ${!isUnlocked ? 'scale-110' : 'scale-100'}`}
      />
    );
  };

  const CreatorControls = () => {
      if (!canManage || card.id === 'preview') return null;
      return (
          <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {card.type === CardType.CHAT && (
                  <button onClick={handleCopyLink} className="p-2 bg-emerald-600 rounded-full text-white hover:bg-emerald-500 shadow-lg" title="Copiar Link da Sala">
                      <LinkIcon size={14} />
                  </button>
              )}
              <button onClick={handleEditAttempt} className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 shadow-lg" title="Editar Card">
                  <Edit size={14} />
              </button>
              <button onClick={handleDeleteAttempt} className="p-2 bg-red-600 rounded-full text-white hover:bg-red-500 shadow-lg" title="Excluir Card">
                  <Trash2 size={14} />
              </button>
          </div>
      );
  };

  // === RENDERIZAÇÃO DO MODO MINIMALISTA ===
  if (card.layoutStyle === 'minimal') {
    return (
      <>
        <div 
          ref={cardRef}
          style={{ width: `${cardWidth}px` }}
          className="relative group rounded-[2.5rem] overflow-hidden glass border-white/10 my-8 shadow-2xl transition-[width] ease-out border border-slate-800/50 select-none h-auto min-h-[350px] flex flex-col"
        >
           <div className="absolute inset-0 z-0 bg-black">
             {renderThumbnail()}
             <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 z-0" />
           </div>

           <CreatorControls />

           {expiresIn !== null && expiresIn > 0 && (
             <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-red-600/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-red-500/30 animate-pulse">
               <Timer size={12} className="text-red-500" />
               <span className="text-[10px] font-black text-red-500 font-mono">{formatExpiry(expiresIn)}</span>
             </div>
           )}

           <div onMouseDown={onResizeStart} className="absolute top-0 right-0 bottom-0 w-4 cursor-col-resize z-[40]" />

           {/* Content Layer */}
           <div className="relative z-10 flex-1 flex flex-col justify-end p-6">
              {!isUnlocked && (
                 <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-4 backdrop-blur-md shadow-lg">
                       <Lock size={32} className="text-white/80" />
                    </div>
                 </div>
              )}
              
              <div className="space-y-4 text-center">
                 {card.group && (
                     <div className="flex justify-center">
                        <span className="px-3 py-1 rounded-lg bg-white/10 text-white text-[9px] font-black uppercase tracking-widest border border-white/10">
                            {card.group}
                        </span>
                     </div>
                 )}
                 <h3 className="font-black text-lg text-white uppercase tracking-tighter drop-shadow-lg leading-tight">{card.title}</h3>
                 <button 
                  onClick={handleInteraction}
                  className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl backdrop-blur-md transition-all transform active:scale-95 border flex items-center justify-center gap-2 ${
                    isUnlocked 
                      ? 'bg-white/20 hover:bg-white/30 text-white border-white/20' 
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 border-emerald-400'
                  }`}
                 >
                   {card.type === CardType.CHAT ? (
                       <><LogIn size={14} /> ENTRAR ROOM</>
                   ) : (
                       isUnlocked ? 'ACESSAR' : `LIBERAR • ${card.creditCost}`
                   )}
                 </button>
              </div>
           </div>
        </div>
        {renderFullScreenModal()}
      </>
    );
  }

  // === RENDERIZAÇÃO DO MODO CLÁSSICO ===
  return (
    <>
      <div 
        ref={cardRef}
        style={{ width: `${cardWidth}px` }}
        className="relative group rounded-[2.5rem] overflow-hidden glass border-white/10 my-8 shadow-2xl animate-in zoom-in-95 duration-300 transition-[width] ease-out border border-slate-800/50 select-none"
      >
        <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: bgColor }}>
          {renderThumbnail()}
          <CreatorControls />
          
           {expiresIn !== null && expiresIn > 0 && (
             <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-red-600/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-red-500/30">
               <Timer size={12} className="text-red-500 animate-pulse" />
               <span className="text-[10px] font-black text-red-500 font-mono">{formatExpiry(expiresIn)}</span>
             </div>
           )}

          {!isUnlocked && (
            <div className="absolute inset-0 bg-black/40 z-10 flex flex-col items-center justify-center p-8 text-center backdrop-blur-[1px]">
              <div className="p-5 rounded-full bg-blue-600/10 border border-blue-500/20 mb-5 animate-pulse">
                <Lock size={36} className="text-blue-400" />
              </div>
              <span className="text-white font-black text-xs tracking-[0.3em] uppercase mb-1 drop-shadow-lg">Conteúdo Exclusivo</span>
              <p className="text-[10px] text-slate-400 font-bold mb-8 uppercase tracking-widest">{card.category}</p>
              <button 
                onClick={handleInteraction}
                className="px-10 py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black flex items-center gap-2 hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30 uppercase tracking-[0.2em]"
              >
                {card.type === CardType.CHAT ? 'ENTRAR ROOM' : `LIBERAR • ${card.creditCost} CR`}
              </button>
            </div>
          )}

          {isUnlocked && callStatus === 'none' && !showSession && (
            <div className="absolute inset-0 z-10 bg-transparent hover:bg-black/20 transition-all flex flex-col items-center justify-center group cursor-pointer" onClick={handleInteraction}>
              <div className="absolute top-4 right-4 p-2 bg-black/40 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 size={16} />
              </div>
              <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm text-white border border-white/20 flex items-center justify-center shadow-2xl transform scale-0 group-hover:scale-100 transition-all duration-300">
                {getIcon()}
              </div>
            </div>
          )}
        </div>

        <div 
          onMouseDown={onResizeStart}
          className="absolute top-0 right-0 bottom-10 w-4 cursor-col-resize z-[40] hover:bg-blue-500/10 transition-colors"
        />

        <div className="p-6 border-t border-white/5 relative z-20" style={{ backgroundColor: bgColor }}>
          <div className="flex justify-between items-center mb-4">
            <span className="px-3 py-1 rounded-lg bg-white/10 text-white text-[9px] font-black uppercase tracking-widest border border-white/10">
              {card.category}
            </span>
            {card.group && (
                <span className="px-3 py-1 rounded-lg bg-blue-600/20 text-blue-400 text-[9px] font-black uppercase tracking-widest border border-blue-600/20 flex items-center gap-1">
                    <Tag size={10} /> {card.group}
                </span>
            )}
          </div>
          <h3 className="font-black text-sm text-white mb-2 leading-tight uppercase tracking-tighter truncate">{card.title}</h3>
          <p className="text-[10px] text-slate-400 font-medium line-clamp-2 leading-relaxed mb-4 h-8">
            {card.description || 'Interação personalizada.'}
          </p>

          <div className="flex items-center gap-3 pt-4 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock size={14} />
              <span className="text-[10px] font-black tracking-tighter uppercase">{card.duration}S</span>
            </div>
            <button 
              onClick={handleInteraction}
              className={`ml-auto px-5 py-2 rounded-xl text-[9px] font-black transition-all uppercase tracking-[0.1em] flex items-center gap-2 ${
                isUnlocked 
                  ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' 
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
              }`}
            >
              {card.type === CardType.CHAT ? (
                  <><LogIn size={12} /> ENTRAR</>
              ) : (
                  isUnlocked ? 'ABRIR' : `${card.creditCost} CR`
              )}
            </button>
          </div>
        </div>
      </div>
      {renderFullScreenModal()}
    </>
  );

  function renderFullScreenModal() {
    return showSession && (
      <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-[100] bg-gradient-to-b from-black/80 to-transparent">
             <div className="flex items-center gap-4">
               {/* ... (Same header logic) ... */}
               <button 
                 onClick={() => setShowSession(false)}
                 className="p-3 bg-red-600/80 hover:bg-red-600 rounded-full text-white transition-all backdrop-blur-md shadow-lg shadow-red-600/20"
               >
                 <X size={20} />
               </button>
             </div>
          </div>

          <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-10">
            {card.type === CardType.VIDEO && card.mediaUrl ? (
              <video src={card.mediaUrl} autoPlay controls className="max-w-full max-h-full rounded-lg shadow-2xl" />
            ) : card.type === CardType.IMAGE && card.mediaUrl ? (
              <img src={card.mediaUrl} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
            ) : card.type === CardType.AUDIO && card.mediaUrl ? (
              <div className="text-center p-8 space-y-8 max-w-md w-full">
                {/* Audio visualization similar to original */}
                <audio src={card.mediaUrl} autoPlay controls className="w-full" />
              </div>
            ) : (
              <div className="text-center p-8 space-y-6">
                 {/* Default content */}
              </div>
            )}
          </div>
        </div>
    )
  }
};

export default MediaCardItem;
