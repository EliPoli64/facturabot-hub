'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, SendHorizonal, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/lib/dashboard-types';
import { formatTimestamp, generateId, initialBotMessage, quickChips, requestChat } from '@/lib/dashboard-utils';

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialBotMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isChatOpen) {
      window.setTimeout(() => chatInputRef.current?.focus(), 180);
    }
  }, [isChatOpen]);

  const sendMessage = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: generateId('user'),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setChatError(null);

    try {
      const text = await requestChat(trimmed);
      const botMsg: ChatMessage = {
        id: generateId('bot'),
        role: 'bot',
        content: text || 'No hubo respuesta del asistente.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      if (!isChatOpen) {
        setUnreadCount((c) => c + 1);
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'No se pudo conectar con FacturaBot IA.');
      setMessages((prev) => [
        ...prev,
        {
          id: generateId('bot-error'),
          role: 'bot',
          content: 'No pude responder en este momento. Revisa la conexion con el backend e intentalo de nuevo.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isChatOpen]);

  function handleSubmit(): void {
    void sendMessage(input);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  function renderContent(content: string) {
    const parts = content.split(/(₡\s?\d[\d.,]*)/g);

    return parts.map((part, index) => {
      if (/^₡\s?\d[\d.,]*$/.test(part)) {
        return (
          <span
            key={`${part}-${index}`}
            className="rounded bg-emerald-950 px-1 py-0.5 font-mono tabular-nums text-emerald-300"
          >
            {part}
          </span>
        );
      }
      return (
        <span key={`${part}-${index}`} className="[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-slate-100 [&_hr]:border-slate-700 [&_hr]:my-2 [&_p]:leading-6 [&_p]:my-0 [&_code]:rounded [&_code]:bg-slate-700 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_pre>code]:bg-slate-900 [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_a]:text-indigo-400 [&_a]:underline">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
        </span>
      );
    });
  }

  const floatingWindow = (
    <div
      className={`flex w-[420px] h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl transition-all duration-300 ${
        isChatOpen
          ? 'pointer-events-auto scale-100 opacity-100'
          : 'pointer-events-none scale-95 opacity-0'
      }`}
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white">
            <Bot className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100">FacturaBot IA</span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsChatOpen(false)}
          aria-label="Cerrar chat"
          className="rounded-lg border border-slate-700 p-1.5 text-slate-400 transition hover:border-slate-600 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] ${message.role === 'user' ? '' : 'flex items-end gap-2'}`}>
                {message.role === 'bot' && (
                  <div className="mb-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}
                <div>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'rounded-br-sm bg-indigo-600 text-white'
                        : 'rounded-bl-sm bg-slate-800 text-slate-100'
                    }`}
                  >
                    {renderContent(message.content)}
                  </div>
                  <p className="mt-1 px-1 text-xs text-slate-500" suppressHydrationWarning>
                    {formatTimestamp(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-end gap-2">
                <div className="mb-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-slate-800 px-4 py-3">
                  <div className="flex items-center gap-1.5" role="status" aria-label="FacturaBot esta escribiendo">
                    <span className="h-2 w-2 animate-bounce-dot rounded-full bg-slate-400 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce-dot rounded-full bg-slate-400 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce-dot rounded-full bg-slate-400 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {chatError && (
        <div className="mx-4 mb-3 rounded-xl border border-rose-500/20 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
          {chatError}
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-slate-800 px-4 py-3">
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {quickChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => void sendMessage(chip)}
              className="whitespace-nowrap rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-700"
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            ref={chatInputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Preguntale algo a FacturaBot..."
            className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 pl-4 pr-14 text-sm text-slate-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            aria-label="Enviar mensaje"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendHorizonal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Overlay backdrop */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${isChatOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <button
          type="button"
          aria-label="Cerrar chat"
          tabIndex={-1}
          onClick={() => setIsChatOpen(false)}
          className={`absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 ${isChatOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        {floatingWindow}
      </div>

      {/* FAB to open chat */}
      <button
        type="button"
        aria-label="Abrir chat"
        onClick={() => {
          setIsChatOpen(true);
          setUnreadCount(0);
        }}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl transition hover:bg-indigo-500"
      >
        <Bot className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>
    </>
  );
}
