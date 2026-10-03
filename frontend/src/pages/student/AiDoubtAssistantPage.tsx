import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import axios from 'axios';
import { Bot, CircleUserRound, RotateCcw, Send, Sparkles } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { studentAiAssistantService, type DoubtConversationMessage } from '../../services/studentAiAssistant.service';

type ChatMessage = DoubtConversationMessage & { id: string; createdAt: string };

const suggestions = [
  'Explain Python loops',
  'What is SQL JOIN?',
  'Explain OOP simply',
  'What is machine learning?',
  'Help me understand Excel VLOOKUP',
  'Give me a simple example',
];

function renderMessage(content: string) {
  const blocks = content.split(/(```[^\n]*\n[\s\S]*?```)/g).filter(Boolean);
  return blocks.map((block, index) => {
    if (block.startsWith('```') && block.endsWith('```')) {
      const firstLineEnd = block.indexOf('\n');
      const language = firstLineEnd > 3 ? block.slice(3, firstLineEnd).trim() : '';
      const code = block.slice(firstLineEnd + 1, -3).replace(/^\n|\n$/g, '');
      return <pre key={index} className="my-3 max-w-full overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-xs leading-5 text-[var(--color-text)]"><code data-language={language}>{code}</code></pre>;
    }
    return <p key={index} className="whitespace-pre-wrap break-words text-sm leading-6">{block.trim()}</p>;
  });
}

export function AiDoubtAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [failedPrompt, setFailedPrompt] = useState('');
  const isSendingRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const latestMessageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    latestMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending, error]);

  const submitQuestion = async (rawMessage: string, retry = false) => {
    const message = rawMessage.trim();
    if (!message || isSendingRef.current) return;
    isSendingRef.current = true;
    setIsSending(true);
    setError('');
    setFailedPrompt('');

    const conversationMessages = retry ? messages.slice(0, -1) : messages;
    const conversation = conversationMessages.slice(-12).map(({ role, content }) => ({ role, content }));
    if (!retry) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: message, createdAt: new Date().toISOString() }]);
    }
    setDraft('');
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await studentAiAssistantService.sendMessage(message, conversation, controller.signal);
      if (controller.signal.aborted) return;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: response.data.data.reply, createdAt: new Date().toISOString() }]);
    } catch (cause) {
      if (controller.signal.aborted) return;
      const status = axios.isAxiosError(cause) ? cause.response?.status : undefined;
      const friendlyMessage = status === 401
        ? 'Your session has expired. Sign in again to continue.'
        : status === 400
          ? 'Please shorten your question or start a new chat.'
          : 'AI Assistant is temporarily unavailable. Please try again.';
      setFailedPrompt(message);
      setError(friendlyMessage);
    } finally {
      if (!controller.signal.aborted) {
        requestRef.current = null;
        isSendingRef.current = false;
        setIsSending(false);
      }
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitQuestion(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitQuestion(draft);
    }
  };

  const startNewChat = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    isSendingRef.current = false;
    setMessages([]);
    setDraft('');
    setError('');
    setFailedPrompt('');
    setIsSending(false);
  };

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader
        title="AI Doubt Assistant"
        subtitle="Ask academic questions and get clear, practical explanations."
        action={<Button variant="outline" aria-label="New chat" title="New chat" disabled={isSending && !requestRef.current} onClick={startNewChat}><RotateCcw className="h-4 w-4" /><span>New Chat</span></Button>}
      />

      <Card className="flex min-w-0 flex-col overflow-hidden p-0">
        <div ref={scrollContainerRef} className="max-h-[calc(100vh-18rem)] min-h-[24rem] overflow-y-auto p-4 md:p-6" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 ? (
            <div className="flex min-h-[20rem] flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-green)] text-[var(--color-card)]"><Sparkles className="h-5 w-5 text-[var(--color-primary)]" /></div>
              <h2 className="mt-4 text-xl font-semibold text-[var(--color-text)]">Hi! I'm your AI Doubt Assistant.</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-muted)]">Ask me anything you're learning. I can explain concepts, solve problems, give examples, and help you understand difficult topics.</p>
              <div className="mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={isSending} onClick={() => void submitQuestion(suggestion)} className="rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text)] transition hover:border-[var(--color-primary)] disabled:opacity-60">{suggestion}</button>)}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
              {messages.map((message) => <div key={message.id} className={`flex min-w-0 items-start gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' ? <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-green)] text-[var(--color-card)]"><Bot className="h-4 w-4" /></div> : null}
                <div className={`min-w-0 max-w-[88%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-[var(--color-green)] text-[var(--color-card)]' : 'border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]'}`}>
                  {renderMessage(message.content)}
                  <time className={`mt-2 block text-right text-[11px] ${message.role === 'user' ? 'text-[var(--color-card)]/70' : 'text-[var(--color-muted)]'}`}>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                </div>
                {message.role === 'user' ? <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-vanilla)] text-[var(--color-green)]"><CircleUserRound className="h-4 w-4" /></div> : null}
              </div>)}
              {isSending ? <div className="flex items-center gap-3" role="status"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-green)] text-[var(--color-card)]"><Bot className="h-4 w-4" /></div><div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-sm text-[var(--color-muted)]">AI is thinking...</div></div> : null}
              <div ref={latestMessageRef} />
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] bg-[var(--color-card)] p-3 md:p-4">
          {error ? <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3" role="alert"><p className="text-sm text-[var(--color-text)]">{error}</p>{failedPrompt ? <Button variant="outline" size="sm" disabled={isSending} onClick={() => void submitQuestion(failedPrompt, true)}>Retry</Button> : null}</div> : null}
          <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-4xl items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Ask your doubt</span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
                onKeyDown={handleKeyDown}
                maxLength={4000}
                rows={2}
                placeholder="Ask anything you are learning..."
                aria-label="Ask your doubt"
                className="max-h-36 min-h-12 w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)]"
              />
              <span className="mt-1 block text-right text-[11px] text-[var(--color-muted)]">{draft.length}/4000</span>
            </label>
            <Button type="submit" aria-label="Send message" title="Send message" disabled={isSending || !draft.trim()} loading={isSending} className="mb-5 shrink-0 px-3"><Send className="h-4 w-4" /><span className="sr-only">Send</span></Button>
          </form>
        </div>
      </Card>
    </div>
  );
}