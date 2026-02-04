// Health Checks Validator - Rule 5
// Validates: health check endpoints for web services

import { ValidationResult } from '../types/validation.js';
import { TemplateData } from '../types/template.js';

const RULE = {
  id: 'health-checks',
  name: 'Health Checks',
  description: 'Web services should have health check endpoints configured',
};

// Services that likely need health checks (web servers, APIs)
const WEB_SERVICE_INDICATORS = [
  'http',
  'api',
  'server',
  'web',
  'frontend',
  'backend',
  'app',
];

// Database and infrastructure services that DON'T need health checks
const DATABASE_INDICATORS = [
  'redis',
  'postgres',
  'postgis',
  'mysql',
  'mariadb',
  'mongo',
  'mongodb',
  'elasticsearch',
  'cassandra',
  'influxdb',
  'timescale',
  'cockroach',
  'minio',
  'bucket',
];

function parseDockerfileHealthcheck(dockerfile: string): string | null {
  // Look for HEALTHCHECK instruction in Dockerfile
  const healthcheckRegex = /HEALTHCHECK\s+(?:--[a-z-]+=\S+\s+)*CMD\s+(.+)/i;
  const match = dockerfile.match(healthcheckRegex);

  if (match) {
    const cmd = match[1].trim();

    // Try to extract endpoint from common patterns
    // e.g., curl -f http://localhost:8080/health
    const urlMatch = cmd.match(/https?:\/\/[^\/]+(\/.+?)(?:\s|$|")/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // e.g., wget --quiet --tries=1 --spider http://localhost/api/health
    const wgetMatch = cmd.match(/wget\s+.*?(\/[\w\/\-]+)/);
    if (wgetMatch) {
      return wgetMatch[1];
    }

    // Return the full command if we can't extract endpoint
    return `Dockerfile: ${cmd}`;
  }

  return null;
}

export function validateHealthChecks(template: TemplateData): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Check if Dockerfile has HEALTHCHECK instruction
  let dockerfileHealthcheck: string | null = null;
  if (template.dockerfile) {
    dockerfileHealthcheck = parseDockerfileHealthcheck(template.dockerfile);
  }

  for (const service of template.config.services) {
    const serviceName = service.name.toLowerCase();

    // Check if this is a database or infrastructure service (exempt from health checks)
    const isDatabase = DATABASE_INDICATORS.some(
      indicator => serviceName.includes(indicator)
    );

    // Skip databases - they don't need HTTP health checks
    if (isDatabase) {
      continue;
    }

    const hasPort = service.variables && Object.keys(service.variables).some(
      key => key.toLowerCase().includes('port')
    );

    // Check if this looks like a web service
    const looksLikeWebService = hasPort || WEB_SERVICE_INDICATORS.some(
      indicator => serviceName.includes(indicator)
    );

    if (looksLikeWebService) {
      const hasRailwayHealthcheck = !!service.healthcheckPath;
      const hasDockerHealthcheck = !!dockerfileHealthcheck;

      if (!hasRailwayHealthcheck && !hasDockerHealthcheck) {
        results.push({
          rule: RULE,
          passed: false,
          severity: 'error',
          message: `Service "${service.name}" appears to be a web service but has no health check configured`,
          details: { service: service.name },
          suggestions: [
            'Add a healthcheckPath field in Railway config pointing to a health endpoint (e.g., "/health" or "/api/health")',
            'Or add a HEALTHCHECK instruction in your Dockerfile',
            'Prefer readiness endpoints over liveness endpoints',
            'Ensure the endpoint returns 200 OK when the service is ready',
          ],
        });
      } else {
        // Validate Railway health check path format if present
        if (hasRailwayHealthcheck) {
          const path = service.healthcheckPath!;

          if (!path.startsWith('/')) {
            results.push({
              rule: RULE,
              passed: false,
              severity: 'error',
              message: `Health check path for service "${service.name}" should start with /`,
              details: { service: service.name, healthcheckPath: path },
              suggestions: ['Update healthcheckPath to start with / (e.g., "/health")'],
            });
          } else {
            results.push({
              rule: RULE,
              passed: true,
              severity: 'info',
              message: `Service "${service.name}" has a properly configured Railway health check at ${path}`,
              details: { service: service.name, healthcheckPath: path },
              suggestions: [],
            });
          }
        }

        // Report Dockerfile healthcheck if found
        if (hasDockerHealthcheck && !hasRailwayHealthcheck) {
          results.push({
            rule: RULE,
            passed: true,
            severity: 'info',
            message: `Service "${service.name}" has a health check defined in Dockerfile: ${dockerfileHealthcheck}`,
            details: { service: service.name, dockerHealthcheck: dockerfileHealthcheck },
            suggestions: ['Consider also adding healthcheckPath in Railway config for better visibility'],
          });
        }
      }
    }
  }

  // If no web services found or all health checks are good
  if (results.length === 0) {
    results.push({
      rule: RULE,
      passed: true,
      severity: 'info',
      message: 'No web services found or all health checks are properly configured',
      suggestions: [],
    });
  }

  return results;
}
