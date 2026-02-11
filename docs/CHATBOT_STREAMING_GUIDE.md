# NexSentia AI Chatbot - Streaming (SSE) Guide

## Overview

The chatbot now supports **Server-Sent Events (SSE)** for real-time streaming responses, providing a ChatGPT-like experience where users see the response being generated token by token.

## Why Use Streaming?

**Benefits:**
- ✅ Better UX - Users see responses building in real-time
- ✅ No "frozen" UI during long responses
- ✅ Perceived faster response time
- ✅ More engaging user experience

**When to Use:**
- Use streaming for web UI where UX matters
- Use REST API for mobile apps, simple integrations, or when streaming isn't needed

## API Endpoints

### Streaming Endpoint
**POST** `/chatbot/chat-stream`

**Request:** (Same as REST endpoint)
```json
{
  "message": "Show me critical weak signals",
  "conversationHistory": [],
  "sessionId": "optional-uuid"
}
```

**Response:** Server-Sent Events stream with three event types:

1. **metadata** - Sent first
```json
{
  "type": "metadata",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "sources": {
    "signals": 10,
    "incidents": 5,
    "issues": 8,
    "metrics": 1
  }
}
```

2. **token** - Sent for each word/token
```json
{
  "type": "token",
  "content": "Here "
}
```

3. **done** - Sent when complete
```json
{
  "type": "done"
}
```

---

## React Implementation (with Streaming)

### 1. Enhanced Chat Service with Streaming

```typescript
// src/services/chatbot.service.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface StreamEvent {
  type: 'metadata' | 'token' | 'done';
  content?: string;
  sessionId?: string;
  sources?: {
    signals?: number;
    incidents?: number;
    issues?: number;
    metrics?: number;
  };
}

class ChatbotService {
  private getHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Stream chat responses using SSE
   * @param message - User message
   * @param onToken - Callback for each token received
   * @param onMetadata - Callback for metadata (sessionId, sources)
   * @param onComplete - Callback when streaming completes
   * @param onError - Callback for errors
   * @param sessionId - Optional session ID
   * @param conversationHistory - Optional conversation history
   */
  async sendMessageStream(
    message: string,
    onToken: (token: string) => void,
    onMetadata: (sessionId: string, sources: any) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
    sessionId?: string,
    conversationHistory?: ChatMessage[]
  ): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/chatbot/chat-stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            try {
              const event: StreamEvent = JSON.parse(data);

              switch (event.type) {
                case 'metadata':
                  if (event.sessionId && event.sources) {
                    onMetadata(event.sessionId, event.sources);
                  }
                  break;
                case 'token':
                  if (event.content) {
                    onToken(event.content);
                  }
                  break;
                case 'done':
                  onComplete();
                  return;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  // Keep the REST method for fallback
  async sendMessage(
    message: string,
    sessionId?: string,
    conversationHistory?: ChatMessage[]
  ): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/chatbot/chat`,
      { message, sessionId, conversationHistory },
      { headers: this.getHeaders() }
    );
    return response.data;
  }
}

export default new ChatbotService();
```

### 2. Enhanced Chat Hook with Streaming

```typescript
// src/hooks/useChatbot.ts
import { useState, useCallback, useRef } from 'react';
import chatbotService, { ChatMessage } from '../services/chatbot.service';

export const useChatbot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamingMessageRef = useRef<string>('');

  const sendMessage = useCallback(async (message: string, useStreaming = true) => {
    if (!message.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    if (useStreaming) {
      // Use streaming
      setIsStreaming(true);
      streamingMessageRef.current = '';

      // Add empty assistant message that will be filled
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }]);

      await chatbotService.sendMessageStream(
        message,
        // onToken
        (token: string) => {
          streamingMessageRef.current += token;
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content = streamingMessageRef.current;
            return newMessages;
          });
        },
        // onMetadata
        (newSessionId: string, sources: any) => {
          setSessionId(newSessionId);
          console.log('Sources:', sources);
        },
        // onComplete
        () => {
          setIsLoading(false);
          setIsStreaming(false);
        },
        // onError
        (err: Error) => {
          setError(err.message);
          setIsLoading(false);
          setIsStreaming(false);
          // Remove the empty assistant message
          setMessages(prev => prev.slice(0, -1));
        },
        sessionId || undefined,
        messages
      );
    } else {
      // Use REST API (fallback)
      try {
        const response = await chatbotService.sendMessage(
          message,
          sessionId || undefined,
          messages
        );

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.response,
          timestamp: response.timestamp,
        };
        setMessages(prev => [...prev, assistantMessage]);
        setSessionId(response.sessionId);
      } catch (err: any) {
        setError(err.message || 'Failed to send message');
        setMessages(prev => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    }
  }, [messages, sessionId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, []);

  return {
    messages,
    sessionId,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
  };
};
```

### 3. Chat Component with Streaming

```typescript
// src/components/Chatbot.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useChatbot } from '../hooks/useChatbot';
import './Chatbot.css';

export const Chatbot: React.FC = () => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, isStreaming, error, sendMessage, clearMessages } = useChatbot();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    await sendMessage(input);
    setInput('');
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h2>NexSentia AI Assistant</h2>
        <button onClick={clearMessages} className="clear-btn">Clear</button>
      </div>

      <div className="chatbot-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              {msg.content}
              {isStreaming && idx === messages.length - 1 && (
                <span className="cursor">▊</span>
              )}
            </div>
          </div>
        ))}
        {error && (
          <div className="message error">
            <div className="message-content">❌ {error}</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chatbot-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about signals, incidents, or issues..."
          disabled={isLoading}
          className="chatbot-input"
        />
        <button type="submit" disabled={isLoading || !input.trim()} className="send-btn">
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
};
```

### 4. Enhanced CSS with Streaming Cursor

```css
/* src/components/Chatbot.css */
.chatbot-container {
  display: flex;
  flex-direction: column;
  height: 600px;
  max-width: 800px;
  margin: 0 auto;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.chatbot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.chatbot-header h2 {
  margin: 0;
  font-size: 18px;
}

.clear-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.clear-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.chatbot-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f9fafb;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.5;
  max-width: 70%;
}

.message.user .message-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom-right-radius: 4px;
}

.message.assistant .message-content {
  background: white;
  border: 1px solid #e5e7eb;
  border-bottom-left-radius: 4px;
}

.message.error .message-content {
  background: #fee;
  color: #c00;
  border: 1px solid #fcc;
}

/* Streaming cursor animation */
.cursor {
  display: inline-block;
  margin-left: 2px;
  animation: blink 1s infinite;
  color: #667eea;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.chatbot-input-form {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #eee;
  background: white;
}

.chatbot-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 24px;
  font-size: 14px;
  outline: none;
}

.chatbot-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.chatbot-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.send-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
```

---

## Vue 3 Implementation (with Streaming)

### 1. Composable with Streaming

```typescript
// src/composables/useChatbot.ts
import { ref, Ref } from 'vue';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export function useChatbot() {
  const messages: Ref<ChatMessage[]> = ref([]);
  const sessionId: Ref<string | null> = ref(null);
  const isLoading = ref(false);
  const isStreaming = ref(false);
  const error: Ref<string | null> = ref(null);

  const sendMessage = async (message: string, useStreaming = true) => {
    if (!message.trim()) return;

    // Add user message
    messages.value.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    isLoading.value = true;
    error.value = null;

    if (useStreaming) {
      isStreaming.value = true;
      let streamingContent = '';

      // Add empty assistant message
      messages.value.push({
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      });

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/chatbot/chat-stream', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId: sessionId.value,
          conversationHistory: messages.value.slice(0, -1),
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        error.value = 'Response body is not readable';
        isLoading.value = false;
        isStreaming.value = false;
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            try {
              const event = JSON.parse(data);

              if (event.type === 'metadata') {
                sessionId.value = event.sessionId;
              } else if (event.type === 'token') {
                streamingContent += event.content;
                messages.value[messages.value.length - 1].content = streamingContent;
              } else if (event.type === 'done') {
                isLoading.value = false;
                isStreaming.value = false;
                return;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    }
  };

  const clearMessages = () => {
    messages.value = [];
    sessionId.value = null;
    error.value = null;
  };

  return {
    messages,
    sessionId,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
  };
}
```

---

## Vanilla JavaScript (with Streaming)

```javascript
// chatbot-streaming.js
class ChatbotStreaming {
  constructor(apiBaseUrl, getToken) {
    this.apiBaseUrl = apiBaseUrl;
    this.getToken = getToken;
    this.sessionId = null;
    this.messages = [];
  }

  async sendMessageStream(message, onToken, onMetadata, onComplete, onError) {
    try {
      const token = this.getToken();
      const response = await fetch(`${this.apiBaseUrl}/chatbot/chat-stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId: this.sessionId,
          conversationHistory: this.messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            try {
              const event = JSON.parse(data);

              switch (event.type) {
                case 'metadata':
                  this.sessionId = event.sessionId;
                  onMetadata(event.sessionId, event.sources);
                  break;
                case 'token':
                  onToken(event.content);
                  break;
                case 'done':
                  onComplete();
                  return;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      onError(error);
    }
  }
}

// Usage example
const chatbot = new ChatbotStreaming(
  'http://localhost:3000',
  () => localStorage.getItem('token')
);

const messageDiv = document.getElementById('assistant-message');
let fullContent = '';

chatbot.sendMessageStream(
  'Show me critical weak signals',
  // onToken
  (token) => {
    fullContent += token;
    messageDiv.textContent = fullContent;
  },
  // onMetadata
  (sessionId, sources) => {
    console.log('Session:', sessionId, 'Sources:', sources);
  },
  // onComplete
  () => {
    console.log('Streaming complete');
  },
  // onError
  (error) => {
    console.error('Error:', error);
  }
);
```

---

## Best Practices

### 1. Error Handling

```typescript
// Always handle connection errors
try {
  await chatbotService.sendMessageStream(
    message,
    onToken,
    onMetadata,
    onComplete,
    (error) => {
      // Fallback to REST API if streaming fails
      chatbotService.sendMessage(message).then(response => {
        // Handle response
      });
    }
  );
} catch (error) {
  // Handle error
}
```

### 2. Cancel Streaming

```typescript
// Store abort controller to cancel streaming
const abortController = new AbortController();

fetch(url, {
  signal: abortController.signal,
  // ... other options
});

// Cancel when needed
abortController.abort();
```

### 3. Reconnection Logic

```typescript
// Implement retry logic for connection failures
let retryCount = 0;
const maxRetries = 3;

const sendWithRetry = async () => {
  try {
    await sendMessageStream(/*...*/);
  } catch (error) {
    if (retryCount < maxRetries) {
      retryCount++;
      setTimeout(sendWithRetry, 1000 * retryCount);
    } else {
      // Fallback to REST
    }
  }
};
```

### 4. Performance

```typescript
// Debounce UI updates for smoother streaming
import { debounce } from 'lodash';

const updateMessage = debounce((content: string) => {
  setMessageContent(content);
}, 16); // ~60fps

// Use in onToken callback
onToken: (token) => {
  fullContent += token;
  updateMessage(fullContent);
}
```

---

## Comparison: REST vs Streaming

| Feature | REST API | SSE Streaming |
|---------|----------|---------------|
| **UX** | Wait for complete response | See response build in real-time |
| **Latency** | Higher perceived latency | Lower perceived latency |
| **Complexity** | Simple | Moderate |
| **Browser Support** | All browsers | Modern browsers |
| **Mobile Support** | Excellent | Good |
| **Fallback** | N/A | REST API |
| **Use Case** | Simple integrations, mobile | Web UI, better UX |

## Recommendation

1. **Use streaming for web UI** - Better UX
2. **Provide REST fallback** - For compatibility
3. **Keep both endpoints** - Let clients choose

---

## Troubleshooting

### Streaming not working?

1. **Check browser support** - SSE requires modern browsers
2. **Check network** - Some proxies/firewalls block streaming
3. **Fallback to REST** - Always implement fallback logic
4. **Check CORS** - Ensure CORS headers allow streaming

### Tokens arriving slowly?

1. **Check OpenAI model** - GPT-4 is slower than GPT-3.5
2. **Network latency** - Check connection speed
3. **Backend processing** - Check intent analysis time

---

**Ready to implement streaming! 🚀**
