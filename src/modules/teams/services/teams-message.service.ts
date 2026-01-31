import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like, Between } from 'typeorm';
import { TeamsMessage } from '../entities/teams-message.entity';

export interface TeamsMessageFilters {
  channelId?: number;
  userId?: number;
  teamId?: string;
  teamsChannelId?: string;
  teamsUserId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  messageType?: string;
  hasReactions?: boolean;
  isDeleted?: boolean;
  replyToId?: string;
}

@Injectable()
export class TeamsMessageService {
  constructor(
    @InjectRepository(TeamsMessage)
    private readonly messageRepository: Repository<TeamsMessage>,
  ) {}

  /**
   * Find messages with filters
   */
  async findAll(
    tenantId: number,
    filters?: TeamsMessageFilters,
    limit: number = 100,
    offset: number = 0,
  ): Promise<TeamsMessage[]> {
    const where: FindOptionsWhere<TeamsMessage> = { tenantId };

    if (filters?.channelId) where.channelId = filters.channelId;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.teamId) where.teamId = filters.teamId;
    if (filters?.teamsChannelId) where.teamsChannelId = filters.teamsChannelId;
    if (filters?.teamsUserId) where.teamsUserId = filters.teamsUserId;
    if (filters?.messageType) where.messageType = filters.messageType;
    if (filters?.isDeleted !== undefined) where.isDeleted = filters.isDeleted;
    if (filters?.replyToId) where.replyToId = filters.replyToId;

    if (filters?.dateFrom && filters?.dateTo) {
      where.createdDateTime = Between(filters.dateFrom, filters.dateTo);
    } else if (filters?.dateFrom) {
      where.createdDateTime = Between(filters.dateFrom, new Date());
    }

    return this.messageRepository.find({
      where,
      relations: ['channel', 'user'],
      order: { createdDateTime: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Find a single message
   */
  async findOne(id: number, tenantId: number): Promise<TeamsMessage> {
    const message = await this.messageRepository.findOne({
      where: { id, tenantId },
      relations: ['channel', 'user'],
    });

    if (!message) {
      throw new Error('Message not found');
    }

    return message;
  }

  /**
   * Get thread messages (replies)
   */
  async getThreadMessages(
    messageId: string,
    tenantId: number,
  ): Promise<TeamsMessage[]> {
    return this.messageRepository.find({
      where: { tenantId, replyToId: messageId },
      relations: ['user'],
      order: { createdDateTime: 'ASC' },
    });
  }

  /**
   * Search messages by content
   */
  async search(
    tenantId: number,
    searchText: string,
    filters?: TeamsMessageFilters,
    limit: number = 50,
  ): Promise<TeamsMessage[]> {
    const where: FindOptionsWhere<TeamsMessage> = {
      tenantId,
      content: Like(`%${searchText}%`),
    };

    if (filters?.channelId) where.channelId = filters.channelId;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.teamId) where.teamId = filters.teamId;
    if (filters?.isDeleted !== undefined) where.isDeleted = filters.isDeleted;

    return this.messageRepository.find({
      where,
      relations: ['channel', 'user'],
      order: { createdDateTime: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get messages with reactions
   */
  async getMessagesWithReactions(
    tenantId: number,
    limit: number = 50,
  ): Promise<TeamsMessage[]> {
    return this.messageRepository
      .createQueryBuilder('message')
      .where('message.tenantId = :tenantId', { tenantId })
      .andWhere("message.reactions IS NOT NULL")
      .andWhere("JSON_LENGTH(message.reactions) > 0")
      .leftJoinAndSelect('message.channel', 'channel')
      .leftJoinAndSelect('message.user', 'user')
      .orderBy('message.createdDateTime', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Get message statistics
   */
  async getStatistics(tenantId: number, teamId?: string): Promise<any> {
    const query = this.messageRepository
      .createQueryBuilder('message')
      .where('message.tenantId = :tenantId', { tenantId });

    if (teamId) {
      query.andWhere('message.teamId = :teamId', { teamId });
    }

    const totalMessages = await query.getCount();
    const deletedMessages = await query.andWhere('message.isDeleted = :isDeleted', { isDeleted: true }).getCount();

    return {
      totalMessages,
      deletedMessages,
      activeMessages: totalMessages - deletedMessages,
    };
  }
}
