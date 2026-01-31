import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import {
  JiraApiConfig,
  JiraProject,
  JiraIssue,
  JiraSearchResult,
  JiraUser,
  JiraIssueType,
  JiraStatus,
  JiraPriority,
} from '../interfaces/jira-api.interface';

@Injectable()
export class JiraApiClientService {
  private readonly logger = new Logger(JiraApiClientService.name);

  /**
   * Create authentication header for Jira API (OAuth only)
   */
  private createAuthHeader(config: JiraApiConfig): string {
    if (!config.oauthToken) {
      throw new Error('OAuth token is required');
    }
    return `Bearer ${config.oauthToken}`;
  }

  /**
   * Make HTTP request to Jira API using OAuth
   */
  private async makeRequest<T>(
    config: JiraApiConfig,
    endpoint: string,
    method: string = 'GET',
    body?: any,
  ): Promise<T> {
    // Use Atlassian API gateway format for OAuth
    // https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...
    if (!config.cloudId) {
      throw new Error('CloudId is required for OAuth connections');
    }

    const url = `https://api.atlassian.com/ex/jira/${config.cloudId}/rest/api/3${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': this.createAuthHeader(config),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    try {
      this.logger.debug(`Making ${method} request to: ${url}`);
      if (body) {
        this.logger.debug(`Request body: ${JSON.stringify(body, null, 2)}`);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Jira API error: ${response.status} ${response.statusText} - ${errorText}`);

        throw new HttpException(
          {
            statusCode: response.status,
            message: `Jira API error: ${response.statusText}`,
            error: errorText,
          },
          response.status,
        );
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        return {} as T;
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to make request to Jira API: ${error.message}`, error.stack);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to communicate with Jira API',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test connection to Jira instance
   */
  async testConnection(config: JiraApiConfig): Promise<boolean> {
    try {
      await this.makeRequest(config, '/myself', 'GET');
      return true;
    } catch (error) {
      this.logger.error(`Connection test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser(config: JiraApiConfig): Promise<JiraUser> {
    return this.makeRequest<JiraUser>(config, '/myself', 'GET');
  }

  /**
   * Get all accessible projects
   */
  async getProjects(config: JiraApiConfig): Promise<JiraProject[]> {
    const response = await this.makeRequest<{ values: JiraProject[] }>(
      config,
      '/project/search?expand=lead',
      'GET',
    );

    // The API returns { values: [...] } instead of a direct array
    return response.values || [];
  }

  /**
   * Get a specific project
   */
  async getProject(config: JiraApiConfig, projectIdOrKey: string): Promise<JiraProject> {
    return this.makeRequest<JiraProject>(config, `/project/${projectIdOrKey}`, 'GET');
  }

  /**
   * Search for issues using JQL
   * Using GET /search/jql endpoint (the new required endpoint after /search deprecation)
   */
  async searchIssues(
    config: JiraApiConfig,
    jql: string,
    startAt: number = 0,
    maxResults: number = 50,
    fields?: string[],
    expand?: string[],
  ): Promise<JiraSearchResult> {
    const params = new URLSearchParams();
    params.append('jql', jql);
    params.append('startAt', startAt.toString());
    params.append('maxResults', maxResults.toString());

    // Add fields - if not specified, request all fields
    // This ensures we get all issue types (Epic, Story, Task, Bug, Sub-task, etc.)
    if (fields && fields.length > 0) {
      params.append('fields', fields.join(','));
    } else {
      // Request all fields by default to get complete issue data
      params.append('fields', '*all');
    }

    // Add expand if provided
    if (expand && expand.length > 0) {
      params.append('expand', expand.join(','));
    }

    const result = await this.makeRequest<JiraSearchResult>(
      config,
      `/search/jql?${params.toString()}`,
      'GET',
    );

    // Log first issue structure to debug
    if (result.issues && result.issues.length > 0) {
      this.logger.debug(
        `Sample issue structure: ${JSON.stringify(result.issues[0], null, 2).substring(0, 500)}`,
      );
    }

    return result;
  }

  /**
   * Get a specific issue
   */
  async getIssue(
    config: JiraApiConfig,
    issueIdOrKey: string,
    fields?: string[],
    expand?: string[],
  ): Promise<JiraIssue> {
    const params = new URLSearchParams();

    if (fields && fields.length > 0) {
      params.append('fields', fields.join(','));
    } else {
      params.append('fields', '*all');
    }

    if (expand && expand.length > 0) {
      params.append('expand', expand.join(','));
    } else {
      params.append('expand', 'changelog');
    }

    return this.makeRequest<JiraIssue>(
      config,
      `/issue/${issueIdOrKey}?${params.toString()}`,
      'GET',
    );
  }

  /**
   * Get all issues for a project
   */
  async getProjectIssues(
    config: JiraApiConfig,
    projectKey: string,
    startAt: number = 0,
    maxResults: number = 50,
  ): Promise<JiraSearchResult> {
    const jql = `project = ${projectKey} ORDER BY updated DESC`;
    return this.searchIssues(config, jql, startAt, maxResults);
  }

  /**
   * Get issues updated since a specific date
   */
  async getIssuesUpdatedSince(
    config: JiraApiConfig,
    since: Date,
    projectKeys?: string[],
    startAt: number = 0,
    maxResults: number = 50,
  ): Promise<JiraSearchResult> {
    const sinceStr = since.toISOString().split('.')[0].replace('T', ' ');
    let jql = `updated >= "${sinceStr}"`;

    if (projectKeys && projectKeys.length > 0) {
      jql += ` AND project in (${projectKeys.join(',')})`;
    }

    jql += ' ORDER BY updated DESC';

    return this.searchIssues(config, jql, startAt, maxResults);
  }

  /**
   * Get issue types for a project
   */
  async getIssueTypes(config: JiraApiConfig): Promise<JiraIssueType[]> {
    return this.makeRequest<JiraIssueType[]>(config, '/issuetype', 'GET');
  }

  /**
   * Get all statuses
   */
  async getStatuses(config: JiraApiConfig): Promise<JiraStatus[]> {
    return this.makeRequest<JiraStatus[]>(config, '/status', 'GET');
  }

  /**
   * Get all priorities
   */
  async getPriorities(config: JiraApiConfig): Promise<JiraPriority[]> {
    return this.makeRequest<JiraPriority[]>(config, '/priority', 'GET');
  }

  /**
   * Get issue changelog
   */
  async getIssueChangelog(
    config: JiraApiConfig,
    issueIdOrKey: string,
    startAt: number = 0,
    maxResults: number = 100,
  ): Promise<any> {
    return this.makeRequest(
      config,
      `/issue/${issueIdOrKey}/changelog?startAt=${startAt}&maxResults=${maxResults}`,
      'GET',
    );
  }

  /**
   * Batch fetch issues by keys
   */
  async getIssuesByKeys(
    config: JiraApiConfig,
    issueKeys: string[],
  ): Promise<JiraSearchResult> {
    if (issueKeys.length === 0) {
      return {
        expand: '',
        startAt: 0,
        maxResults: 0,
        total: 0,
        issues: [],
      };
    }

    const jql = `key in (${issueKeys.join(',')})`;
    return this.searchIssues(config, jql, 0, issueKeys.length);
  }
}
