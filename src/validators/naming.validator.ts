// Naming Validator - Rule 2
// Validates: capital case, no special chars, space-delimited

import { ValidationResult } from '../types/validation.js';
import { TemplateData } from '../types/template.js';

const RULE = {
  id: 'naming',
  name: 'Naming Conventions',
  description: 'Service names should use capital case, avoid special characters and dashes, prefer space-delimited',
};

function hasCapitalCase(name: string): boolean {
  // Check if first letter of each word is capitalized
  const words = name.split(/\s+/);
  return words.every(word => word.length === 0 || /^[A-Z]/.test(word));
}

function hasSpecialChars(name: string): boolean {
  // Check for special characters (excluding spaces and common punctuation)
  return /[^a-zA-Z0-9\s\-_]/.test(name);
}

function hasDashes(name: string): boolean {
  return name.includes('-') || name.includes('_');
}

function isReasonableLength(name: string): boolean {
  // Names should be brief (2-6 words, 5-50 characters)
  const words = name.split(/\s+/).filter(w => w.length > 0);
  return words.length >= 1 && words.length <= 6 && name.length >= 2 && name.length <= 50;
}

export function validateNaming(template: TemplateData): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Check template name
  if (template.name) {
    const issues: string[] = [];

    if (!hasCapitalCase(template.name)) {
      issues.push('not in capital case');
    }

    if (hasSpecialChars(template.name)) {
      issues.push('contains special characters');
    }

    if (hasDashes(template.name)) {
      issues.push('uses dashes/underscores instead of spaces');
    }

    if (!isReasonableLength(template.name)) {
      issues.push('length is not optimal (should be 2-50 characters)');
    }

    if (issues.length > 0) {
      results.push({
        rule: RULE,
        passed: false,
        severity: 'warning',
        message: `Template name "${template.name}" has naming issues: ${issues.join(', ')}`,
        details: { name: template.name, issues },
        suggestions: [
          'Use capital case (e.g., "My Template")',
          'Avoid special characters and dashes',
          'Prefer space-delimited names',
          'Keep names brief and clear',
        ],
      });
    }
  }

  // Check service names
  for (const service of template.config.services) {
    const issues: string[] = [];

    if (!hasCapitalCase(service.name)) {
      issues.push('not in capital case');
    }

    if (hasSpecialChars(service.name)) {
      issues.push('contains special characters');
    }

    if (hasDashes(service.name)) {
      issues.push('uses dashes/underscores instead of spaces');
    }

    if (!isReasonableLength(service.name)) {
      issues.push('length is not optimal');
    }

    if (issues.length > 0) {
      results.push({
        rule: RULE,
        passed: false,
        severity: 'warning',
        message: `Service name "${service.name}" has naming issues: ${issues.join(', ')}`,
        details: { service: service.name, issues },
        suggestions: [
          'Use capital case (e.g., "Web Server", "API Service")',
          'Avoid special characters, dashes, and underscores',
          'Prefer space-delimited names over hyphenated',
          'Keep names brief while maintaining clarity',
        ],
      });
    }
  }

  // If no issues found
  if (results.length === 0) {
    results.push({
      rule: RULE,
      passed: true,
      severity: 'info',
      message: 'All names follow best practices',
      suggestions: [],
    });
  }

  return results;
}
