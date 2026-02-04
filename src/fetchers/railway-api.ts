// Fetch template metadata from Railway API

import axios from 'axios';
import { RailwayTemplateMetadata, ServiceMetadata, Creator, RailwayTemplate, Service } from '../types/template.js';

const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';

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
          readme
          creator {
            name
            username
          }
          serializedConfig
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

      // Parse serializedConfig to extract service metadata
      const services: ServiceMetadata[] = [];
      let repoUrl: string | undefined;

      if (template.serializedConfig?.services) {
        for (const [serviceId, serviceConfig] of Object.entries(template.serializedConfig.services)) {
          const svc: any = serviceConfig;
          services.push({
            name: svc.name || 'Unnamed Service',
            icon: svc.icon,
            description: svc.description,
          });

          // Extract repo URL from source if it's a GitHub repo
          if (svc.source?.repo) {
            repoUrl = svc.source.repo;
          }
        }
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
        services,
        repoUrl,
      };
    } catch (error: any) {
      console.error('Failed to fetch Railway template metadata:', error.message);
      // Return null instead of throwing - API access is optional
      return null;
    }
  }

  parseSerializedConfigToRailwayTemplate(serializedConfig: any): RailwayTemplate {
    const services: Service[] = [];

    if (serializedConfig?.services) {
      for (const [serviceId, serviceConfig] of Object.entries(serializedConfig.services)) {
        const svc: any = serviceConfig;

        // Transform variables
        const variables: Record<string, any> = {};
        if (svc.variables) {
          for (const [varName, varConfig] of Object.entries(svc.variables)) {
            const vc: any = varConfig;
            variables[varName] = {
              description: vc.description,
              default: vc.defaultValue,
              isSecret: vc.isSecret,
            };
          }
        }

        // Extract health check path from deploy config
        const healthcheckPath = svc.deploy?.healthcheckPath || svc.healthcheckPath;

        // Build service object
        const service: Service = {
          name: svc.name || 'Unnamed Service',
          icon: svc.icon,
          description: svc.description,
          variables,
          healthcheckPath,
        };

        // Add source repo if available
        if (svc.source?.repo) {
          service.source = {
            repo: svc.source.repo,
            branch: svc.source.branch,
          };
        }

        // Add volume mounts if available
        if (svc.volumeMounts) {
          service.volumes = [];
          for (const [volumeId, volumeConfig] of Object.entries(svc.volumeMounts)) {
            const vc: any = volumeConfig;
            service.volumes.push({
              name: volumeId,
              mountPath: vc.mountPath,
            });
          }
        }

        services.push(service);
      }
    }

    return { services };
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
