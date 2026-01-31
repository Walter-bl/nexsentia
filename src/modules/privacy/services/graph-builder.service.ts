import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { GraphNode } from '../entities/graph-node.entity';
import { GraphEdge } from '../entities/graph-edge.entity';

@Injectable()
export class GraphBuilderService {
  private readonly logger = new Logger(GraphBuilderService.name);

  constructor(
    @InjectRepository(GraphNode)
    private readonly nodeRepository: Repository<GraphNode>,
    @InjectRepository(GraphEdge)
    private readonly edgeRepository: Repository<GraphEdge>,
  ) {}

  /**
   * Create or update a node
   */
  async createOrUpdateNode(
    tenantId: number,
    nodeType: string,
    externalId: string,
    sourceSystem: string,
    displayName?: string,
    properties?: any,
    labels?: string[],
  ): Promise<GraphNode> {
    // Check if node exists
    let node = await this.nodeRepository.findOne({
      where: {
        tenantId,
        nodeType,
        externalId,
      },
    });

    if (node) {
      // Update existing node
      node.displayName = displayName || node.displayName;
      node.properties = properties || node.properties;
      node.labels = labels || node.labels;
      node.isActive = true;
    } else {
      // Create new node
      node = this.nodeRepository.create({
        tenantId,
        nodeType,
        externalId,
        sourceSystem,
        displayName,
        properties,
        labels,
        isActive: true,
      });
    }

    return await this.nodeRepository.save(node);
  }

  /**
   * Create or update an edge
   */
  async createOrUpdateEdge(
    tenantId: number,
    fromNodeId: number,
    toNodeId: number,
    relationshipType: string,
    properties?: any,
  ): Promise<GraphEdge> {
    // Check if edge exists
    let edge = await this.edgeRepository.findOne({
      where: {
        tenantId,
        fromNodeId,
        toNodeId,
        relationshipType,
      },
    });

    if (edge) {
      // Update existing edge
      edge.properties = properties || edge.properties;
      edge.isActive = true;
    } else {
      // Create new edge
      edge = this.edgeRepository.create({
        tenantId,
        fromNodeId,
        toNodeId,
        relationshipType,
        properties,
        isActive: true,
      });
    }

    return await this.edgeRepository.save(edge);
  }

  /**
   * Build graph from Jira data
   */
  async buildFromJiraData(
    tenantId: number,
    issues: any[],
    projects: any[],
  ): Promise<{ nodesCreated: number; edgesCreated: number }> {
    let nodesCreated = 0;
    let edgesCreated = 0;

    // Create project nodes
    for (const project of projects) {
      await this.createOrUpdateNode(
        tenantId,
        'project',
        project.jiraProjectId,
        'jira',
        project.name,
        {
          key: project.key,
          description: project.description,
          projectType: project.projectType,
        },
        ['jira', 'project'],
      );
      nodesCreated++;
    }

    // Create issue nodes and relationships
    for (const issue of issues) {
      // Create issue node
      const issueNode = await this.createOrUpdateNode(
        tenantId,
        'issue',
        issue.jiraIssueId,
        'jira',
        issue.summary,
        {
          key: issue.key,
          status: issue.status,
          priority: issue.priority,
          issueType: issue.issueType,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
        },
        ['jira', 'issue', issue.issueType?.toLowerCase()],
      );
      nodesCreated++;

      // Create edge to project
      if (issue.projectId) {
        const projectNode = await this.nodeRepository.findOne({
          where: {
            tenantId,
            nodeType: 'project',
            externalId: String(issue.projectId),
          },
        });

        if (projectNode) {
          await this.createOrUpdateEdge(
            tenantId,
            issueNode.id,
            projectNode.id,
            'belongs_to',
            { createdAt: issue.createdAt },
          );
          edgesCreated++;
        }
      }

      // Create user nodes for assignee and reporter
      if (issue.assigneeId) {
        const assigneeNode = await this.createOrUpdateNode(
          tenantId,
          'user',
          issue.assigneeId,
          'jira',
          issue.assigneeDisplayName,
          { email: issue.assigneeEmail },
          ['jira', 'user'],
        );
        nodesCreated++;

        await this.createOrUpdateEdge(
          tenantId,
          assigneeNode.id,
          issueNode.id,
          'assigned_to',
          { assignedAt: issue.updatedAt },
        );
        edgesCreated++;
      }

      if (issue.reporterId) {
        const reporterNode = await this.createOrUpdateNode(
          tenantId,
          'user',
          issue.reporterId,
          'jira',
          issue.reporterDisplayName,
          { email: issue.reporterEmail },
          ['jira', 'user'],
        );

        await this.createOrUpdateEdge(
          tenantId,
          reporterNode.id,
          issueNode.id,
          'created',
          { createdAt: issue.createdAt },
        );
        edgesCreated++;
      }
    }

    this.logger.log(
      `Built Jira graph: ${nodesCreated} nodes, ${edgesCreated} edges created`,
    );
    return { nodesCreated, edgesCreated };
  }

  /**
   * Build graph from Slack data
   */
  async buildFromSlackData(
    tenantId: number,
    messages: any[],
    channels: any[],
    users: any[],
  ): Promise<{ nodesCreated: number; edgesCreated: number }> {
    let nodesCreated = 0;
    let edgesCreated = 0;

    // Create user nodes
    for (const user of users) {
      await this.createOrUpdateNode(
        tenantId,
        'user',
        user.slackUserId,
        'slack',
        user.displayName || user.realName,
        {
          name: user.name,
          email: user.email,
          isBot: user.isBot,
        },
        ['slack', 'user'],
      );
      nodesCreated++;
    }

    // Create channel nodes
    for (const channel of channels) {
      await this.createOrUpdateNode(
        tenantId,
        'channel',
        channel.slackChannelId,
        'slack',
        channel.name,
        {
          isPrivate: channel.isPrivate,
          isArchived: channel.isArchived,
          topic: channel.topic,
        },
        ['slack', 'channel'],
      );
      nodesCreated++;
    }

    // Create message nodes and relationships
    for (const message of messages) {
      const messageNode = await this.createOrUpdateNode(
        tenantId,
        'message',
        message.messageId,
        'slack',
        message.text?.substring(0, 100),
        {
          text: message.text,
          messageType: message.messageType,
          timestamp: message.timestamp,
        },
        ['slack', 'message'],
      );
      nodesCreated++;

      // Link message to channel
      if (message.channelId) {
        const channelNode = await this.nodeRepository.findOne({
          where: {
            tenantId,
            nodeType: 'channel',
            externalId: String(message.channelId),
          },
        });

        if (channelNode) {
          await this.createOrUpdateEdge(
            tenantId,
            messageNode.id,
            channelNode.id,
            'posted_in',
            { postedAt: message.timestamp },
          );
          edgesCreated++;
        }
      }

      // Link message to author
      if (message.userId) {
        const userNode = await this.nodeRepository.findOne({
          where: {
            tenantId,
            nodeType: 'user',
            externalId: message.userId,
          },
        });

        if (userNode) {
          await this.createOrUpdateEdge(
            tenantId,
            userNode.id,
            messageNode.id,
            'posted',
            { postedAt: message.timestamp },
          );
          edgesCreated++;
        }
      }

      // Handle thread relationships
      if (message.threadTimestamp && message.threadTimestamp !== message.timestamp) {
        const parentMessage = await this.nodeRepository.findOne({
          where: {
            tenantId,
            nodeType: 'message',
            externalId: `${message.channelId}_${message.threadTimestamp}`,
          },
        });

        if (parentMessage) {
          await this.createOrUpdateEdge(
            tenantId,
            messageNode.id,
            parentMessage.id,
            'replies_to',
            { repliedAt: message.timestamp },
          );
          edgesCreated++;
        }
      }
    }

    this.logger.log(
      `Built Slack graph: ${nodesCreated} nodes, ${edgesCreated} edges created`,
    );
    return { nodesCreated, edgesCreated };
  }

  /**
   * Build graph from Teams data
   */
  async buildFromTeamsData(
    tenantId: number,
    messages: any[],
    channels: any[],
    users: any[],
  ): Promise<{ nodesCreated: number; edgesCreated: number }> {
    let nodesCreated = 0;
    let edgesCreated = 0;

    // Create user nodes
    for (const user of users) {
      await this.createOrUpdateNode(
        tenantId,
        'user',
        user.userIdMs,
        'teams',
        user.displayName,
        {
          email: user.email,
          jobTitle: user.jobTitle,
        },
        ['teams', 'user'],
      );
      nodesCreated++;
    }

    // Create channel nodes
    for (const channel of channels) {
      await this.createOrUpdateNode(
        tenantId,
        'channel',
        channel.channelIdMs,
        'teams',
        channel.displayName,
        {
          description: channel.description,
          membershipType: channel.membershipType,
        },
        ['teams', 'channel'],
      );
      nodesCreated++;
    }

    // Create message nodes and relationships
    for (const message of messages) {
      const messageNode = await this.createOrUpdateNode(
        tenantId,
        'message',
        message.messageId,
        'teams',
        message.body?.substring(0, 100),
        {
          body: message.body,
          messageType: message.messageType,
          createdDateTime: message.createdDateTime,
        },
        ['teams', 'message'],
      );
      nodesCreated++;

      // Link to channel
      if (message.channelId) {
        const channelNode = await this.nodeRepository.findOne({
          where: {
            tenantId,
            nodeType: 'channel',
            externalId: String(message.channelId),
          },
        });

        if (channelNode) {
          await this.createOrUpdateEdge(
            tenantId,
            messageNode.id,
            channelNode.id,
            'posted_in',
            { postedAt: message.createdDateTime },
          );
          edgesCreated++;
        }
      }

      // Link to author
      if (message.fromUserId) {
        const userNode = await this.nodeRepository.findOne({
          where: {
            tenantId,
            nodeType: 'user',
            externalId: message.fromUserId,
          },
        });

        if (userNode) {
          await this.createOrUpdateEdge(
            tenantId,
            userNode.id,
            messageNode.id,
            'posted',
            { postedAt: message.createdDateTime },
          );
          edgesCreated++;
        }
      }

      // Handle mentions
      if (message.mentions && Array.isArray(message.mentions)) {
        for (const mention of message.mentions) {
          if (mention.userId) {
            const mentionedUser = await this.nodeRepository.findOne({
              where: {
                tenantId,
                nodeType: 'user',
                externalId: mention.userId,
              },
            });

            if (mentionedUser) {
              await this.createOrUpdateEdge(
                tenantId,
                messageNode.id,
                mentionedUser.id,
                'mentions',
                { mentionedAt: message.createdDateTime },
              );
              edgesCreated++;
            }
          }
        }
      }
    }

    this.logger.log(
      `Built Teams graph: ${nodesCreated} nodes, ${edgesCreated} edges created`,
    );
    return { nodesCreated, edgesCreated };
  }

  /**
   * Build graph from ServiceNow data
   */
  async buildFromServiceNowData(
    tenantId: number,
    incidents: any[],
    users: any[],
  ): Promise<{ nodesCreated: number; edgesCreated: number }> {
    let nodesCreated = 0;
    let edgesCreated = 0;

    // Create user nodes
    for (const user of users) {
      await this.createOrUpdateNode(
        tenantId,
        'user',
        user.sysId,
        'servicenow',
        user.name,
        {
          email: user.email,
          active: user.active,
        },
        ['servicenow', 'user'],
      );
      nodesCreated++;
    }

    // Create incident nodes and relationships
    for (const incident of incidents) {
      const incidentNode = await this.createOrUpdateNode(
        tenantId,
        'incident',
        incident.sysId,
        'servicenow',
        incident.shortDescription,
        {
          number: incident.number,
          state: incident.state,
          priority: incident.priority,
          category: incident.category,
          createdAt: incident.sysCreatedOn,
          updatedAt: incident.sysUpdatedOn,
        },
        ['servicenow', 'incident'],
      );
      nodesCreated++;

      // Link to caller
      if (incident.callerId) {
        const callerNode = await this.nodeRepository.findOne({
          where: {
            tenantId,
            nodeType: 'user',
            externalId: incident.callerId,
          },
        });

        if (callerNode) {
          await this.createOrUpdateEdge(
            tenantId,
            callerNode.id,
            incidentNode.id,
            'reported',
            { reportedAt: incident.sysCreatedOn },
          );
          edgesCreated++;
        }
      }

      // Link to assigned user
      if (incident.assignedToId) {
        const assignedNode = await this.nodeRepository.findOne({
          where: {
            tenantId,
            nodeType: 'user',
            externalId: incident.assignedToId,
          },
        });

        if (assignedNode) {
          await this.createOrUpdateEdge(
            tenantId,
            assignedNode.id,
            incidentNode.id,
            'assigned_to',
            { assignedAt: incident.sysUpdatedOn },
          );
          edgesCreated++;
        }
      }
    }

    this.logger.log(
      `Built ServiceNow graph: ${nodesCreated} nodes, ${edgesCreated} edges created`,
    );
    return { nodesCreated, edgesCreated };
  }

  /**
   * Delete nodes and edges for a specific source
   */
  async deleteGraphForSource(
    tenantId: number,
    sourceSystem: string,
  ): Promise<{ nodesDeleted: number; edgesDeleted: number }> {
    const nodes = await this.nodeRepository.find({
      where: {
        tenantId,
        sourceSystem,
      },
    });

    const nodeIds = nodes.map(n => n.id);

    // Delete edges connected to these nodes
    const edgesDeleted = await this.edgeRepository
      .createQueryBuilder()
      .delete()
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('(fromNodeId IN (:...nodeIds) OR toNodeId IN (:...nodeIds))', { nodeIds })
      .execute();

    // Delete nodes
    const nodesDeleted = await this.nodeRepository
      .createQueryBuilder()
      .delete()
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('sourceSystem = :sourceSystem', { sourceSystem })
      .execute();

    this.logger.log(
      `Deleted graph for ${sourceSystem}: ${nodesDeleted.affected} nodes, ${edgesDeleted.affected} edges`,
    );

    return {
      nodesDeleted: nodesDeleted.affected || 0,
      edgesDeleted: edgesDeleted.affected || 0,
    };
  }
}
