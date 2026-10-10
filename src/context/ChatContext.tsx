import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ChatMessage, ActiveTab, AppData } from '../types';
import {
  loadChatMessages,
  saveChatMessages,
  clearChatMessages,
  loadChatPending,
  saveChatPending,
  clearChatPending,
  getShareDataWithAi,
  setShareDataWithAi,
} from '../utils/storage';
import { sendChatMessage } from '../services/geminiClient';
import { buildUserContextSummary } from '../utils/userContextBuilder';

export const INITIAL_GREETING: ChatMessage = {
  id: 'greeting-msg',
  role: 'assistant',
  content:
    'Olá! Sou seu assistente de musculação, treino de força e nutrição esportiva. Como posso ajudar com sua divisão de treino, progressão de carga, calorias, macros ou hábitos alimentares hoje?',
  timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
};

interface ChatContextValue {
  messages: ChatMessage[];
  loading: boolean;
  resumingMessage: string | null;
  hasUnreadReply: boolean;
  shareDataWithAi: boolean;
  toggleShareDataWithAi: () => void;
  clearUnreadReply: () => void;
  sendMessage: (textToSend?: string) => Promise<void>;
  sendEvolutionAnalysis: () => Promise<void>;
  retryMessage: (content?: string) => Promise<void>;
  clearHistory: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function nowTimeString(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface ChatProviderProps {
  children: React.ReactNode;
  activeTab: ActiveTab;
  appData: AppData;
}

export function ChatProvider({ children, activeTab, appData }: ChatProviderProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = loadChatMessages();
    return saved.length > 0 ? saved : [INITIAL_GREETING];
  });
  const [loading, setLoading] = useState(false);
  const [resumingMessage, setResumingMessage] = useState<string | null>(null);
  const [hasUnreadReply, setHasUnreadReply] = useState(false);
  const [shareDataWithAi, setShareDataWithAiState] = useState<boolean>(() => getShareDataWithAi());

  const messagesRef = useRef<ChatMessage[]>(messages);
  const activeTabRef = useRef<ActiveTab>(activeTab);
  const appDataRef = useRef<AppData>(appData);
  const isRequestInProgressRef = useRef(false);

  // Keep refs synchronized
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    appDataRef.current = appData;
  }, [appData]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === 'chat') {
      setHasUnreadReply(false);
    }
  }, [activeTab]);

  const toggleShareDataWithAi = () => {
    setShareDataWithAiState((prev) => {
      const next = !prev;
      setShareDataWithAi(next);
      return next;
    });
  };

  const clearUnreadReply = () => {
    setHasUnreadReply(false);
  };

  /**
   * Executa a chamada para a API com contexto dos dados reais do usuário (se habilitado)
   */
  const executeApiCall = async (
    questionText: string,
    historySnapshot: ChatMessage[],
    questionId: string
  ) => {
    isRequestInProgressRef.current = true;
    setLoading(true);

    try {
      const validHistory = historySnapshot.filter(
        (m) => !m.isError && typeof m.content === 'string' && m.content.trim().length > 0
      );

      const MAX_CONTEXT_MESSAGES = 30;
      let apiContext =
        validHistory.length > MAX_CONTEXT_MESSAGES
          ? validHistory.slice(-MAX_CONTEXT_MESSAGES)
          : validHistory;

      const firstUserIdx = apiContext.findIndex((m) => m.role === 'user');
      if (firstUserIdx > 0) {
        apiContext = apiContext.slice(firstUserIdx);
      }

      // Constrói resumo compacto de dados reais do usuário se autorizado
      const contextSummary = shareDataWithAi
        ? buildUserContextSummary(appDataRef.current)
        : undefined;

      const { reply } = await sendChatMessage(
        apiContext.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        contextSummary
      );

      if (reply) {
        const assistantMessage: ChatMessage = {
          id: 'msg-' + Date.now() + '-bot',
          role: 'assistant',
          content: reply,
          timestamp: nowTimeString(),
        };

        const updatedMessages = [...messagesRef.current, assistantMessage];
        messagesRef.current = updatedMessages;
        saveChatMessages(updatedMessages);

        clearChatPending();
        setMessages(updatedMessages);

        if (activeTabRef.current !== 'chat') {
          setHasUnreadReply(true);
        }
      }
    } catch (err: any) {
      console.error('[Chat Context] Erro ao obter resposta:', err);
      const fullError = err?.message || 'Falha na comunicação com o serviço de IA.';

      const errorMessage: ChatMessage = {
        id: 'msg-' + Date.now() + '-err',
        role: 'assistant',
        content: fullError,
        timestamp: nowTimeString(),
        isError: true,
        errorCode: 'API_ERROR',
      };

      const updatedWithError = [...messagesRef.current, errorMessage];
      messagesRef.current = updatedWithError;
      saveChatMessages(updatedWithError);

      clearChatPending();
      setMessages(updatedWithError);
    } finally {
      isRequestInProgressRef.current = false;
      setLoading(false);
      setResumingMessage(null);
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || '').trim();
    if (!text || isRequestInProgressRef.current) return;

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now() + '-user',
      role: 'user',
      content: text,
      timestamp: nowTimeString(),
    };

    const newMessages = [...messagesRef.current, userMessage];
    messagesRef.current = newMessages;
    setMessages(newMessages);
    saveChatMessages(newMessages);

    saveChatPending({
      questionId: userMessage.id,
      text,
      timestamp: Date.now(),
    });

    await executeApiCall(text, newMessages, userMessage.id);
  };

  /**
   * Envia pergunta pronta de análise de evolução dos últimos 30 dias
   */
  const sendEvolutionAnalysis = async () => {
    await sendMessage(
      'Analise minha evolução geral (treino, carga, nutrição e água) nos últimos 30 dias, aponte pontos fortes, pontos a melhorar e 3 ações práticas para a próxima semana.'
    );
  };

  const retryMessage = async (content?: string) => {
    if (isRequestInProgressRef.current) return;

    let targetText = content;
    if (!targetText) {
      const lastUser = [...messagesRef.current].reverse().find((m) => m.role === 'user');
      targetText = lastUser?.content;
    }

    if (!targetText) return;
    await sendMessage(targetText);
  };

  const clearHistory = () => {
    clearChatMessages();
    clearChatPending();
    const reset = [INITIAL_GREETING];
    messagesRef.current = reset;
    setMessages(reset);
    setResumingMessage(null);
    setHasUnreadReply(false);
  };

  useEffect(() => {
    const checkAndResumePending = () => {
      if (isRequestInProgressRef.current) return;

      const pending = loadChatPending();
      if (!pending) return;

      const currentList = messagesRef.current;
      const pendingIdx = currentList.findIndex((m) => m.id === pending.questionId);

      let hasReply = false;
      if (pendingIdx !== -1) {
        hasReply = currentList.slice(pendingIdx + 1).some((m) => m.role === 'assistant');
      } else {
        const lastMsg = currentList[currentList.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.isError) {
          hasReply = true;
        }
      }

      if (hasReply) {
        clearChatPending();
        return;
      }

      console.log('[Chat Context] Retomando pergunta pendente:', pending.text);
      setResumingMessage('Retomando sua pergunta...');
      executeApiCall(pending.text, currentList, pending.questionId);
    };

    checkAndResumePending();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndResumePending();
      }
    };

    const handleFocus = () => {
      checkAndResumePending();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        loading,
        resumingMessage,
        hasUnreadReply,
        shareDataWithAi,
        toggleShareDataWithAi,
        clearUnreadReply,
        sendMessage,
        sendEvolutionAnalysis,
        retryMessage,
        clearHistory,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat deve ser usado dentro de um ChatProvider');
  }
  return context;
}
