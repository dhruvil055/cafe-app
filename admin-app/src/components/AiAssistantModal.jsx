import { useState } from 'react';
import {
  Sparkles, Send, X, Loader2, TrendingUp, AlertTriangle,
  Award, DollarSign, Bot, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { formatMoney } from '../utils/money';

const QUICK_PROMPTS = [
  'What are my top selling items this week?',
  'Which inventory items are running low?',
  'Analyze my operating expenses & profit margins',
  'How is my customer rating and feedback?',
  'Suggest a combo discount to boost lunch sales',
];

export default function AiAssistantModal({ isOpen, onClose }) {
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState([
    {
      role: 'assistant',
      text: '👋 Hello! I am your **InfiniGrow Café AI Advisor**. I analyze your live sales, kitchen performance, inventory stock buffers, and operating expenses to help you maximize your cafe profit.\n\nWhat would you like to review today?',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [metricsData, setMetricsData] = useState(null);

  if (!isOpen) return null;

  const handleAsk = async (promptToAsk) => {
    const q = promptToAsk || question;
    if (!q.trim()) return;

    setConversation(prev => [...prev, { role: 'user', text: q }]);
    setQuestion('');
    setLoading(true);

    try {
      const { data } = await api.post('/ai/ask', { question: q });
      setConversation(prev => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          engine: data.engine,
        },
      ]);
      if (data.data) {
        setMetricsData(data.data);
      }
    } catch (error) {
      toast.error(error.message || 'AI advisor request failed');
      setConversation(prev => [
        ...prev,
        {
          role: 'assistant',
          text: '⚠️ I encountered an error pulling your business telemetry. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[640px] border border-stone-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-espresso-950 via-espresso-900 to-brew-900 text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-brew-500/30 border border-brew-400/40 flex items-center justify-center text-brew-200">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="font-display font-bold text-base text-white flex items-center gap-2">
                <span>InfiniGrow Café AI</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-brew-500/30 text-brew-300 border border-brew-400/30 uppercase">
                  Operations Advisor
                </span>
              </div>
              <div className="text-[11px] text-stone-300">
                Live business intelligence grounded in your café database
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Mini Stats Strip (if metrics loaded) */}
        {metricsData && (
          <div className="bg-stone-50 border-b border-stone-200 px-4 py-2 flex items-center justify-between text-[11px] text-stone-600 overflow-x-auto shrink-0">
            <div className="flex items-center gap-1">
              <DollarSign size={13} className="text-emerald-600" />
              <span>30D Sales: <strong>{formatMoney(metricsData.revenue)}</strong></span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1">
              <TrendingUp size={13} className="text-blue-600" />
              <span>Net Margin: <strong>{formatMoney(metricsData.netEstimatedProfit)}</strong></span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1">
              <AlertTriangle size={13} className={metricsData.lowStockItems.length > 0 ? 'text-amber-600' : 'text-stone-400'} />
              <span>Low Stock: <strong>{metricsData.lowStockItems.length} item(s)</strong></span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1">
              <Award size={13} className="text-amber-500" />
              <span>Rating: <strong>{metricsData.customerRating.overall}★</strong></span>
            </div>
          </div>
        )}

        {/* Conversation Chat Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-stone-50/40 text-xs">
          {conversation.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="h-7 w-7 rounded-xl bg-brew-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Bot size={15} />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-espresso-900 text-white rounded-br-none shadow-sm'
                    : 'bg-white text-stone-800 border border-stone-200/90 rounded-bl-none shadow-soft'
                }`}
              >
                {msg.text}

                {msg.engine && (
                  <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-end text-[10px] text-stone-400">
                    <span>Engine: {msg.engine === 'gemini-flash' ? 'Google Gemini 2.5 Flash' : 'Telemetry Analytics'}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-stone-500 bg-white border border-stone-200 rounded-2xl px-3.5 py-2.5 max-w-xs shadow-soft">
              <Loader2 size={14} className="animate-spin text-brew-500" />
              <span className="text-xs">Analyzing live sales & kitchen metrics...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-3 py-2 bg-white border-t border-stone-200 overflow-x-auto flex gap-1.5 shrink-0">
          {QUICK_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleAsk(p)}
              disabled={loading}
              className="px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-medium whitespace-nowrap transition border border-stone-200/60"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-stone-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask about sales, high margin items, restock alerts, profits..."
              value={question}
              onChange={e => setQuestion(e.target.value)}
              disabled={loading}
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-brew-500 bg-stone-50"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              <span>Ask</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
