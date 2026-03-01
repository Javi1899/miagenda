import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Calendar, Plus, Trash2, Volume2, Bell, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Reminder {
  id: string;
  text: string;
  datetime: string;
  completed: boolean;
}

export default function App() {
  const [time, setTime] = useState(new Date());
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    const saved = localStorage.getItem('mi_agenda_reminders');
    return saved ? JSON.parse(saved) : [];
  });
  const [newText, setNewText] = useState('');
  const [newDateTime, setNewDateTime] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Save reminders to localStorage
  useEffect(() => {
    localStorage.setItem('mi_agenda_reminders', JSON.stringify(reminders));
  }, [reminders]);

  // Check for due reminders
  useEffect(() => {
    const checkReminders = setInterval(() => {
      const now = new Date();
      const nowStr = format(now, "yyyy-MM-dd'T'HH:mm");
      
      const dueReminders = reminders.filter(r => !r.completed && r.datetime <= nowStr);
      
      if (dueReminders.length > 0) {
        dueReminders.forEach(reminder => {
          handleVoiceAlert(reminder);
          markAsCompleted(reminder.id);
        });
      }
    }, 1000);

    return () => clearInterval(checkReminders);
  }, [reminders]);

  const handleVoiceAlert = async (reminder: Reminder) => {
    try {
      setIsSpeaking(true);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Atención: Recordatorio programado. ${reminder.text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioData = atob(base64Audio);
        const arrayBuffer = new ArrayBuffer(audioData.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < audioData.length; i++) {
          view[i] = audioData.charCodeAt(i);
        }

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsSpeaking(false);
        source.start(0);
      } else {
        setIsSpeaking(false);
      }
    } catch (err) {
      console.error('Error in TTS:', err);
      setError('Error al reproducir la voz natural.');
      setIsSpeaking(false);
    }
  };

  const addReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText || !newDateTime) return;

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      text: newText,
      datetime: newDateTime,
      completed: false,
    };

    setReminders(prev => [...prev, reminder].sort((a, b) => a.datetime.localeCompare(b.datetime)));
    setNewText('');
    setNewDateTime('');
    setError(null);
  };

  const removeReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  const markAsCompleted = (id: string) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: true } : r));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 font-sans selection:bg-[#00ff9d] selection:text-black">
      {/* Background Grid Effect */}
      <div className="fixed inset-0 pointer-events-none opacity-10" 
           style={{ backgroundImage: 'radial-gradient(#00ff9d 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />

      <header className="max-w-md mx-auto mb-12 relative z-10">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-mono tracking-[0.3em] text-[#00ff9d] uppercase mb-8 flex items-center gap-2"
        >
          <Bell className="w-4 h-4" />
          MI AGENDA v1.0
        </motion.h1>

        <div className="flex flex-col items-center justify-center space-y-2">
          <motion.div 
            key={time.getSeconds()}
            initial={{ scale: 0.95, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl md:text-7xl font-mono font-bold tracking-tighter futuristic-glow text-white"
          >
            {format(time, 'HH:mm:ss')}
          </motion.div>
          <div className="text-sm font-mono text-white/50 uppercase tracking-widest">
            {format(time, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-8 relative z-10">
        {/* Add Reminder Form */}
        <section className="futuristic-border p-6 rounded-2xl space-y-4">
          <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Plus className="w-3 h-3" />
            Nueva Programación
          </h2>
          <form onSubmit={addReminder} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-white/30 uppercase ml-1">Mensaje de Voz</label>
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Ej: Tomar medicina..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00ff9d]/50 transition-colors placeholder:text-white/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-white/30 uppercase ml-1">Fecha y Hora</label>
              <input
                type="datetime-local"
                value={newDateTime}
                onChange={(e) => setNewDateTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00ff9d]/50 transition-colors [color-scheme:dark]"
              />
            </div>
            <button
              type="submit"
              disabled={!newText || !newDateTime}
              className="w-full bg-[#00ff9d] text-black font-bold py-3 rounded-xl hover:bg-[#00cc7e] transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" />
              PROGRAMAR ALARMA
            </button>
          </form>
          {error && (
            <div className="text-red-400 text-xs flex items-center gap-2 mt-2">
              <AlertCircle className="w-3 h-3" />
              {error}
            </div>
          )}
        </section>

        {/* Reminders List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Tareas Pendientes
            </h2>
            <span className="text-[10px] font-mono text-[#00ff9d] bg-[#00ff9d]/10 px-2 py-0.5 rounded-full">
              {reminders.filter(r => !r.completed).length}
            </span>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {reminders.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12 text-white/20 text-sm font-mono italic"
                >
                  No hay alarmas programadas
                </motion.div>
              ) : (
                reminders.map((reminder) => (
                  <motion.div
                    key={reminder.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "futuristic-border p-4 rounded-xl flex items-center justify-between group transition-all",
                      reminder.completed ? "opacity-40 grayscale" : "futuristic-card"
                    )}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-medium truncate",
                          reminder.completed && "line-through"
                        )}>
                          {reminder.text}
                        </span>
                        {isSpeaking && !reminder.completed && (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                          >
                            <Volume2 className="w-3 h-3 text-[#00ff9d]" />
                          </motion.div>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-white/40 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {format(new Date(reminder.datetime), "d MMM, HH:mm", { locale: es })}
                      </div>
                    </div>
                    <button
                      onClick={() => removeReminder(reminder.id)}
                      className="p-2 text-white/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Footer Status */}
      <footer className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-4 text-[10px] font-mono text-white/40">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] animate-pulse" />
            SISTEMA ACTIVO
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div>MEMORIA: {reminders.length} NODOS</div>
        </div>
      </footer>
    </div>
  );
}
