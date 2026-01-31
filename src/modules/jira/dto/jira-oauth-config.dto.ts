import { IsString, IsUrl, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JiraOAuthConfigDto {
  @ApiProperty({ description: 'OAuth Client ID', example: 'your-client-id' })
  @IsString()
  clientId: string;

  @ApiProperty({ description: 'OAuth Client Secret', example: 'your-client-secret' })
  @IsString()
  clientSecret: string;

  @ApiPropertyOptional({
    description: 'Callback URL (defaults to configured value)',
    example: 'https://your-app.com/api/jira/oauth/callback'
  })
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @ApiPropertyOptional({
    description: 'Scopes required',
    example: 'read:jira-work read:jira-user write:jira-work offline_access'
  })
  @IsOptional()
  @IsString()
  scopes?: string;
}

export class InitiateOAuthDto {
  @ApiProperty({ description: 'Connection name', example: 'Main Jira Instance' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Jira instance URL', example: 'https://yourcompany.atlassian.net' })
  @IsUrl()
  jiraInstanceUrl: string;

  @ApiPropertyOptional({ description: 'Jira Cloud ID', example: '12345abcd' })
  @IsOptional()
  @IsString()
  jiraCloudId?: string;

  @ApiPropertyOptional({ description: 'State parameter for security', example: 'random-state-string' })
  @IsOptional()
  @IsString()
  state?: string;
}

export class OAuthCallbackDto {
  @ApiProperty({ description: 'Authorization code from Jira', example: 'auth-code-123' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ description: 'State parameter to validate', example: 'random-state-string' })
  @IsOptional()
  @IsString()
  state?: string;
}
