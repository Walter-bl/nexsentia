export interface GraphQueryOptions {
  tenantId: number;
  nodeType?: string;
  relationshipType?: string;
  depth?: number;
  limit?: number;
  filters?: Record<string, any>;
}

export interface GraphPath {
  nodes: Array<{
    id: number;
    nodeType: string;
    externalId: string;
    displayName?: string;
    properties?: any;
  }>;
  edges: Array<{
    id: number;
    relationshipType: string;
    properties?: any;
  }>;
  length: number;
}

export interface GraphTraversalResult {
  startNode: any;
  paths: GraphPath[];
  totalNodes: number;
  totalEdges: number;
}
