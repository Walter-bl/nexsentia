import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';

export interface ServiceNowApiConfig {
  instanceUrl: string;
  accessToken: string;
}

@Injectable()
export class ServiceNowApiClientService {
  private readonly logger = new Logger(ServiceNowApiClientService.name);

  /**
   * Make a request to the ServiceNow Table API
   */
  private async makeRequest<T>(
    config: ServiceNowApiConfig,
    table: string,
    params?: {
      sysparm_query?: string;
      sysparm_limit?: number;
      sysparm_offset?: number;
      sysparm_fields?: string;
      sysparm_display_value?: string;
      sysparm_exclude_reference_link?: boolean;
    },
  ): Promise<T> {
    const url = new URL(`${config.instanceUrl}/api/now/table/${table}`);

    if (params) {
      if (params.sysparm_query) url.searchParams.append('sysparm_query', params.sysparm_query);
      if (params.sysparm_limit) url.searchParams.append('sysparm_limit', params.sysparm_limit.toString());
      if (params.sysparm_offset) url.searchParams.append('sysparm_offset', params.sysparm_offset.toString());
      if (params.sysparm_fields) url.searchParams.append('sysparm_fields', params.sysparm_fields);
      if (params.sysparm_display_value) url.searchParams.append('sysparm_display_value', params.sysparm_display_value);
      if (params.sysparm_exclude_reference_link !== undefined) {
        url.searchParams.append('sysparm_exclude_reference_link', params.sysparm_exclude_reference_link.toString());
      }
    }

    try {
      this.logger.debug(`Making GET request to: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error(`ServiceNow API error: ${response.status} ${response.statusText}`);
        throw new HttpException(
          `ServiceNow API error: ${errorData.error?.message || response.statusText}`,
          response.status,
        );
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      this.logger.error(`ServiceNow API request failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get incidents from ServiceNow
   */
  async getIncidents(
    config: ServiceNowApiConfig,
    options?: {
      query?: string;
      limit?: number;
      offset?: number;
      updatedAfter?: Date;
    },
  ): Promise<any> {
    let query = options?.query || '';

    if (options?.updatedAfter) {
      const dateStr = options.updatedAfter.toISOString().replace('T', ' ').split('.')[0];
      const timeQuery = `sys_updated_on>${dateStr}`;
      query = query ? `${query}^${timeQuery}` : timeQuery;
    }

    return this.makeRequest(config, 'incident', {
      sysparm_query: query,
      sysparm_limit: options?.limit || 1000,
      sysparm_offset: options?.offset || 0,
      sysparm_display_value: 'all',
      sysparm_exclude_reference_link: true,
    });
  }

  /**
   * Get change requests from ServiceNow
   */
  async getChangeRequests(
    config: ServiceNowApiConfig,
    options?: {
      query?: string;
      limit?: number;
      offset?: number;
      updatedAfter?: Date;
    },
  ): Promise<any> {
    let query = options?.query || '';

    if (options?.updatedAfter) {
      const dateStr = options.updatedAfter.toISOString().replace('T', ' ').split('.')[0];
      const timeQuery = `sys_updated_on>${dateStr}`;
      query = query ? `${query}^${timeQuery}` : timeQuery;
    }

    return this.makeRequest(config, 'change_request', {
      sysparm_query: query,
      sysparm_limit: options?.limit || 1000,
      sysparm_offset: options?.offset || 0,
      sysparm_display_value: 'all',
      sysparm_exclude_reference_link: true,
    });
  }

  /**
   * Get users from ServiceNow
   */
  async getUsers(
    config: ServiceNowApiConfig,
    options?: {
      query?: string;
      limit?: number;
      offset?: number;
      activeOnly?: boolean;
    },
  ): Promise<any> {
    let query = options?.query || '';

    if (options?.activeOnly) {
      const activeQuery = 'active=true';
      query = query ? `${query}^${activeQuery}` : activeQuery;
    }

    return this.makeRequest(config, 'sys_user', {
      sysparm_query: query,
      sysparm_limit: options?.limit || 1000,
      sysparm_offset: options?.offset || 0,
      sysparm_display_value: 'all',
      sysparm_exclude_reference_link: true,
    });
  }

  /**
   * Get a single incident by sys_id
   */
  async getIncident(config: ServiceNowApiConfig, sysId: string): Promise<any> {
    return this.makeRequest(config, `incident/${sysId}`, {
      sysparm_display_value: 'all',
      sysparm_exclude_reference_link: true,
    });
  }

  /**
   * Get a single change request by sys_id
   */
  async getChangeRequest(config: ServiceNowApiConfig, sysId: string): Promise<any> {
    return this.makeRequest(config, `change_request/${sysId}`, {
      sysparm_display_value: 'all',
      sysparm_exclude_reference_link: true,
    });
  }

  /**
   * Get a single user by sys_id
   */
  async getUser(config: ServiceNowApiConfig, sysId: string): Promise<any> {
    return this.makeRequest(config, `sys_user/${sysId}`, {
      sysparm_display_value: 'all',
      sysparm_exclude_reference_link: true,
    });
  }
}
