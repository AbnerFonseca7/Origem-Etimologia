import React, { useState, useEffect, useRef } from 'react';
import { Search, History as HistoryIcon, Sparkles, BookOpen, ArrowRight, Loader2, X, Info, Copy, Check, Image as ImageIcon, Download, Share2, Flag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { toPng } from 'html-to-image';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import confetti from 'canvas-confetti';
import { fetchEtymology, fetchWordOfTheDay, type EtymologyData, type EtymologySense, type EtymologyResponse } from './services/gemini';
import { CacheService } from './services/cache';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const normalizeWord = (word: string) => {
  return word
    .toLowerCase()
    .trim();
};

const WORD_POOL = [
  'Malandro', 'Cafuné', 'Xodó', 'Bacana', 'Fofoca', 'Gambiarra', 'Uai', 'Chulé',
  'Abacaxi', 'Zebra', 'Quarentena', 'Avatar', 'Sarcasmo', 'Entusiasmo', 'Pandemia', 'Sinergia',
  'Saudade', 'Janela', 'Trabalho', 'Amor', 'Brasil', 'Cerveja', 'Futebol', 'Carnaval',
  'Alegria', 'Esperança', 'Liberdade', 'Justiça', 'Paz', 'Guerra', 'Vida', 'Morte',
  'Sol', 'Lua', 'Estrela', 'Céu', 'Terra', 'Mar', 'Rio', 'Montanha',
  'Cidade', 'Campo', 'Casa', 'Rua', 'Carro', 'Avião', 'Trem', 'Navio',
  'Livro', 'Escola', 'Professor', 'Aluno', 'Estudo', 'Conhecimento', 'Sabedoria', 'Verdade',
  'Mentira', 'Segredo', 'Mistério', 'Destino', 'Sorte', 'Azar', 'Sonho', 'Realidade',
  'Tempo', 'Espaço', 'Mundo', 'Universo', 'Natureza', 'Animal', 'Planta', 'Flor',
  'Árvore', 'Fruta', 'Comida', 'Bebida', 'Água', 'Fogo', 'Ar', 'Vento',
  'Chuva', 'Neve', 'Gelo', 'Calor', 'Frio', 'Luz', 'Sombra', 'Cor',
  'Som', 'Silêncio', 'Música', 'Dança', 'Arte', 'Cultura', 'História', 'Futuro',
  'Paixão', 'Ódio', 'Raiva', 'Medo', 'Coragem', 'Força', 'Fraqueza', 'Beleza',
  'Feiura', 'Riqueza', 'Pobreza', 'Sucesso', 'Fracasso', 'Vitória', 'Derrota', 'Viagem',
  'Aventura', 'Desafio', 'Oportunidade', 'Mudança', 'Evolução', 'Crescimento', 'Desenvolvimento', 'Progresso',
  'Tecnologia', 'Ciência', 'Filosofia', 'Religião', 'Espiritualidade', 'Alma', 'Espírito', 'Corpo',
  'Mente', 'Coração', 'Sangue', 'Osso', 'Pele', 'Cabelo', 'Olho', 'Mão',
  'Pé', 'Dedo', 'Voz', 'Palavra', 'Língua', 'Pensamento', 'Ideia', 'Ação',
  'Amizade', 'Família', 'Tradição', 'Memória', 'Saúde', 'Energia', 'Equilíbrio', 'Harmonia'
];

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState<EtymologyData | null>(null);
  const [disambiguation, setDisambiguation] = useState<EtymologySense[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [wordOfTheDay, setWordOfTheDay] = useState<EtymologyData | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportForm, setReportForm] = useState({ type: 'bug', message: '', email: '' });
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [copied, setCopied] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [showCardGenerator, setShowCardGenerator] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardTheme, setCardTheme] = useState<'classic' | 'modern' | 'sepia' | 'parchment'>('parchment');
  const [currentTrending, setCurrentTrending] = useState<string[]>([]);
  const [currentSuggested, setCurrentSuggested] = useState<string[]>([]);
  const [pioneerWords, setPioneerWords] = useState<string[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);

  const loadingMessages = [
    "Consultando os manuscritos do tempo...",
    "Rastreando raízes latinas e gregas...",
    "Analisando evolução fonética...",
    "Sintetizando consenso acadêmico...",
    "Preparando a jornada da palavra..."
  ];

  useEffect(() => {
    let interval: number | undefined;
    if (loading) {
      interval = window.setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 3000);
    } else {
      setLoadingMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    // 1. Daily Trending Words (Seeded by date)
    const today = new Date();
    const dateSeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    
    const getSeededTrending = () => {
      const shuffled = [...WORD_POOL];
      let seed = dateSeed;
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor((Math.abs(Math.sin(seed++) * 10000)) % (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, 8);
    };

    setCurrentTrending(getSeededTrending());

    // 2. Suggested Words (Random on each open)
    const getRandomSuggested = () => {
      return [...WORD_POOL].sort(() => Math.random() - 0.5).slice(0, 8);
    };
    setCurrentSuggested(getRandomSuggested());
  }, []);

  useEffect(() => {
    const savedHistory = localStorage.getItem('etymology_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }

    const savedPioneers = localStorage.getItem('etymology_pioneers');
    if (savedPioneers) {
      setPioneerWords(JSON.parse(savedPioneers));
    }

    const loadWordOfTheDay = async () => {
      // Check cache first for WOTD
      const WOTD_CACHE_KEY = 'wotd_cache_data';
      const cachedWotd = localStorage.getItem(WOTD_CACHE_KEY);
      const WOTD_EXPIRY = 24 * 60 * 60 * 1000;

      if (cachedWotd) {
        const { data, timestamp } = JSON.parse(cachedWotd);
        if (Date.now() - timestamp < WOTD_EXPIRY) {
          setWordOfTheDay(data);
          return;
        }
      }

      try {
        // Fetch from backend instead of Gemini directly
        const response = await fetch('/api/word-of-the-day');
        if (response.ok) {
          const data = await response.json();
          setWordOfTheDay(data);
          localStorage.setItem(WOTD_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
          await CacheService.save(data);
        } else {
          // Fallback to Gemini if backend fails or is empty
          const data = await fetchWordOfTheDay();
          setWordOfTheDay(data);
          localStorage.setItem(WOTD_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
          await CacheService.save(data);
          
          // Save this new word to backend for future use
          await fetch('/api/etymology', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: data.word, data })
          });
        }
      } catch (err) {
        console.error("Failed to load word of the day", err);
      }
    };
    loadWordOfTheDay();
  }, []);

  const addToHistory = (word: string) => {
    const newHistory = [word, ...history.filter(w => w !== word)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('etymology_history', JSON.stringify(newHistory));
  };

  const addPioneerWord = (word: string) => {
    if (!pioneerWords.includes(word)) {
      const newPioneers = [word, ...pioneerWords].slice(0, 20);
      setPioneerWords(newPioneers);
      localStorage.setItem('etymology_pioneers', JSON.stringify(newPioneers));
      setShowCelebration(true);
      
      // Trigger confetti explosion
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3e2723', '#5d4037', '#8b4513', '#d4af37', '#f4e4bc'],
        disableForReducedMotion: true
      });

      setTimeout(() => setShowCelebration(false), 15000);
    }
  };

  const handleSearch = async (e?: React.FormEvent, wordToSearch?: string) => {
    if (e) e.preventDefault();
    const query = normalizeWord(wordToSearch || searchQuery);
    if (!query) return;

    if (wordToSearch) {
      setSearchQuery(wordToSearch);
    }

    setLoading(true);
    setError(null);
    setShowHistory(false);
    setCopied(false);

    try {
      // 1. Check backend API first
      try {
        const response = await fetch(`/api/etymology/${encodeURIComponent(query)}`);
        if (response.ok) {
          const backendData = await response.json();
          setResult(backendData);
          setDisambiguation(null);
          addToHistory(backendData.word);
          if (backendData.isFirstSearch) {
            addPioneerWord(backendData.word);
          }
          setLoading(false);
          return;
        }
      } catch (apiErr) {
        console.warn("Backend API not available, falling back to local cache/Gemini", apiErr);
      }

      // 2. Check local cache as fallback
      const cachedData = await CacheService.get(query);
      
      if (cachedData) {
        setResult(cachedData);
        setDisambiguation(null);
        addToHistory(cachedData.word);
        setLoading(false);
        return;
      }

      // 3. If not found anywhere, call Gemini
      const response = await fetchEtymology(query);
      
      if (response.type === 'disambiguation' && response.senses) {
        setDisambiguation(response.senses);
        setResult(null);
        setLoading(false);
        return;
      }

      if (response.type === 'result' && response.data) {
        const data = response.data;
        setDisambiguation(null);
        
        // 4. Save to backend and local cache
        try {
          const saveResponse = await fetch('/api/etymology', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: data.word, data })
          });
          
          if (saveResponse.ok) {
            const savedData = await saveResponse.json();
            if (savedData && savedData.word) {
              setResult(savedData);
              await CacheService.save(savedData);
              addToHistory(savedData.word);
              if (savedData.isFirstSearch) {
                addPioneerWord(savedData.word);
              }
              setLoading(false);
              return;
            }
          }
        } catch (saveErr) {
          console.error("Failed to save to backend", saveErr);
        }
        
        await CacheService.save(data);
        setResult(data);
        addToHistory(data.word);
      }
    } catch (err: any) {
      if (err.message === 'TIMEOUT') {
        setError('A consulta está demorando mais que o esperado. Por favor, tente novamente.');
      } else {
        setError('Não foi possível encontrar a etimologia desta palavra. Tente outra.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSenseSelect = (sense: EtymologySense) => {
    handleSearch(undefined, `${searchQuery} (${sense.label})`);
  };

  const handleSuggestedClick = (word: string) => {
    handleSearch(undefined, word);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Replace the clicked word with a new one from the pool
    setCurrentSuggested(prev => {
      const remaining = WORD_POOL.filter(w => !prev.includes(w) && w.toLowerCase() !== word.toLowerCase());
      if (remaining.length === 0) return prev;
      const newWord = remaining[Math.floor(Math.random() * remaining.length)];
      return prev.map(w => w === word ? newWord : w);
    });
  };

  const handleCopy = async () => {
    if (!result) return;
    
    const textToCopy = `
Palavra: ${result.word}
Origem: ${result.origin}
Significado: ${result.meaning}

Resumo:
${result.card_summary}

História:
${result.history}

${result.observations ? `Observações:\n${result.observations}\n` : ''}
Curiosidade:
${result.fun_fact}

Grau de consenso acadêmico: ${result.consensus_level}
    `.trim();

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const downloadCard = async () => {
    if (cardRef.current === null || isDownloading) return;
    
    setIsDownloading(true);
    try {
      // Small delay to ensure any transitions are finished
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const dataUrl = await toPng(cardRef.current, { 
        cacheBust: true, 
        pixelRatio: 3,
        quality: 1,
        backgroundColor: '#FDFCF8' // Ensure background is solid
      });
      
      const link = document.createElement('a');
      link.download = `origem-${result?.word || 'etimologia'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate image', err);
      alert('Houve um erro ao gerar a imagem. Tente novamente ou use outro tema.');
    } finally {
      setIsDownloading(false);
    }
  };

  const shareCard = async () => {
    if (cardRef.current === null || isDownloading) return;
    
    if (!navigator.share) {
      alert('Seu navegador não suporta a função de compartilhar nativa. Você pode baixar a imagem e compartilhar manualmente.');
      return;
    }

    setIsDownloading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const dataUrl = await toPng(cardRef.current, { 
        cacheBust: true, 
        pixelRatio: 2,
        quality: 0.9,
        backgroundColor: '#FDFCF8'
      });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `origem-${result?.word}.png`, { type: 'image/png' });

      const shareData: ShareData = {
        title: `Etimologia de ${result?.word}`,
        text: `Olha que interessante a origem da palavra "${result?.word}"! 📚\n\n${result?.card_summary}`,
        files: [file],
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.share({
          title: `Etimologia de ${result?.word}`,
          text: `Olha que interessante a origem da palavra "${result?.word}"! 📚\n\n${result?.card_summary}`,
          url: window.location.href
        });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error sharing:', err);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportStatus('sending');
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportForm)
      });
      if (response.ok) {
        setReportStatus('sent');
        setReportForm({ type: 'bug', message: '', email: '' });
      } else {
        throw new Error('Failed to send report');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar relato. Tente novamente mais tarde.');
      setReportStatus('idle');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-paper/80 backdrop-blur-md border-b border-stone-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => { setResult(null); setError(null); }}
          >
            <div className="w-10 h-10 bg-stone-900 rounded-full flex items-center justify-center text-paper">
              <BookOpen size={20} />
            </div>
            <h1 className="text-2xl font-serif font-bold tracking-tight">Origem</h1>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowReport(true)}
              className="p-2 hover:bg-stone-100 rounded-full transition-colors text-sepia"
              title="Relatar um erro"
            >
              <Flag size={20} />
            </button>
            <button 
              onClick={() => setShowAbout(true)}
              className="p-2 hover:bg-stone-100 rounded-full transition-colors text-sepia"
              title="Sobre as fontes"
            >
              <Info size={20} />
            </button>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-stone-100 rounded-full transition-colors text-sepia"
              title="Histórico"
            >
              <HistoryIcon size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        {/* Search Section */}
        <div className={cn(
          "transition-all duration-700 ease-in-out",
          result || loading ? "mb-12" : "mt-20 mb-20"
        )}>
          {!result && !loading && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <h2 className="text-5xl md:text-7xl font-serif font-light mb-6 leading-tight">
                Descubra a alma das <span className="italic">palavras</span>.
              </h2>
              <p className="text-sepia text-lg max-w-xl mx-auto">
                Explore a jornada histórica, as raízes latinas e gregas, e a evolução fonética do nosso idioma.
              </p>
            </motion.div>
          )}

          {/* Trending Section */}
          <div className="mb-8 overflow-hidden">
            <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-widest font-bold text-stone-400">
              <Sparkles size={12} className="text-amber-500" />
              Tendências de hoje
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {currentTrending.map((word) => (
                <button
                  key={word}
                  onClick={() => handleSearch(undefined, word)}
                  className="whitespace-nowrap px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full text-sm font-medium transition-colors border border-stone-200/50"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSearch} className="relative group">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite uma palavra... (ex: Saudade, Janela, Trabalho)"
              className="w-full bg-white border-2 border-stone-200 rounded-2xl px-6 py-5 text-xl font-serif focus:outline-none focus:border-stone-900 transition-all shadow-sm group-hover:shadow-md"
            />
            <button 
              type="submit"
              disabled={loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-stone-900 text-paper p-3 rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <ArrowRight size={24} />}
            </button>
          </form>

          {error && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-red-600 text-center font-medium"
            >
              {error}
            </motion.p>
          )}
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative">
                <Loader2 className="animate-spin text-stone-300" size={64} strokeWidth={1} />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-stone-900" size={24} />
              </div>
              <p className="mt-6 text-sepia font-serif italic text-xl animate-pulse min-h-[1.5em]">
                {loadingMessages[loadingMessageIndex]}
              </p>
            </motion.div>
          ) : disambiguation ? (
            <motion.div
              key="disambiguation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto py-12"
            >
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 text-amber-600 rounded-full mb-4">
                  <BookOpen size={32} />
                </div>
                <h2 className="text-3xl font-serif font-bold text-stone-900 mb-2">
                  Qual "{searchQuery}" você procura?
                </h2>
                <p className="text-stone-600 font-serif italic">
                  Esta palavra possui múltiplos sentidos ou origens distintas. Escolha uma das opções abaixo:
                </p>
              </div>

              <div className="grid gap-4">
                {disambiguation.map((sense) => (
                  <button
                    key={sense.id}
                    onClick={() => handleSenseSelect(sense)}
                    className="group w-full text-left p-6 bg-white border-2 border-stone-100 rounded-3xl hover:border-stone-900 hover:shadow-xl transition-all flex items-center justify-between gap-6"
                  >
                    <div className="flex-1">
                      <h3 className="text-xl font-serif font-bold text-stone-900 mb-1 group-hover:text-amber-700 transition-colors">
                        {sense.label}
                      </h3>
                      <p className="text-stone-500 font-serif text-sm leading-relaxed">
                        {sense.description}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-stone-50 text-stone-400 rounded-full flex items-center justify-center group-hover:bg-stone-900 group-hover:text-paper transition-all">
                      <ArrowRight size={20} />
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setDisambiguation(null)}
                className="mt-10 w-full py-4 text-stone-400 hover:text-stone-600 font-medium text-sm transition-colors"
              >
                Voltar para a busca inicial
              </button>
            </motion.div>
          ) : result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-12 pb-20"
            >
              <AnimatePresence>
                {showCelebration && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -20 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -20 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8 flex items-center gap-4 shadow-sm">
                      <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                        <Sparkles className="text-amber-600" size={24} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-amber-900 font-serif font-bold text-lg">Descoberta Pioneira!</h4>
                        <p className="text-amber-800 text-sm font-serif italic">
                          Parabéns! Você foi a primeira pessoa a pesquisar a etimologia de <span className="font-bold">"{result.word}"</span> em nossa plataforma.
                        </p>
                      </div>
                      <button 
                        onClick={() => setShowCelebration(false)}
                        className="p-2 hover:bg-amber-100 rounded-full transition-colors text-amber-400"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Word Header */}
              <div className="border-b border-stone-200 pb-8 flex justify-between items-start gap-4">
                <div>
                  <div className="flex flex-wrap items-baseline gap-4 mb-2">
                    <h2 className="text-6xl md:text-8xl font-serif font-bold lowercase">{result.word}</h2>
                    {result.pronunciation && (
                      <span className="text-sepia font-serif text-xl italic">[{result.pronunciation}]</span>
                    )}
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold border",
                      result.consensus_level === 'alto' ? "bg-green-50 text-green-700 border-green-200" :
                      result.consensus_level === 'médio' ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-red-50 text-red-700 border-red-200"
                    )}>
                      Consenso: {result.consensus_level}
                    </div>
                  </div>
                  <p className="text-2xl font-serif text-stone-600 italic">{result.origin}</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <button
                    onClick={() => setShowCardGenerator(true)}
                    className="p-3 bg-stone-900 text-paper rounded-xl hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center justify-center gap-2 text-sm font-bold"
                  >
                    <ImageIcon size={18} />
                    <span className="hidden sm:inline">Gerar Card</span>
                  </button>
                  <button
                    onClick={handleCopy}
                    className={cn(
                      "p-3 rounded-xl border transition-all flex items-center justify-center gap-2 text-sm font-medium",
                      copied 
                        ? "bg-green-50 border-green-200 text-green-700" 
                        : "bg-white border-stone-200 text-sepia hover:border-stone-900 hover:text-stone-900"
                    )}
                    title="Copiar etimologia"
                  >
                    {copied ? (
                      <>
                        <Check size={18} />
                        <span className="hidden sm:inline">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={18} />
                        <span className="hidden sm:inline">Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="md:col-span-2 space-y-12">
                  <section>
                    <h3 className="text-xs uppercase tracking-widest text-sepia font-sans font-bold mb-4">
                      Significado Atual
                    </h3>
                    <p className="text-2xl md:text-3xl font-serif leading-tight text-stone-900">
                      {result.meaning}
                    </p>
                  </section>

                  <section className="bg-stone-100 p-8 rounded-3xl border border-stone-200">
                    <h3 className="text-xs uppercase tracking-widest text-sepia font-sans font-bold mb-4 flex items-center gap-2">
                      <Sparkles size={14} />
                      Você sabia?
                    </h3>
                    <p className="text-lg font-serif italic leading-relaxed text-stone-800">
                      {result.fun_fact}
                    </p>
                  </section>

                  <section className="pt-8 border-t border-stone-100">
                    <h3 className="text-xs uppercase tracking-widest text-sepia font-sans font-bold mb-6 flex items-center gap-2">
                      <div className="w-1 h-1 bg-sepia rounded-full" />
                      História e Evolução (Aprofundamento)
                    </h3>
                    <div className="markdown-body prose prose-stone max-w-none">
                      <ReactMarkdown>{result.history}</ReactMarkdown>
                    </div>
                  </section>

                  {result.observations && (
                    <section className="border-l-4 border-stone-200 pl-6 py-2">
                      <h3 className="text-xs uppercase tracking-widest text-sepia font-sans font-bold mb-3 flex items-center gap-2">
                        <Info size={14} />
                        Observações e Divergências
                      </h3>
                      <p className="text-lg font-serif italic text-stone-600 leading-relaxed">
                        {result.observations}
                      </p>
                    </section>
                  )}
                </div>

                <div className="space-y-10">
                  <section>
                    <h3 className="text-xs uppercase tracking-widest text-sepia font-sans font-bold mb-4">
                      Palavras Relacionadas
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {result.related_words.map((word, i) => (
                        <button
                          key={i}
                          onClick={() => handleSearch(undefined, word)}
                          className="px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium hover:border-stone-900 hover:bg-stone-50 transition-all"
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </section>

                  <div className="pt-8 border-t border-stone-200">
                    <button 
                      onClick={() => { setResult(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="text-sepia hover:text-stone-900 flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                      <ArrowRight className="rotate-180" size={16} />
                      Nova busca
                    </button>
                  </div>
                </div>
              </div>

              {/* Discover More Section */}
              <section className="pt-12 border-t border-stone-200">
                <h3 className="text-xl font-serif font-bold mb-8 flex items-center gap-3">
                  <Sparkles size={20} className="text-amber-500" />
                  Saiba também a etimologia de:
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {currentSuggested
                    .filter(w => result && w.toLowerCase() !== result.word.toLowerCase())
                    .slice(0, 4)
                    .map((word) => (
                      <button
                        key={word}
                        onClick={() => handleSuggestedClick(word)}
                        className="group p-6 bg-white border border-stone-200 rounded-2xl hover:border-stone-900 transition-all text-left shadow-sm hover:shadow-md"
                      >
                        <div className="text-stone-400 group-hover:text-stone-900 transition-colors mb-2">
                          <BookOpen size={18} />
                        </div>
                        <div className="font-serif text-lg font-bold group-hover:translate-x-1 transition-transform">
                          {word}
                        </div>
                      </button>
                    ))}
                </div>
              </section>
            </motion.div>
          ) : (
            <div className="space-y-16">
              {/* Word of the Day */}
              {wordOfTheDay && (
                <motion.section 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="bg-stone-900 text-paper p-8 md:p-12 rounded-[2rem] relative overflow-hidden group cursor-pointer"
                  onClick={() => handleSearch(undefined, wordOfTheDay.word)}
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <BookOpen size={120} />
                  </div>
                  
                  <div className="relative z-10">
                    <span className="text-xs uppercase tracking-[0.3em] font-bold opacity-60 mb-6 block">
                      Palavra do Dia
                    </span>
                    <h3 className="text-5xl md:text-7xl font-serif font-bold mb-4 lowercase group-hover:translate-x-2 transition-transform duration-500">
                      {wordOfTheDay.word}
                    </h3>
                    <p className="text-xl md:text-2xl font-serif italic opacity-80 mb-8 max-w-xl">
                      {wordOfTheDay.origin}
                    </p>
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
                      Explorar história <ArrowRight size={16} />
                    </div>
                  </div>
                </motion.section>
              )}

              {/* Features / Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-6 border border-stone-200 rounded-2xl">
                  <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                    <Info size={20} className="text-stone-600" />
                  </div>
                  <h4 className="font-bold mb-2">Rigor Filológico</h4>
                  <p className="text-sepia text-sm">Análise profunda baseada em raízes indo-europeias e evolução fonética.</p>
                </div>
                <div className="p-6 border border-stone-200 rounded-2xl">
                  <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                    <Sparkles size={20} className="text-stone-600" />
                  </div>
                  <h4 className="font-bold mb-2">Curiosidades</h4>
                  <p className="text-sepia text-sm">Descubra como palavras comuns escondem segredos surpreendentes.</p>
                </div>
                <div className="p-6 border border-stone-200 rounded-2xl">
                  <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                    <HistoryIcon size={20} className="text-stone-600" />
                  </div>
                  <h4 className="font-bold mb-2">Sua Jornada</h4>
                  <p className="text-sepia text-sm">Mantenha um registro das palavras que você explorou recentemente.</p>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* History Sidebar/Overlay */}
      <AnimatePresence>
        {showCardGenerator && result && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCardGenerator(false)}
              className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 m-auto w-[95%] max-w-2xl h-fit max-h-[90vh] bg-paper z-[110] shadow-2xl p-6 md:p-10 rounded-[2.5rem] border border-stone-200 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-serif font-bold">Gerador de Card</h3>
                  <p className="text-sepia text-sm">Personalize e baixe sua etimologia</p>
                </div>
                <button 
                  onClick={() => setShowCardGenerator(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Preview Area */}
                <div className="space-y-4">
                    <div className="text-xs uppercase tracking-widest font-bold text-sepia">Prévia</div>
                    <div 
                      ref={cardRef}
                      className={cn(
                        "aspect-[3/4] w-full px-10 py-16 md:px-14 md:py-20 flex flex-col justify-between relative transition-all duration-500",
                        cardTheme !== 'parchment' && "rounded-2xl shadow-xl",
                        cardTheme === 'classic' && "bg-white text-stone-900 border border-stone-100 overflow-hidden",
                        cardTheme === 'modern' && "bg-stone-900 text-paper overflow-hidden",
                        cardTheme === 'sepia' && "bg-[#F4EBD0] text-[#5D4037] overflow-hidden",
                        cardTheme === 'parchment' && "bg-paper text-[#3e2723]"
                      )}
                    >
                      {/* Parchment Sheet Effect */}
                      {cardTheme === 'parchment' && (
                        <>
                          {/* Top Roll (Scroll) */}
                          <div className="absolute top-0 left-[-10%] right-[-10%] h-14 z-40 pointer-events-none">
                            {/* Wooden Rod */}
                            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-4 bg-[#2d1b18] rounded-full shadow-lg" />
                            {/* Paper Roll */}
                            <div className="absolute inset-x-[5%] inset-y-0 bg-gradient-to-b from-[#3e2723] via-[#5d4037] to-[#3e2723] rounded-full shadow-2xl border-y border-black/40" />
                            <div className="absolute inset-x-[5%] inset-y-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-40 rounded-full" />
                            {/* Side caps of the roll */}
                            <div className="absolute left-[5%] top-0 bottom-0 w-6 bg-[#2d1b18] rounded-l-full shadow-inner border-r border-black/20" />
                            <div className="absolute right-[5%] top-0 bottom-0 w-6 bg-[#2d1b18] rounded-r-full shadow-inner border-l border-black/20" />
                          </div>

                          {/* Bottom Roll (Scroll) */}
                          <div className="absolute bottom-0 left-[-10%] right-[-10%] h-14 z-40 pointer-events-none">
                            {/* Wooden Rod */}
                            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-4 bg-[#2d1b18] rounded-full shadow-lg" />
                            {/* Paper Roll */}
                            <div className="absolute inset-x-[5%] inset-y-0 bg-gradient-to-b from-[#3e2723] via-[#5d4037] to-[#3e2723] rounded-full shadow-2xl border-y border-black/40" />
                            <div className="absolute inset-x-[5%] inset-y-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-40 rounded-full" />
                            {/* Side caps of the roll */}
                            <div className="absolute left-[5%] top-0 bottom-0 w-6 bg-[#2d1b18] rounded-l-full shadow-inner border-r border-black/20" />
                            <div className="absolute right-[5%] top-0 bottom-0 w-6 bg-[#2d1b18] rounded-r-full shadow-inner border-l border-black/20" />
                          </div>

                          {/* Parchment Background with CSS Gradients for reliability */}
                          <div className="absolute inset-0 z-10 shadow-2xl" style={{
                            backgroundColor: '#f4e4bc',
                            backgroundImage: `
                              radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2) 0%, transparent 100%),
                              linear-gradient(45deg, rgba(0,0,0,0.02) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.02) 75%, transparent 75%, transparent),
                              linear-gradient(-45deg, rgba(0,0,0,0.02) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.02) 75%, transparent 75%, transparent)
                            `,
                            backgroundSize: '100% 100%, 4px 4px, 4px 4px',
                            boxShadow: 'inset 0 0 60px rgba(139, 69, 19, 0.15)',
                            border: '1px solid rgba(139, 69, 19, 0.1)',
                          }} />
                          
                          {/* Torn Edges Effect (Simplified for better capture) */}
                          <div className="absolute inset-0 z-15 pointer-events-none border-[12px] border-transparent" style={{
                            borderImageSource: 'radial-gradient(circle, #3e2723 1%, transparent 20%)',
                            borderImageSlice: '30',
                            borderImageRepeat: 'round',
                            opacity: 0.05
                          }} />
                          
                          {/* Shadows cast by the rolls onto the paper */}
                          <div className="absolute top-10 left-0 right-0 h-16 z-20 bg-gradient-to-b from-black/50 via-black/20 to-transparent pointer-events-none" />
                          <div className="absolute bottom-10 left-0 right-0 h-16 z-20 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />
                          
                          {/* Paper Curl Highlight */}
                          <div className="absolute top-10 left-0 right-0 h-1 z-20 bg-white/10 pointer-events-none" />
                          <div className="absolute bottom-10 left-0 right-0 h-1 z-20 bg-white/10 pointer-events-none" />

                          {/* Overall Aging Overlay (Subtle Vignette) */}
                          <div className="absolute inset-0 z-15 pointer-events-none bg-gradient-to-tr from-black/10 via-transparent to-black/5" />
                        </>
                      )}

                      {/* Background Decoration */}
                      <div className="absolute -top-10 -right-10 opacity-5 z-0">
                        <BookOpen size={200} />
                      </div>

                      <div className="relative z-30 flex flex-col h-full">
                        <div className="flex-1 overflow-hidden flex flex-col">
                          <div className="flex items-center justify-between mb-3 shrink-0">
                            <div className="flex items-center gap-2 opacity-60">
                              <BookOpen size={14} />
                              <span className="text-[8px] uppercase tracking-[0.2em] font-bold">Origem Etimológica</span>
                            </div>
                            <div className="text-[8px] font-serif italic opacity-40">origem.app</div>
                          </div>
                          
                          <div className="mb-4 shrink-0">
                            <h4 className={cn(
                              "font-serif font-bold lowercase break-words leading-tight inline-block mr-2",
                              cardTheme === 'parchment' ? "text-3xl md:text-4xl text-[#3e2723]" : "text-3xl md:text-4xl text-stone-900",
                              cardTheme === 'modern' && "text-white"
                            )}>
                              {result.word}
                            </h4>
                            {result.pronunciation && (
                              <span className="text-xs md:text-sm font-serif italic opacity-50">[{result.pronunciation}]</span>
                            )}
                            <p className={cn(
                              "text-sm md:text-base font-serif italic opacity-80 mt-1",
                              cardTheme === 'parchment' && "text-[#5d4037] font-medium"
                            )}>{result.origin}</p>
                          </div>
                          
                          <div className="space-y-4 flex-1 overflow-hidden">
                            {/* Significado */}
                            <div className="shrink-0">
                              <div className="text-[7px] uppercase tracking-widest font-bold opacity-40 mb-1">Significado</div>
                              <p className={cn(
                                "text-[10px] md:text-[11px] leading-snug font-serif line-clamp-2",
                                cardTheme === 'parchment' && "text-[#4e342e]"
                              )}>
                                {result.meaning}
                              </p>
                            </div>

                            {/* Etimologia */}
                            <div className="flex-1 overflow-hidden">
                              <div className="text-[7px] uppercase tracking-widest font-bold opacity-40 mb-1">Etimologia</div>
                              <p className={cn(
                                "text-[10px] md:text-[11px] leading-relaxed font-serif line-clamp-[6]",
                                cardTheme === 'parchment' && "text-[#4e342e] leading-[1.4] text-[11px] md:text-xs"
                              )}>
                                {result.card_summary}
                              </p>
                            </div>

                            {/* Curiosidade */}
                            <div className="shrink-0 bg-current bg-opacity-[0.03] p-3 rounded-xl border border-current border-opacity-5">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Sparkles size={10} className="opacity-50" />
                                <div className="text-[7px] uppercase tracking-widest font-bold opacity-40">Você sabia?</div>
                              </div>
                              <p className={cn(
                                "text-[9px] md:text-[10px] leading-tight font-serif italic line-clamp-3",
                                cardTheme === 'parchment' && "text-[#5d4037]"
                              )}>
                                {result.fun_fact}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-current border-opacity-10 flex justify-between items-end mt-4">
                          <div className="space-y-1">
                            <div className="text-[7px] uppercase tracking-widest opacity-50">Consenso Acadêmico</div>
                            <div className="text-[9px] font-bold uppercase">{result.consensus_level}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[7px] uppercase tracking-widest font-bold mb-0.5">Descubra mais no</div>
                            <div className="text-[12px] font-serif font-bold tracking-tight">App Origem</div>
                          </div>
                        </div>
                      </div>
                    </div>
                </div>

                {/* Controls Area */}
                <div className="space-y-8">
                  <section>
                    <h4 className="text-xs uppercase tracking-widest font-bold text-sepia mb-4">Escolha o Estilo</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {(['classic', 'modern', 'sepia', 'parchment'] as const).map((theme) => (
                        <button
                          key={theme}
                          onClick={() => setCardTheme(theme)}
                          className={cn(
                            "h-12 rounded-xl border-2 transition-all capitalize text-xs font-bold",
                            cardTheme === theme 
                              ? "border-stone-900 bg-stone-900 text-paper" 
                              : "border-stone-100 bg-white text-stone-400 hover:border-stone-200"
                          )}
                        >
                          {theme}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
                    <h4 className="text-xs uppercase tracking-widest font-bold text-sepia mb-3 flex items-center gap-2">
                      <ImageIcon size={14} className="text-stone-600" />
                      Compartilhamento
                    </h4>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Gere imagens otimizadas para redes sociais. 
                      Perfeito para compartilhar curiosidades e conhecimento com seus amigos.
                    </p>
                  </section>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={downloadCard}
                      disabled={isDownloading}
                      className="w-full py-4 bg-stone-900 text-paper rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-200 disabled:opacity-70"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="animate-spin" size={20} />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Download size={20} />
                          Baixar Imagem (PNG)
                        </>
                      )}
                    </button>

                    {navigator.share && (
                      <button 
                        onClick={shareCard}
                        disabled={isDownloading}
                        className="w-full py-4 bg-white border-2 border-stone-900 text-stone-900 rounded-xl font-bold hover:bg-stone-50 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                        <Share2 size={20} />
                        Compartilhar Card
                      </button>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-center text-sepia italic">
                    A imagem será salva na sua galeria com alta fidelidade.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {showAbout && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAbout(false)}
              className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[80]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 m-auto w-[90%] max-w-lg h-fit max-h-[80vh] bg-paper z-[90] shadow-2xl p-8 rounded-[2rem] border border-stone-200 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-serif font-bold">Sobre as Fontes</h3>
                <button 
                  onClick={() => setShowAbout(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4 font-serif text-lg text-stone-700 leading-relaxed">
                <p>
                  As etimologias apresentadas seguem critérios da filologia histórica, distinguindo o que é consenso acadêmico de hipóteses e divergências conhecidas.
                </p>
                <p>
                  O <strong>Origem</strong> utiliza inteligência artificial de última geração (Gemini 3) para sintetizar séculos de conhecimento linguístico.
                </p>
                <p>
                  As análises baseiam-se em princípios de <strong>filologia e linguística histórica</strong>, sintetizando o conhecimento consolidado nas principais obras de referência etimológica e estudos acadêmicos sobre a evolução do latim, grego e raízes indo-europeias.
                </p>
                <div className="bg-stone-100 p-4 rounded-xl text-sm font-sans italic text-sepia">
                  Nota: Embora a IA seja altamente precisa, a etimologia é uma ciência viva com debates acadêmicos constantes. Use estas informações como um guia fascinante para a história do nosso idioma.
                </div>
              </div>
              
              <button 
                onClick={() => setShowAbout(false)}
                className="w-full mt-8 py-4 bg-stone-900 text-paper rounded-xl font-bold hover:bg-stone-800 transition-colors"
              >
                Entendido
              </button>
            </motion.div>
          </>
        )}

        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-paper z-[70] shadow-2xl p-8 border-l border-stone-200"
            >
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-serif font-bold">Histórico</h3>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-10 overflow-y-auto max-h-[calc(100vh-180px)] pr-2 no-scrollbar">
                {pioneerWords.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4 text-sepia">
                      <Sparkles size={16} className="text-amber-500" />
                      <h4 className="text-xs uppercase tracking-widest font-bold">Suas Descobertas</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {pioneerWords.map((word, i) => (
                        <button
                          key={`pioneer-${i}`}
                          onClick={() => handleSearch(undefined, word)}
                          className="w-full text-left p-3 rounded-xl bg-amber-50/50 border border-amber-100 hover:border-amber-500 transition-all flex items-center justify-between group"
                        >
                          <span className="text-base font-serif lowercase text-amber-900">{word}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">Pioneiro</span>
                            <ArrowRight size={14} className="text-amber-500" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <div className="flex items-center gap-2 mb-4 text-sepia">
                    <HistoryIcon size={16} />
                    <h4 className="text-xs uppercase tracking-widest font-bold">Buscas Recentes</h4>
                  </div>
                  {history.length > 0 ? (
                    <div className="space-y-2">
                      {history.map((word, i) => (
                        <button
                          key={`history-${i}`}
                          onClick={() => handleSearch(undefined, word)}
                          className="w-full text-left p-4 rounded-xl border border-stone-100 hover:border-stone-900 hover:bg-stone-50 transition-all flex items-center justify-between group"
                        >
                          <span className="text-lg font-serif lowercase">{word}</span>
                          <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                      <button 
                        onClick={() => { setHistory([]); localStorage.removeItem('etymology_history'); }}
                        className="w-full py-4 text-sepia hover:text-red-600 text-sm font-medium transition-colors border-t border-stone-100 mt-4"
                      >
                        Limpar histórico
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-sepia italic font-serif text-sm">Nenhuma palavra explorada ainda.</p>
                    </div>
                  )}
                </section>
              </div>
            </motion.div>
          </>
        )}

        {showReport && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowReport(false); setReportStatus('idle'); }}
              className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[80]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 m-auto w-[90%] max-w-lg h-fit max-h-[90vh] bg-paper z-[90] shadow-2xl p-8 rounded-[2rem] border border-stone-200 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-serif font-bold">Relatar um Problema</h3>
                <button 
                  onClick={() => { setShowReport(false); setReportStatus('idle'); }}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              {reportStatus === 'sent' ? (
                <div className="text-center py-8 space-y-6">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <Check size={32} />
                  </div>
                  <p className="font-serif text-lg leading-relaxed text-stone-700">
                    A sua mensagem foi enviada aos nossos desenvolvedores e resolveremos o problema relatado o mais breve possível. Obrigado por fazer parte do crescimento do App Origem-Etimologia das Palavras.
                  </p>
                  <button 
                    onClick={() => { setShowReport(false); setReportStatus('idle'); }}
                    className="w-full py-4 bg-stone-900 text-paper rounded-xl font-bold hover:bg-stone-800 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReportSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-widest text-sepia">Tipo de Problema</label>
                    <select 
                      value={reportForm.type}
                      onChange={(e) => setReportForm({...reportForm, type: e.target.value})}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-900 transition-colors font-serif"
                    >
                      <option value="bug">Problema Técnico / Bug</option>
                      <option value="etymology">Erro Etimológico</option>
                      <option value="suggestion">Sugestão de Melhoria</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-widest text-sepia">Seu E-mail (opcional)</label>
                    <input 
                      type="email"
                      placeholder="seu@email.com"
                      value={reportForm.email}
                      onChange={(e) => setReportForm({...reportForm, email: e.target.value})}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-900 transition-colors font-serif"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-widest text-sepia">Descrição</label>
                    <textarea 
                      required
                      placeholder="Descreva o erro ou problema encontrado..."
                      rows={4}
                      value={reportForm.message}
                      onChange={(e) => setReportForm({...reportForm, message: e.target.value})}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-900 transition-colors font-serif resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={reportStatus === 'sending'}
                    className="w-full py-4 bg-stone-900 text-paper rounded-xl font-bold hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {reportStatus === 'sending' ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <ArrowRight size={20} />
                        Enviar Relato
                      </>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <footer className="py-8 border-t border-stone-200 text-center text-sepia text-sm font-serif italic">
        <div className="max-w-4xl mx-auto px-6">
          <p>© {new Date().getFullYear()} Origem — Dicionário Etimológico Inteligente</p>
        </div>
      </footer>
    </div>
  );
}
