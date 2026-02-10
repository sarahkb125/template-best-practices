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

// Check if variable is a reference to another variable
function isReferenceVariable(defaultValue: string): boolean {
  if (!defaultValue) return false;
  // Matches ${{VAR_NAME}} or ${{ VAR_NAME }}
  return /^\$\{\{\s*[A-Z_][A-Z0-9_]*\s*\}\}$/i.test(defaultValue);
}

// Check if variable uses template functions (auto-generated, user won't touch)
function usesTemplateFunction(defaultValue: string): boolean {
  if (!defaultValue) return false;
  // Matches ${{ secret(...) }}, ${{ randomInt(...) }}, etc.
  return /\$\{\{\s*(secret|randomInt|randomString)\s*\(/i.test(defaultValue);
}

// Check if variable uses Railway-provided values (system-managed, user won't touch)
function usesRailwayProvidedValue(defaultValue: string): boolean {
  if (!defaultValue) return false;
  return defaultValue.includes('RAILWAY_') ||
         defaultValue.includes('${{RAILWAY') ||
         defaultValue === 'railway' ||
         defaultValue === 'production';
}

// Standard system values that are pre-configured and users won't change
const STANDARD_SYSTEM_VALUES = new Set([
  '6379',      // Redis default port
  '5432',      // PostgreSQL default port
  '3306',      // MySQL default port
  '27017',     // MongoDB default port
  'default',   // Default username
  'postgres',  // PostgreSQL default user
  'root',      // MySQL default user
  'pg',        // Database client type
  'redis',     // Cache store type
  'true',      // Boolean flags
  'false',     // Boolean flags
  's3',        // Storage driver
  'raw',       // Log style
]);

// Check if this is an internal/system variable that users won't touch
function isInternalVariable(varName: string, defaultValue: string): boolean {
  // Auto-generated secrets
  if (usesTemplateFunction(defaultValue)) return true;

  // References to other template variables (computed/derived)
  if (isReferenceVariable(defaultValue)) return true;

  // Railway-provided system values
  if (usesRailwayProvidedValue(defaultValue)) return true;

  // Standard system configuration values
  if (STANDARD_SYSTEM_VALUES.has(defaultValue)) return true;

  // Internal variable patterns (computed URLs, connection strings)
  if (defaultValue.includes('://') && defaultValue.includes('${{')) return true;

  return false;
}

// Check if this is a user-facing variable that needs a description
function isUserFacingVariable(varConfig: any): boolean {
  const defaultValue = varConfig.default || '';

  // No default value = user must provide it
  if (!defaultValue || defaultValue.trim() === '') return true;

  // Has a placeholder or example value (not a real default)
  if (defaultValue.includes('your-') || defaultValue.includes('example') || defaultValue === 'changeme') return true;

  // Marked as optional = user might configure it
  if (varConfig.isOptional === true) return true;

  return false;
}

export function validateEnvVars(template: TemplateData): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const service of template.config.services) {
    if (!service.variables || Object.keys(service.variables).length === 0) {
      continue;
    }

    for (const [varName, varConfig] of Object.entries(service.variables)) {
      const defaultValue = varConfig.default || '';

      // Check for missing descriptions
      if (!varConfig.description || varConfig.description.trim() === '') {
        const isInternal = isInternalVariable(varName, defaultValue);
        const isUserFacing = isUserFacingVariable(varConfig);

        // Only flag user-facing variables that lack descriptions
        // Internal/system variables that users won't touch don't need descriptions
        if (isUserFacing && !isInternal) {
          results.push({
            rule: RULE,
            passed: false,
            severity: 'warning',
            message: `Environment variable "${varName}" in service "${service.name}" is missing a description`,
            details: { service: service.name, variable: varName, userFacing: true },
            suggestions: [
              'Add a description explaining what this variable is for',
              'Include where users can find this value or what they should enter',
            ],
          });
        } else if (!isInternal && !isUserFacing) {
          // Pre-configured values that users might still want to understand
          results.push({
            rule: RULE,
            passed: false,
            severity: 'info',
            message: `Environment variable "${varName}" in service "${service.name}" could use a description for clarity`,
            details: { service: service.name, variable: varName, userFacing: false },
            suggestions: ['Consider adding a brief description to help users understand this configuration'],
          });
        }
        // Skip internal variables entirely - they don't need descriptions
      }

      // Check for hardcoded secrets
      if (varConfig.default || varConfig.value) {
        const value = varConfig.default || varConfig.value || '';
        const valueLower = value.toLowerCase();

        // Check for weak default passwords
        if (varName.toLowerCase().includes('password') || varName.toLowerCase().includes('secret')) {
          if (WEAK_DEFAULTS.includes(valueLower)) {
            results.push({
              rule: RULE,
              passed: false,
              severity: 'error',
              message: `Environment variable "${varName}" in service "${service.name}" has a weak default value`,
              details: { service: service.name, variable: varName, value: valueLower },
              suggestions: ['Use template function: ${{secret()}} to generate secure credentials'],
            });
          }

          // Check if it's using template functions or reference variables
          if (!usesTemplateFunction(value) && !isReferenceVariable(value) && !usesRailwayProvidedValue(value)) {
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
