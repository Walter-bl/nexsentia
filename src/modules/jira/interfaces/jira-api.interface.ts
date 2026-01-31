export interface JiraApiConfig {
  cloudId: string;
  oauthToken: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  projectTypeKey: string;
  avatarUrls?: {
    '48x48'?: string;
    '24x24'?: string;
    '16x16'?: string;
    '32x32'?: string;
  };
  lead?: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
  };
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: any;
    issuetype: {
      id: string;
      name: string;
      description?: string;
    };
    status: {
      id: string;
      name: string;
      statusCategory?: {
        id: number;
        name: string;
        key: string;
      };
    };
    priority?: {
      id: string;
      name: string;
    };
    resolution?: {
      id: string;
      name: string;
    };
    reporter?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    labels?: string[];
    components?: Array<{
      id: string;
      name: string;
    }>;
    parent?: {
      key: string;
      fields: {
        summary: string;
      };
    };
    customfield_10016?: number; // Story points (common custom field)
    timeestimate?: number;
    timespent?: number;
    duedate?: string;
    created: string;
    updated: string;
    resolutiondate?: string;
    comment?: {
      comments: Array<{
        id: string;
        author: {
          accountId: string;
          displayName: string;
        };
        body: any;
        created: string;
        updated: string;
      }>;
    };
    attachment?: Array<{
      id: string;
      filename: string;
      mimeType: string;
      size: number;
      created: string;
      author: {
        accountId: string;
        displayName: string;
      };
    }>;
    [key: string]: any;
  };
  changelog?: {
    histories: Array<{
      id: string;
      author: {
        accountId: string;
        displayName: string;
      };
      created: string;
      items: Array<{
        field: string;
        fieldtype: string;
        from: string;
        fromString: string;
        to: string;
        toString: string;
      }>;
    }>;
  };
}

export interface JiraSearchResult {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  subtask: boolean;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    id: number;
    key: string;
    name: string;
  };
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl?: string;
}
