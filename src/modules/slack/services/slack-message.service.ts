import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, In } from 'typeorm';
import { SlackMessage } from '../entities/slack-message.entity';

@Injectable()
export class SlackMessageService {
  constructor(
    @InjectRepository(SlackMessage)
    private readonly messageRepository: Repository<SlackMessage>,
  ) {}

  /**
   * Get messages with filtering
   */
  async findAll(tenantId: number, filters?: {
    channelId?: number;
    channelIds?: number[];
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    hasReactions?: boolean;
    isThread?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ messages: SlackMessage[]; total: number }> {
    const where: any = { tenantId };

    if (filters?.channelId) {
      where.channelId = filters.channelId;
    }

    if (filters?.channelIds && filters.channelIds.length > 0) {
      where.channelId = In(filters.channelIds);
    }

    if (filters?.userId) {
      where.slackUserId = filters.userId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.slackCreatedAt = Between(
        filters.startDate || new Date('2000-01-01'),
        filters.endDate || new Date(),
      );
    }

    if (filters?.isThread !== undefined) {
      where.isThreadReply = filters.isThread;
    }

    const options: FindManyOptions<SlackMessage> = {
      where,
      order: { slackCreatedAt: 'DESC' },
      relations: ['channel'],
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    };

    const [messages, total] = await this.messageRepository.findAndCount(options);

    // Filter by reactions if requested
    let filteredMessages = messages;
    if (filters?.hasReactions) {
      filteredMessages = messages.filter(m => m.reactions && m.reactions.length > 0);
    }

    return {
      messages: filteredMessages,
      total: filters?.hasReactions ? filteredMessages.length : total,
    };
  }

  /**
   * Get a single message
   */
  async findOne(id: number, tenantId: number): Promise<SlackMessage> {
    const message = await this.messageRepository.findOne({
      where: { id, tenantId },
      relations: ['channel'],
    });

    if (!message) {
      throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
    }

    return message;
  }

  /**
   * Get thread replies for a message
   */
  async getThreadReplies(
    messageTs: string,
    tenantId: number,
  ): Promise<SlackMessage[]> {
    return this.messageRepository.find({
      where: {
        tenantId,
        slackThreadTs: messageTs,
      },
      order: { slackCreatedAt: 'ASC' },
    });
  }

  /**
   * Search messages by text
   */
  async search(
    tenantId: number,
    searchText: string,
    filters?: {
      channelId?: number;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ messages: SlackMessage[]; total: number }> {
    const query = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.channel', 'channel')
      .where('message.tenantId = :tenantId', { tenantId })
      .andWhere('message.text LIKE :searchText', { searchText: `%${searchText}%` });

    if (filters?.channelId) {
      query.andWhere('message.channelId = :channelId', { channelId: filters.channelId });
    }

    query
      .orderBy('message.slackCreatedAt', 'DESC')
      .take(filters?.limit || 50)
      .skip(filters?.offset || 0);

    const [messages, total] = await query.getManyAndCount();

    return { messages, total };
  }
}
