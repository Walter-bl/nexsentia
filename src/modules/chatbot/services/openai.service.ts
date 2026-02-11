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
      throw new Error('Failed to get response from AI service');
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
      throw new Error('Failed to get streaming response from AI service');
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
