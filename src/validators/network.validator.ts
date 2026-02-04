// Private Networking Validator - Rule 3
// Validates: use of Railway's private networking for service-to-service communication

import { ValidationResult } from '../types/validation.js';
import { TemplateData } from '../types/template.js';

const RULE = {
  id: 'private-networking',
  name: 'Private Networking',
  description: 'Services should use Railway private networking for internal communication',
};

export function validateNetwork(template: TemplateData): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const service of template.config.services) {
    if (!service.variables) continue;

    for (const [varName, varConfig] of Object.entries(service.variables)) {
      const defaultValue = varConfig.default || '';

      // Check for public URLs that should use private networking
      if (defaultValue.includes('http://') || defaultValue.includes('https://')) {
        // If it contains localhost or a public domain but doesn't use ${{}}
        if ((defaultValue.includes('localhost') || defaultValue.includes('.railway.app')) &&
            !defaultValue.includes('RAILWAY_PRIVATE_DOMAIN')) {
          results.push({
            rule: RULE,
            passed: false,
            severity: 'warning',
            message: `Variable "${varName}" in service "${service.name}" should use Railway's private networking`,
            details: {
              service: service.name,
              variable: varName,
              value: defaultValue.substring(0, 100),
            },
            suggestions: [
              'Use ${{SERVICE_NAME.RAILWAY_PRIVATE_DOMAIN}} for internal service communication',
              'Private networking is faster and more secure than public URLs',
              'Example: http://${{DATABASE.RAILWAY_PRIVATE_DOMAIN}}:5432',
            ],
          });
        } else if (defaultValue.includes('RAILWAY_PRIVATE_DOMAIN')) {
          results.push({
            rule: RULE,
            passed: true,
            severity: 'info',
            message: `Variable "${varName}" in service "${service.name}" correctly uses private networking`,
            details: { service: service.name, variable: varName },
            suggestions: [],
          });
        }
      }

      // Check for hostnames/connection strings
      if (varName.toLowerCase().includes('host') ||
          varName.toLowerCase().includes('url') ||
          varName.toLowerCase().includes('connection')) {

        if (defaultValue &&
            !defaultValue.includes('${{') &&
            !defaultValue.includes('localhost') &&
            defaultValue.length > 3) {
          results.push({
            rule: RULE,
            passed: false,
            severity: 'warning',
            message: `Variable "${varName}" in service "${service.name}" appears to have a hardcoded hostname`,
            details: { service: service.name, variable: varName },
            suggestions: [
              'Use reference variables for service hostnames',
              'Use ${{SERVICE_NAME.RAILWAY_PRIVATE_DOMAIN}} for private networking',
            ],
          });
        }
      }
    }
  }

  if (results.length === 0) {
    results.push({
      rule: RULE,
      passed: true,
      severity: 'info',
      message: 'No networking issues detected',
      suggestions: [],
    });
  }

  return results;
}
