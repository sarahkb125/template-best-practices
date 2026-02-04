// Environment Variables Validator - Rule 4
// Validates: descriptions, no hardcoded secrets, template functions usage

import { ValidationResult, ValidationSeverity } from '../types/validation.js';
import { TemplateData } from '../types/template.js';

const RULE = {
  id: 'env-vars',
  name: 'Environment Variables',
  description: 'Environment variables should have descriptions and use template functions instead of hardcoded values',
};

// Common patterns for detecting hardcoded secrets
const SECRET_PATTERNS = [
  /password\s*=\s*['"](?!.*\$\{\{)(.+)['"]/i,
  /api[_-]?key\s*=\s*['"](?!.*\$\{\{)(.+)['"]/i,
  /secret\s*=\s*['"](?!.*\$\{\{)(.+)['"]/i,
  /token\s*=\s*['"](?!.*\$\{\{)(.+)['"]/i,
];

const WEAK_DEFAULTS = ['password', 'admin', 'password123', 'secret', 'changeme', '123456'];

export function validateEnvVars(template: TemplateData): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const service of template.config.services) {
    if (!service.variables || Object.keys(service.variables).length === 0) {
      continue;
    }

    for (const [varName, varConfig] of Object.entries(service.variables)) {
      // Check for missing descriptions
      if (!varConfig.description || varConfig.description.trim() === '') {
        results.push({
          rule: RULE,
          passed: false,
          severity: 'warning',
          message: `Environment variable "${varName}" in service "${service.name}" is missing a description`,
          details: { service: service.name, variable: varName },
          suggestions: ['Add a description explaining what this variable is for and where to find its value'],
        });
      }

      // Check for hardcoded secrets
      if (varConfig.default || varConfig.value) {
        const value = (varConfig.default || varConfig.value || '').toLowerCase();

        // Check for weak default passwords
        if (varName.toLowerCase().includes('password') || varName.toLowerCase().includes('secret')) {
          if (WEAK_DEFAULTS.includes(value)) {
            results.push({
              rule: RULE,
              passed: false,
              severity: 'error',
              message: `Environment variable "${varName}" in service "${service.name}" has a weak default value`,
              details: { service: service.name, variable: varName, value },
              suggestions: ['Use template function: ${{secret()}} to generate secure credentials'],
            });
          }

          // Check if it's using template functions
          if (!value.includes('${{')) {
            results.push({
              rule: RULE,
              passed: false,
              severity: 'error',
              message: `Environment variable "${varName}" in service "${service.name}" should use template functions for credential generation`,
              details: { service: service.name, variable: varName },
              suggestions: [
                'Use ${{secret()}} for passwords and secrets',
                'Use ${{randomInt()}} for random numbers',
                'Use reference variables like ${{SERVICE_NAME.VAR_NAME}} for service-to-service communication',
              ],
            });
          }
        }
      }

      // Check for proper reference variables usage
      const varValue = varConfig.default || varConfig.value || '';
      if (varValue.includes('http://') || varValue.includes('https://')) {
        // If it's a URL pointing to another service, it should use reference variables
        if (!varValue.includes('${{') && varValue.includes('localhost')) {
          results.push({
            rule: RULE,
            passed: false,
            severity: 'warning',
            message: `Environment variable "${varName}" in service "${service.name}" uses localhost - consider using Railway's private networking`,
            details: { service: service.name, variable: varName },
            suggestions: ['Use ${{SERVICE_NAME.RAILWAY_PRIVATE_DOMAIN}} for service-to-service communication'],
          });
        }
      }
    }
  }

  // If no issues found, return a passed result
  if (results.length === 0) {
    results.push({
      rule: RULE,
      passed: true,
      severity: 'info',
      message: 'All environment variables follow best practices',
      suggestions: [],
    });
  }

  return results;
}
