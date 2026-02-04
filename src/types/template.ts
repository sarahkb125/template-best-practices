// Railway template configuration types based on railway.json/railway.toml schema

export interface RailwayTemplate {
  services: Service[];
  volumes?: Volume[];
}

export interface Service {
  name: string;
  icon?: string;
  description?: string;
  source?: ServiceSource;
  variables?: Record<string, EnvironmentVariable>;
  healthcheckPath?: string;
  volumes?: VolumeMount[];
  startCommand?: string;
  buildCommand?: string;
}

export interface ServiceSource {
  repo: string;
  branch?: string;
}

export interface EnvironmentVariable {
  description?: string;
  default?: string;
  value?: string;
  isSecret?: boolean;
}

export interface Volume {
  name: string;
  mountPath: string;
}

export interface VolumeMount {
  name: string;
  mountPath: string;
}

// Railway API response types
export interface RailwayTemplateMetadata {
  code: string;
  name: string;
  description?: string;
  creator: Creator;
  services: ServiceMetadata[];
  repoUrl?: string;
}

export interface Creator {
  name: string;
  workspaceName?: string;
}

export interface ServiceMetadata {
  name: string;
  icon?: string;
  description?: string;
}

// Combined template data (GitHub + Railway API)
export interface TemplateData {
  code: string;
  name: string;
  description?: string;
  creator?: Creator;
  config: RailwayTemplate;
  repoUrl: string;
  readme?: string;
  serviceMetadata?: ServiceMetadata[];
}
