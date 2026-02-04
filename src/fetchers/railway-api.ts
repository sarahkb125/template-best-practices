// Fetch template metadata from Railway API

import axios from 'axios';
import { RailwayTemplateMetadata, ServiceMetadata, Creator } from '../types/template.js';

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';

interface RailwayConfig {
  token?: string;
}

export class RailwayAPIClient {
  private config: RailwayConfig;

  constructor(config: RailwayConfig = {}) {
    this.config = config;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    return headers;
  }

  async fetchTemplateMetadata(templateCode: string): Promise<RailwayTemplateMetadata | null> {
    // GraphQL query to fetch template information
    const query = `
      query GetTemplate($code: String!) {
        template(code: $code) {
          code
          name
          description
          creator {
            name
            username
          }
          services {
            name
            icon
            description
          }
          config {
            repo
          }
        }
      }
    `;

    try {
      const response = await axios.post(
        RAILWAY_API_URL,
        {
          query,
          variables: { code: templateCode },
        },
        {
          headers: this.getHeaders(),
          timeout: 15000,
        }
      );

      if (response.data.errors) {
        console.error('Railway API errors:', response.data.errors);
        return null;
      }

      const template = response.data.data?.template;
      if (!template) {
        return null;
      }

      // Transform to our internal type
      return {
        code: template.code,
        name: template.name,
        description: template.description,
        creator: {
          name: template.creator?.name || template.creator?.username || 'Unknown',
          workspaceName: template.creator?.username,
        },
        services: template.services?.map((s: any) => ({
          name: s.name,
          icon: s.icon,
          description: s.description,
        })) || [],
        repoUrl: template.config?.repo,
      };
    } catch (error: any) {
      console.error('Failed to fetch Railway template metadata:', error.message);
      // Return null instead of throwing - API access is optional
      return null;
    }
  }

  async fetchServiceIcon(iconUrl: string): Promise<Buffer | null> {
    try {
      const response = await axios.get(iconUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      console.error('Failed to fetch service icon:', error.message);
      return null;
    }
  }
}
