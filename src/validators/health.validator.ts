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
  'port',
  'http',
  'api',
  'server',
  'web',
  'frontend',
  'backend',
  'app',
];

export function validateHealthChecks(template: TemplateData): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const service of template.config.services) {
    const serviceName = service.name.toLowerCase();
    const hasPort = service.variables && Object.keys(service.variables).some(
      key => key.toLowerCase().includes('port')
    );

    // Check if this looks like a web service
    const looksLikeWebService = hasPort || WEB_SERVICE_INDICATORS.some(
      indicator => serviceName.includes(indicator)
    );

    if (looksLikeWebService) {
      if (!service.healthcheckPath) {
        results.push({
          rule: RULE,
          passed: false,
          severity: 'warning',
          message: `Service "${service.name}" appears to be a web service but has no health check configured`,
          details: { service: service.name },
          suggestions: [
            'Add a healthcheckPath field pointing to a health endpoint (e.g., "/health" or "/api/health")',
            'Prefer readiness endpoints over liveness endpoints',
            'Ensure the endpoint returns 200 OK when the service is ready',
          ],
        });
      } else {
        // Validate the health check path format
        const path = service.healthcheckPath;

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
          // Health check is properly configured
          results.push({
            rule: RULE,
            passed: true,
            severity: 'info',
            message: `Service "${service.name}" has a properly configured health check at ${path}`,
            details: { service: service.name, healthcheckPath: path },
            suggestions: [],
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
