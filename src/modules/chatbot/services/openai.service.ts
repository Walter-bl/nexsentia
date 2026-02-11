import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not configured. Chatbot will not function.');
    }

    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      timeout: 120000, // 2 minutes timeout for API calls
      maxRetries: 2, // Retry failed requests twice
    });

    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4-turbo-preview');
  }

  async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1500,
      });

      return {
        content: completion.choices[0].message.content || '',
        usage: completion.usage,
      };
    } catch (error) {
      this.logger.error('OpenAI API error:', error);

      // Check for specific error types
      if (error.message?.includes('timeout')) {
        throw new Error('AI service request timed out. Please try again.');
      }
      if (error.message?.includes('network')) {
        throw new Error('Network error connecting to AI service. Please check your connection.');
      }
      if (error.status === 429) {
        throw new Error('AI service rate limit exceeded. Please try again in a moment.');
      }
      if (error.status === 401) {
        throw new Error('AI service authentication failed. Please contact support.');
      }

      throw new Error('Failed to get response from AI service. Please try again.');
    }
  }

  /**
   * Stream chat responses token by token
   * @param messages - Conversation messages
   * @param onToken - Callback fired for each token received
   * @returns Full response content
   */
  async chatStream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onToken: (token: string) => void,
  ): Promise<string> {
    try {
      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1500,
        stream: true,
      });

      let fullContent = '';

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
          fullContent += token;
          onToken(token);
        }
      }

      return fullContent;
    } catch (error) {
      this.logger.error('OpenAI streaming API error:', error);

      // Check for specific error types
      if (error.message?.includes('timeout')) {
        throw new Error('AI service request timed out. Please try again.');
      }
      if (error.message?.includes('network')) {
        throw new Error('Network error during streaming. Please check your connection.');
      }
      if (error.status === 429) {
        throw new Error('AI service rate limit exceeded. Please try again in a moment.');
      }

      throw new Error('Failed to get streaming response from AI service. Please try again.');
    }
  }

  async analyzeIntent(userMessage: string): Promise<{
    topic: string;
    entities: string[];
    timeframe?: string;
    severity?: string;
  }> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an intent analyzer for an IT operations platform.
Analyze the user's message and extract:
- topic: one of [weak-signals, incidents, issues, metrics, teams, overview, general]
- entities: array of relevant entity names (team names, service names, etc.)
- timeframe: if mentioned (today, this week, last month, etc.)
- severity: if mentioned (critical, high, medium, low)

Respond ONLY with valid JSON in this format:
{"topic": "...", "entities": [...], "timeframe": "...", "severity": "..."}`,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const response = completion.choices[0].message.content || '{}';
      return JSON.parse(response);
    } catch (error) {
      this.logger.error('Intent analysis error:', error);
      // Fallback to general topic
      return {
        topic: 'general',
        entities: [],
      };
    }
  }
}
