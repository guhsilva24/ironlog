import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Send,
  Dumbbell,
  User,
  Trash2,
  AlertCircle,
  Sparkles,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { useChat } from '../context/ChatContext';

const SUGGESTED_PROMPTS = [
  'Qual a quantidade recomendada de proteína por kg?',
  'Como estruturar uma boa divisão de treino ABC?',
  'Dicas para melhorar a técnica do agachamento',
  'O que comer antes e depois do treino de força?',
];

export function ChatSection() {
  const {
    messages,
    loading,
    resumingMessage,
    shareDataWithAi,
    toggleShareDataWithAi,
    sendMessage,
    sendEvolutionAnalysis,
    retryMessage,
    clearHistory,
  } = useChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Scroll to bottom whenever messages update or loading starts
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : input).trim();
    if (!text || loading) return;

    setInput('');
    await sendMessage(text);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleRetry = (contentToRetry?: string) => {
    if (loading) return;
    retryMessage(contentToRetry);
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Limpar Conversa',
    isDestructive: true,
    onConfirm: () => {},
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading) {
        handleSend();
      }
    }
  };

  const handleClearHistory = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Limpar Histórico do Chat',
      message: 'Deseja realmente limpar todo o histórico da conversa com o assistente?',
      confirmLabel: 'Limpar Conversa',
      isDestructive: true,
      onConfirm: () => {
        clearHistory();
      },
    });
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
      {/* Header with Title and Clear Chat Button */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Assistente IronLog
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700">
                <Sparkles className="w-3 h-3" /> IA
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Tire dúvidas sobre exercícios, periodização, cargas e nutrição esportiva
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Chave: Compartilhar meus dados com a IA */}
          <button
            id="chat-toggle-share-data-btn"
            type="button"
            onClick={toggleShareDataWithAi}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              shareDataWithAi
                ? 'bg-violet-50 text-violet-700 border-violet-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
            title="Ative para que o assistente conheça seus treinos, cargas, macros e água reais"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                shareDataWithAi ? 'bg-violet-600' : 'bg-slate-400'
              }`}
            />
            <span className="hidden sm:inline">Compartilhar dados com a IA:</span>
            <span className="font-bold">{shareDataWithAi ? 'Ativo' : 'Desativado'}</span>
          </button>

          {/* Botão: Analisar minha evolução */}
          <button
            id="chat-analyze-evolution-btn"
            type="button"
            disabled={loading}
            onClick={() => sendEvolutionAnalysis()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="Enviar solicitação de análise detalhada dos últimos 30 dias"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <span className="hidden md:inline">Analisar minha evolução</span>
          </button>

          {messages.length > 1 && (
            <button
              id="chat-clear-history-button"
              type="button"
              onClick={handleClearHistory}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Limpar histórico da conversa"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Container */}
      <div
        id="chat-messages-container"
        className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5 overflow-y-auto space-y-4"
      >
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 border border-violet-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  {msg.isError ? (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Dumbbell className="w-4 h-4" />
                  )}
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-2xs ${
                  isUser
                    ? 'bg-slate-900 text-white rounded-tr-xs'
                    : msg.isError
                    ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-xs'
                    : 'bg-slate-100 text-slate-800 border border-slate-200/80 rounded-tl-xs'
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : msg.isError ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-rose-700 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {msg.errorCode ? `Falha na API (${msg.errorCode})` : 'Erro na requisição'}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-xs font-mono bg-rose-100/70 p-2 rounded-lg border border-rose-200 text-rose-900 select-all overflow-x-auto leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="leading-relaxed space-y-2 select-text prose prose-sm max-w-none text-slate-800 font-normal">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                )}

                <div
                  className={`mt-1.5 flex items-center justify-end gap-1.5 text-[10px] ${
                    isUser ? 'text-slate-300' : msg.isError ? 'text-rose-500' : 'text-slate-400'
                  }`}
                >
                  <span>{msg.timestamp}</span>
                  {msg.isError && (
                    <button
                      type="button"
                      onClick={() => {
                        // Find the corresponding user message preceding this error
                        const prevUser = [...messages.slice(0, index)]
                          .reverse()
                          .find((m) => m.role === 'user');
                        handleRetry(prevUser?.content);
                      }}
                      disabled={loading}
                      className="ml-2 inline-flex items-center gap-1 font-bold underline hover:text-rose-700 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Tentar novamente
                    </button>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator / Loading / Resuming */}
        {loading && (
          <div className="flex items-start gap-2.5 justify-start animate-in fade-in duration-200">
            <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 border border-violet-200 flex items-center justify-center shrink-0 mt-0.5">
              <Dumbbell className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-slate-100 border border-slate-200/80 rounded-2xl rounded-tl-xs px-4 py-3 text-sm text-slate-600 flex items-center gap-2 shadow-2xs">
              <Loader2 className="w-4 h-4 animate-spin text-violet-600 shrink-0" />
              <span className="text-xs font-medium">
                {resumingMessage || 'Analisando e gerando resposta...'}
              </span>
            </div>
          </div>
        )}

        {/* Suggestion Chips shown if conversation only has greeting */}
        {messages.length === 1 && !loading && (
          <div className="pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Sugestões de perguntas:
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => sendEvolutionAnalysis()}
                className="text-xs text-left bg-violet-50 hover:bg-violet-100 text-violet-800 font-bold border border-violet-200 rounded-xl px-3 py-1.5 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                <span>Analisar minha evolução geral (30 dias)</span>
              </button>
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  id={`chat-suggestion-chip-${idx}`}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="text-xs text-left bg-slate-50 hover:bg-violet-50 text-slate-700 hover:text-violet-800 border border-slate-200 hover:border-violet-300 rounded-xl px-3 py-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form, State Warning & Disclaimer */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs space-y-2">
        {loading && (
          <div
            id="chat-pending-warning"
            className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-100 rounded-xl text-xs font-medium"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>
              {resumingMessage
                ? 'Retomando sua pergunta... Aguarde a resposta para enviar uma nova.'
                : 'Aguardando resposta da pergunta anterior. Envio bloqueado até a resposta chegar.'}
            </span>
          </div>
        )}

        <form
          id="chat-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            id="chat-message-textarea"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              loading
                ? 'Aguardando resposta do assistente...'
                : 'Pergunte sobre exercícios, execução, divisão, calorias...'
            }
            rows={1}
            disabled={loading}
            className="flex-1 resize-none max-h-32 min-h-[44px] px-3.5 py-2.5 bg-slate-50 focus:bg-white disabled:bg-slate-100 disabled:opacity-60 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none text-sm text-slate-800 placeholder-slate-400 transition-all"
          />

          <button
            id="chat-send-message-button"
            type="submit"
            disabled={!input.trim() || loading}
            title={
              loading
                ? 'Aguardando resposta da pergunta anterior...'
                : 'Enviar mensagem'
            }
            className="h-11 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar</span>
              </>
            )}
          </button>
        </form>

        {/* User Required Disclaimer */}
        <p
          id="chat-disclaimer-text"
          className="text-center text-[11px] text-slate-400 leading-tight px-2"
        >
          Este chat oferece orientações gerais e não substitui acompanhamento profissional de educador físico, médico ou nutricionista.
        </p>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        isDestructive={confirmModal.isDestructive}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
}
