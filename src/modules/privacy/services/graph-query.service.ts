import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GraphNode } from '../entities/graph-node.entity';
import { GraphEdge } from '../entities/graph-edge.entity';
import { GraphQueryOptions, GraphPath, GraphTraversalResult } from '../interfaces/graph.interface';

@Injectable()
export class GraphQueryService {
  private readonly logger = new Logger(GraphQueryService.name);

  constructor(
    @InjectRepository(GraphNode)
    private readonly nodeRepository: Repository<GraphNode>,
    @InjectRepository(GraphEdge)
    private readonly edgeRepository: Repository<GraphEdge>,
  ) {}

  /**
   * Get a node by ID
   */
  async getNode(tenantId: number, nodeId: number): Promise<GraphNode> {
    const node = await this.nodeRepository.findOne({
      where: {
        tenantId,
        id: nodeId,
        isActive: true,
      },
    });

    if (!node) {
      throw new NotFoundException(`Node ${nodeId} not found`);
    }

    return node;
  }

  /**
   * Find nodes by criteria
   */
  async findNodes(options: GraphQueryOptions): Promise<GraphNode[]> {
    const qb = this.nodeRepository
      .createQueryBuilder('node')
      .where('node.tenantId = :tenantId', { tenantId: options.tenantId })
      .andWhere('node.isActive = :isActive', { isActive: true });

    if (options.nodeType) {
      qb.andWhere('node.nodeType = :nodeType', { nodeType: options.nodeType });
    }

    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (key === 'displayName') {
          qb.andWhere('node.displayName LIKE :displayName', {
            displayName: `%${value}%`,
          });
        } else if (key === 'externalId') {
          qb.andWhere('node.externalId = :externalId', { externalId: value });
        } else if (key === 'sourceSystem') {
          qb.andWhere('node.sourceSystem = :sourceSystem', { sourceSystem: value });
        }
      }
    }

    if (options.limit) {
      qb.limit(options.limit);
    }

    return await qb.getMany();
  }

  /**
   * Get neighbors of a node
   */
  async getNeighbors(
    tenantId: number,
    nodeId: number,
    relationshipType?: string,
  ): Promise<{
    outgoing: Array<{ node: GraphNode; edge: GraphEdge }>;
    incoming: Array<{ node: GraphNode; edge: GraphEdge }>;
  }> {
    // Get outgoing edges
    const outgoingQuery = this.edgeRepository
      .createQueryBuilder('edge')
      .leftJoinAndSelect('edge.toNode', 'toNode')
      .where('edge.tenantId = :tenantId', { tenantId })
      .andWhere('edge.fromNodeId = :nodeId', { nodeId })
      .andWhere('edge.isActive = :isActive', { isActive: true });

    if (relationshipType) {
      outgoingQuery.andWhere('edge.relationshipType = :relationshipType', {
        relationshipType,
      });
    }

    const outgoingEdges = await outgoingQuery.getMany();

    // Get incoming edges
    const incomingQuery = this.edgeRepository
      .createQueryBuilder('edge')
      .leftJoinAndSelect('edge.fromNode', 'fromNode')
      .where('edge.tenantId = :tenantId', { tenantId })
      .andWhere('edge.toNodeId = :nodeId', { nodeId })
      .andWhere('edge.isActive = :isActive', { isActive: true });

    if (relationshipType) {
      incomingQuery.andWhere('edge.relationshipType = :relationshipType', {
        relationshipType,
      });
    }

    const incomingEdges = await incomingQuery.getMany();

    return {
      outgoing: outgoingEdges.map(edge => ({
        node: edge.toNode,
        edge,
      })),
      incoming: incomingEdges.map(edge => ({
        node: edge.fromNode,
        edge,
      })),
    };
  }

  /**
   * Traverse graph from a starting node
   */
  async traverse(
    tenantId: number,
    startNodeId: number,
    options?: {
      maxDepth?: number;
      relationshipType?: string;
      direction?: 'outgoing' | 'incoming' | 'both';
    },
  ): Promise<GraphTraversalResult> {
    const maxDepth = options?.maxDepth || 3;
    const direction = options?.direction || 'both';
    const relationshipType = options?.relationshipType;

    const startNode = await this.getNode(tenantId, startNodeId);
    const visited = new Set<number>();
    const paths: GraphPath[] = [];

    await this.traverseRecursive(
      tenantId,
      startNodeId,
      [],
      [],
      visited,
      paths,
      0,
      maxDepth,
      relationshipType,
      direction,
    );

    const allNodes = new Set<number>();
    const allEdges = new Set<number>();

    for (const path of paths) {
      for (const node of path.nodes) {
        allNodes.add(node.id);
      }
      for (const edge of path.edges) {
        allEdges.add(edge.id);
      }
    }

    return {
      startNode,
      paths,
      totalNodes: allNodes.size,
      totalEdges: allEdges.size,
    };
  }

  /**
   * Recursive helper for graph traversal
   */
  private async traverseRecursive(
    tenantId: number,
    currentNodeId: number,
    currentPath: any[],
    currentEdges: any[],
    visited: Set<number>,
    paths: GraphPath[],
    depth: number,
    maxDepth: number,
    relationshipType?: string,
    direction?: 'outgoing' | 'incoming' | 'both',
  ): Promise<void> {
    if (depth > maxDepth || visited.has(currentNodeId)) {
      return;
    }

    visited.add(currentNodeId);

    const currentNode = await this.getNode(tenantId, currentNodeId);
    const newPath = [...currentPath, currentNode];

    // Add current path if it's not just the starting node
    if (newPath.length > 1) {
      paths.push({
        nodes: newPath.map(n => ({
          id: n.id,
          nodeType: n.nodeType,
          externalId: n.externalId,
          displayName: n.displayName,
          properties: n.properties,
        })),
        edges: currentEdges.map(e => ({
          id: e.id,
          relationshipType: e.relationshipType,
          properties: e.properties,
        })),
        length: newPath.length - 1,
      });
    }

    // Get neighbors
    const neighbors = await this.getNeighbors(tenantId, currentNodeId, relationshipType);

    // Traverse outgoing edges
    if (direction === 'outgoing' || direction === 'both') {
      for (const { node, edge } of neighbors.outgoing) {
        if (!visited.has(node.id)) {
          await this.traverseRecursive(
            tenantId,
            node.id,
            newPath,
            [...currentEdges, edge],
            visited,
            paths,
            depth + 1,
            maxDepth,
            relationshipType,
            direction,
          );
        }
      }
    }

    // Traverse incoming edges
    if (direction === 'incoming' || direction === 'both') {
      for (const { node, edge } of neighbors.incoming) {
        if (!visited.has(node.id)) {
          await this.traverseRecursive(
            tenantId,
            node.id,
            newPath,
            [...currentEdges, edge],
            visited,
            paths,
            depth + 1,
            maxDepth,
            relationshipType,
            direction,
          );
        }
      }
    }

    visited.delete(currentNodeId);
  }

  /**
   * Find shortest path between two nodes (BFS)
   */
  async findShortestPath(
    tenantId: number,
    fromNodeId: number,
    toNodeId: number,
  ): Promise<GraphPath | null> {
    const fromNode = await this.getNode(tenantId, fromNodeId);
    const toNode = await this.getNode(tenantId, toNodeId);

    const queue: Array<{ nodeId: number; path: any[]; edges: any[] }> = [
      { nodeId: fromNodeId, path: [fromNode], edges: [] },
    ];
    const visited = new Set<number>([fromNodeId]);

    while (queue.length > 0) {
      const { nodeId, path, edges } = queue.shift()!;

      if (nodeId === toNodeId) {
        return {
          nodes: path.map(n => ({
            id: n.id,
            nodeType: n.nodeType,
            externalId: n.externalId,
            displayName: n.displayName,
            properties: n.properties,
          })),
          edges: edges.map(e => ({
            id: e.id,
            relationshipType: e.relationshipType,
            properties: e.properties,
          })),
          length: edges.length,
        };
      }

      const neighbors = await this.getNeighbors(tenantId, nodeId);

      for (const { node, edge } of [...neighbors.outgoing, ...neighbors.incoming]) {
        if (!visited.has(node.id)) {
          visited.add(node.id);
          queue.push({
            nodeId: node.id,
            path: [...path, node],
            edges: [...edges, edge],
          });
        }
      }
    }

    return null;
  }

  /**
   * Find all paths between two nodes up to max depth
   */
  async findAllPaths(
    tenantId: number,
    fromNodeId: number,
    toNodeId: number,
    maxDepth = 5,
  ): Promise<GraphPath[]> {
    const paths: GraphPath[] = [];
    const visited = new Set<number>();

    await this.findPathsRecursive(
      tenantId,
      fromNodeId,
      toNodeId,
      [],
      [],
      visited,
      paths,
      0,
      maxDepth,
    );

    return paths;
  }

  private async findPathsRecursive(
    tenantId: number,
    currentNodeId: number,
    targetNodeId: number,
    currentPath: any[],
    currentEdges: any[],
    visited: Set<number>,
    paths: GraphPath[],
    depth: number,
    maxDepth: number,
  ): Promise<void> {
    if (depth > maxDepth || visited.has(currentNodeId)) {
      return;
    }

    const currentNode = await this.getNode(tenantId, currentNodeId);
    const newPath = [...currentPath, currentNode];

    if (currentNodeId === targetNodeId && newPath.length > 1) {
      paths.push({
        nodes: newPath.map(n => ({
          id: n.id,
          nodeType: n.nodeType,
          externalId: n.externalId,
          displayName: n.displayName,
          properties: n.properties,
        })),
        edges: currentEdges.map(e => ({
          id: e.id,
          relationshipType: e.relationshipType,
          properties: e.properties,
        })),
        length: currentEdges.length,
      });
      return;
    }

    visited.add(currentNodeId);

    const neighbors = await this.getNeighbors(tenantId, currentNodeId);

    for (const { node, edge } of [...neighbors.outgoing, ...neighbors.incoming]) {
      await this.findPathsRecursive(
        tenantId,
        node.id,
        targetNodeId,
        newPath,
        [...currentEdges, edge],
        visited,
        paths,
        depth + 1,
        maxDepth,
      );
    }

    visited.delete(currentNodeId);
  }

  /**
   * Get graph statistics
   */
  async getStatistics(
    tenantId: number,
    sourceSystem?: string,
  ): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    edgesByType: Record<string, number>;
    nodesBySource: Record<string, number>;
  }> {
    const nodeWhere: any = { tenantId, isActive: true };
    const edgeWhere: any = { tenantId, isActive: true };

    if (sourceSystem) {
      nodeWhere.sourceSystem = sourceSystem;
    }

    const nodes = await this.nodeRepository.find({ where: nodeWhere });
    const edges = await this.edgeRepository.find({ where: edgeWhere });

    const nodesByType: Record<string, number> = {};
    const nodesBySource: Record<string, number> = {};

    for (const node of nodes) {
      nodesByType[node.nodeType] = (nodesByType[node.nodeType] || 0) + 1;
      nodesBySource[node.sourceSystem] = (nodesBySource[node.sourceSystem] || 0) + 1;
    }

    const edgesByType: Record<string, number> = {};
    for (const edge of edges) {
      edgesByType[edge.relationshipType] = (edgesByType[edge.relationshipType] || 0) + 1;
    }

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodesByType,
      edgesByType,
      nodesBySource,
    };
  }

  /**
   * Search nodes by text
   */
  async searchNodes(
    tenantId: number,
    searchText: string,
    nodeType?: string,
    limit = 50,
  ): Promise<GraphNode[]> {
    const qb = this.nodeRepository
      .createQueryBuilder('node')
      .where('node.tenantId = :tenantId', { tenantId })
      .andWhere('node.isActive = :isActive', { isActive: true })
      .andWhere(
        '(node.displayName LIKE :search OR node.externalId LIKE :search)',
        { search: `%${searchText}%` },
      );

    if (nodeType) {
      qb.andWhere('node.nodeType = :nodeType', { nodeType });
    }

    qb.limit(limit);

    return await qb.getMany();
  }
}
