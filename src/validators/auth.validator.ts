// Authentication Validator - Rule 7
// Validates: credentials use template functions, no hardcoded passwords

import { ValidationResult } from '../types/validation.js';
import { TemplateData } from '../types/template.js';

const RULE = {
  id: 'authentication',
  name: 'Authentication',
  description: 'Credentials should use template functions for secure generation',
};

const CREDENTIAL_KEYWORDS = [
  'password', 'passwd', 'pwd',
  'secret', 'key', 'token',
  'api_key', 'apikey',
  'auth', 'credential',
  'username', 'user',
];

const WEAK_DEFAULTS = [
  'password', 'Password123', 'password123',
  'admin', 'Admin123', 'admin123',
  'secret', 'Secret123', 'secret123',
  'changeme', 'change_me', 'CHANGE_ME',
  '123456', '12345678',
  'root', 'Root123',
];

export function validateAuth(template: TemplateData): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const service of template.config.services) {
    if (!service.variables) continue;

    for (const [varName, varConfig] of Object.entries(service.variables)) {
      const defaultValue = (varConfig.default || '').toString();
      const varLower = varName.toLowerCase();

      // Check if this is a credential variable
      const isCredential = CREDENTIAL_KEYWORDS.some(keyword => varLower.includes(keyword));

      if (isCredential) {
        // Check if using template functions
        if (defaultValue.includes('${{') &&
            (defaultValue.includes('secret()') ||
             defaultValue.includes('randomString(') ||
             defaultValue.includes('randomInt('))) {
          results.push({
            rule: RULE,
            passed: true,
            severity: 'info',
            message: `Variable "${varName}" in service "${service.name}" correctly uses template functions for secure credential generation`,
            details: { service: service.name, variable: varName },
            suggestions: [],
          });
        } else if (defaultValue && defaultValue.trim() !== '') {
          // Has a default value but not using template functions

          // Check for weak defaults
          const isWeak = WEAK_DEFAULTS.some(weak =>
            defaultValue.toLowerCase() === weak.toLowerCase()
          );

          if (isWeak) {
            results.push({
              rule: RULE,
              passed: false,
              severity: 'error',
              message: `Variable "${varName}" in service "${service.name}" has a weak default credential`,
              details: {
                service: service.name,
                variable: varName,
                value: defaultValue,
              },
              suggestions: [
                'Use ${{secret()}} to generate secure random credentials',
                'Never use common passwords like "admin", "password123", or "changeme"',
              ],
            });
          } else {
            results.push({
              rule: RULE,
              passed: false,
              severity: 'warning',
              message: `Variable "${varName}" in service "${service.name}" should use template functions instead of hardcoded values`,
              details: { service: service.name, variable: varName },
              suggestions: [
                'Use ${{secret()}} for passwords and API keys',
                'Use ${{randomString(32)}} for tokens',
                'Template functions generate unique values per deployment',
              ],
            });
          }
        }
      }
    }
  }

  if (results.length === 0) {
    results.push({
      rule: RULE,
      passed: true,
      severity: 'info',
      message: 'No credential variables found or all are properly configured',
      suggestions: [],
    });
  }

  return results;
}
