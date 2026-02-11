import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAIService } from './openai.service';
import { ContextRetrievalService } from './context-retrieval.service';
import { Conversation } from '../entities/conversation.entity';
import { ChatMessageDto, ChatResponseDto, MessageHistoryDto } from '../dto/chat-message.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    private readonly openaiService: OpenAIService,
    private readonly contextRetrievalService: ContextRetrievalService,
  ) {}

  async chat(tenantId: number, userId: number, chatDto: ChatMessageDto): Promise<ChatResponseDto> {
    const sessionId = chatDto.sessionId || uuidv4();

    // 1. Analyze user intent
    this.logger.log(`Analyzing intent for message: ${chatDto.message.substring(0, 50)}...`);
    const intent = await this.openaiService.analyzeIntent(chatDto.message);
    this.logger.log(`Detected intent: ${JSON.stringify(intent)}`);

    // 2. Retrieve relevant context from database
    const context = await this.contextRetrievalService.retrieveContext(tenantId, intent);
    const formattedContext = this.contextRetrievalService.formatContextForPrompt(context);

    // 3. Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(formattedContext);

    // 4. Prepare messages for OpenAI
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history if provided
    if (chatDto.conversationHistory && chatDto.conversationHistory.length > 0) {
      chatDto.conversationHistory.forEach((msg) => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: chatDto.message });

    // 5. Get response from OpenAI
    const aiResponse = await this.openaiService.chat(messages);

    // 6. Save conversation
    await this.saveConversation(tenantId, userId, sessionId, chatDto.message, aiResponse.content, context);

    // 7. Build response
    return {
      response: aiResponse.content,
      sessionId,
      sources: {
        signals: context.signals?.length || 0,
        incidents: context.incidents?.length || 0,
        issues: context.issues?.length || 0,
        metrics: context.metrics ? 1 : 0,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Stream chat responses in real-time using SSE
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param chatDto - Chat message DTO
   * @param onToken - Callback for each token received
   * @param onMetadata - Callback for metadata (sessionId, sources)
   */
  async chatStream(
    tenantId: number,
    userId: number,
    chatDto: ChatMessageDto,
    onToken: (token: string) => void,
    onMetadata: (metadata: { sessionId: string; sources: any }) => void,
  ): Promise<void> {
    const sessionId = chatDto.sessionId || uuidv4();

    try {
      // 1. Analyze user intent
      this.logger.log(`[Stream] Analyzing intent for message: ${chatDto.message.substring(0, 50)}...`);
      const intent = await this.openaiService.analyzeIntent(chatDto.message);
      this.logger.log(`[Stream] Detected intent: ${JSON.stringify(intent)}`);

      // 2. Retrieve relevant context from database
      const context = await this.contextRetrievalService.retrieveContext(tenantId, intent);
      const formattedContext = this.contextRetrievalService.formatContextForPrompt(context);

      // Send metadata first
      onMetadata({
        sessionId,
        sources: {
          signals: context.signals?.length || 0,
          incidents: context.incidents?.length || 0,
          issues: context.issues?.length || 0,
          metrics: context.metrics ? 1 : 0,
        },
      });

      // 3. Build system prompt with context
      const systemPrompt = this.buildSystemPrompt(formattedContext);

      // 4. Prepare messages for OpenAI
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history if provided
      if (chatDto.conversationHistory && chatDto.conversationHistory.length > 0) {
        chatDto.conversationHistory.forEach((msg) => {
          messages.push({ role: msg.role, content: msg.content });
        });
      }

      // Add current user message
      messages.push({ role: 'user', content: chatDto.message });

      // 5. Stream response from OpenAI
      const fullResponse = await this.openaiService.chatStream(messages, onToken);

      // 6. Save conversation
      await this.saveConversation(tenantId, userId, sessionId, chatDto.message, fullResponse, context);

      this.logger.log(`[Stream] Completed streaming for session ${sessionId}`);
    } catch (error) {
      this.logger.error('[Stream] Error during streaming:', error);
      throw error;
    }
  }

  private buildSystemPrompt(context: string): string {
    return `You are NexSentia AI Assistant, an AI that helps users understand organizational health, weak signals, incidents, and performance metrics.

FORMATTING RULES (CRITICAL - ALWAYS FOLLOW):
1. Always use markdown formatting for responses
2. Use ## for main section headings
3. Use ### for subsection headings
4. Use **bold** for important metrics, numbers, and key terms
5. Use tables for comparing multiple data points
6. Use bullet points for lists
7. Use code blocks for technical data (JSON, SQL, etc.)
8. Use blockquotes (>) for important recommendations or alerts
9. Use inline code (\`text\`) for IDs, status values, and short technical terms
10. Include emojis sparingly: 🔴 (critical), 🟡 (warning), 🟢 (good), ✅ (resolved)

RESPONSE STRUCTURE:
1. Start with a clear heading (##)
2. Provide a brief summary (1-2 sentences)
3. Break down details with subheadings (###)
4. Use tables for metrics/comparisons
5. End with actionable recommendations
6. Include relevant context when applicable

TONE:
- Professional but conversational
- Data-driven and specific
- Actionable and helpful
- Concise but complete

AVAILABLE DATA:
${context || 'No specific data available for this query.'}

IMPORTANT GUIDELINES:
1. **Use the provided data**: Always base your responses on the context data provided above
2. **Be specific**: Reference actual signal IDs, incident numbers (e.g., \`INC0010123\`), and issue keys (e.g., \`PROJ-123\`)
3. **Format metrics properly**: Use tables for comparisons, bold for numbers, inline code for status values
4. **Be actionable**: Provide insights and recommendations with blockquotes (>)
5. **Acknowledge limitations**: If data isn't available, clearly state "No {data type} found" and suggest alternatives

Remember: User cannot see raw data. Present insights in human-readable markdown format with proper context.`;
  }

  private async saveConversation(
    tenantId: number,
    userId: number,
    sessionId: string,
    userMessage: string,
    assistantResponse: string,
    context: any,
  ): Promise<void> {
    try {
      let conversation = await this.conversationRepository.findOne({
        where: { tenantId, sessionId },
      });

      const newMessages = [
        {
          role: 'user' as const,
          content: userMessage,
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: assistantResponse,
          timestamp: new Date().toISOString(),
        },
      ];

      if (conversation) {
        // Update existing conversation
        conversation.messages = [...conversation.messages, ...newMessages];
        conversation.lastMessageAt = new Date();

        // Update metadata
        if (context.signals) {
          conversation.metadata = conversation.metadata || {};
          conversation.metadata.queriedSignals = [
            ...(conversation.metadata.queriedSignals || []),
            ...context.signals.map((s: any) => s.id),
          ];
        }
      } else {
        // Create new conversation
        conversation = this.conversationRepository.create({
          tenantId,
          userId,
          sessionId,
          messages: newMessages,
          metadata: {
            queriedSignals: context.signals?.map((s: any) => s.id) || [],
            queriedIncidents: context.incidents?.map((i: any) => i.id) || [],
            queriedIssues: context.issues?.map((i: any) => i.id) || [],
          },
          lastMessageAt: new Date(),
        });
      }

      await this.conversationRepository.save(conversation);
    } catch (error) {
      this.logger.error('Failed to save conversation:', error);
      // Don't throw - conversation saving is not critical
    }
  }

  async getConversationHistory(tenantId: number, sessionId: string): Promise<MessageHistoryDto[]> {
    const conversation = await this.conversationRepository.findOne({
      where: { tenantId, sessionId },
    });

    if (!conversation) {
      return [];
    }

    return conversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  async deleteConversation(tenantId: number, sessionId: string): Promise<void> {
    await this.conversationRepository.delete({ tenantId, sessionId });
  }
}
