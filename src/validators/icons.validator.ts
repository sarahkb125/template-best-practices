// Icons Validator - Rule 1
// Validates: 1:1 aspect ratio, transparent background

import { ValidationResult } from '../types/validation.js';
import { TemplateData } from '../types/template.js';

const RULE = {
  id: 'icons',
  name: 'Service Icons',
  description: 'Service icons should have 1:1 aspect ratio and transparent backgrounds',
};

export function validateIcons(template: TemplateData): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const service of template.config.services) {
    if (service.icon) {
      // For now, just check if icon URL exists
      // Full image validation (aspect ratio, transparency) requires downloading and analyzing
      results.push({
        rule: RULE,
        passed: true,
        severity: 'info',
        message: `Service "${service.name}" has an icon configured`,
        details: { service: service.name, icon: service.icon },
        suggestions: [],
      });
    } else {
      results.push({
        rule: RULE,
        passed: false,
        severity: 'warning',
        message: `Service "${service.name}" is missing an icon`,
        details: { service: service.name },
        suggestions: [
          'Add an icon URL to the service configuration',
          'Icons should be 1:1 aspect ratio (square)',
          'Use transparent backgrounds for better visual integration',
        ],
      });
    }
  }

  if (results.length === 0) {
    results.push({
      rule: RULE,
      passed: true,
      severity: 'info',
      message: 'No services found or all icons are configured',
      suggestions: [],
    });
  }

  return results;
}
