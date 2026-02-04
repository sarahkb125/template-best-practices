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

// Variables that are commonly self-explanatory or internal-only (Railway provided)
const WELL_KNOWN_VARS = new Set([
  'PORT',
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'POSTGRES_USER',
  'POSTGRES_DB',
  'MYSQL_USER',
  'MYSQL_DATABASE',
]);

// Standard database configuration values that are self-explanatory
const STANDARD_DB_VALUES = new Set([
  '6379', // Redis default port
  '5432', // PostgreSQL default port
  '3306', // MySQL default port
  '27017', // MongoDB default port
  'default', // Default username
  'postgres', // PostgreSQL default user
  'root', // MySQL default user
  'admin', // Common admin user
]);

// Check if variable is a reference to another variable
function isReferenceVariable(defaultValue: string): boolean {
  if (!defaultValue) return false;
  // Matches ${{VAR_NAME}} or ${{ VAR_NAME }}
  return /^\$\{\{\s*[A-Z_][A-Z0-9_]*\s*\}\}$/i.test(defaultValue);
}

// Check if variable uses template functions
function usesTemplateFunction(defaultValue: string): boolean {
  if (!defaultValue) return false;
  // Matches ${{ secret(...) }}, ${{ randomInt(...) }}, etc.
  return /\$\{\{\s*(secret|randomInt|randomString)\s*\(/i.test(defaultValue);
}

// Check if variable uses Railway-provided values (less critical to have descriptions)
function usesRailwayProvidedValue(defaultValue: string): boolean {
  if (!defaultValue) return false;
  return defaultValue.includes('RAILWAY_') ||
         defaultValue.includes('${{RAILWAY') ||
         defaultValue === 'railway' ||
         defaultValue === 'production';
}

export function validateEnvVars(template: TemplateData): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const service of template.config.services) {
    if (!service.variables || Object.keys(service.variables).length === 0) {
      continue;
    }

    for (const [varName, varConfig] of Object.entries(service.variables)) {
      const defaultValue = varConfig.default || '';

      // Check for missing descriptions (but be lenient for well-known or Railway-provided vars)
      if (!varConfig.description || varConfig.description.trim() === '') {
        const isWellKnown = WELL_KNOWN_VARS.has(varName);
        const isRailwayProvided = usesRailwayProvidedValue(defaultValue);
        const isStandardValue = STANDARD_DB_VALUES.has(defaultValue);
        const isReference = isReferenceVariable(defaultValue);
        const usesFunction = usesTemplateFunction(defaultValue);

        // Skip if it's a well-known var, standard DB value, reference var, or uses template functions
        const shouldSkip = isWellKnown || isRailwayProvided || isStandardValue || isReference || usesFunction;

        if (!shouldSkip) {
          results.push({
            rule: RULE,
            passed: false,
            severity: 'info', // Downgrade from warning to info
            message: `Environment variable "${varName}" in service "${service.name}" is missing a description`,
            details: { service: service.name, variable: varName },
            suggestions: ['Add a description explaining what this variable is for and where to find its value'],
          });
        }
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
