// Workspace Naming Validator - Rule 9
// Validates: proper representation of brand/company names

import { ValidationResult } from '../types/validation.js';
import { TemplateData } from '../types/template.js';

const RULE = {
  id: 'workspace-naming',
  name: 'Workspace Naming',
  description: 'Template creator workspace should properly represent the brand',
};

// Known official Railway workspaces that are authorized
const OFFICIAL_RAILWAY_WORKSPACES = new Set([
  'railway',
  'railway-templates',
  'railwayapp',
]);

// Major companies - warn if used without authorization
const MAJOR_BRANDS = [
  'google', 'microsoft', 'amazon', 'aws',
  'facebook', 'meta', 'apple', 'netflix',
  'twitter', 'x', 'linkedin', 'github',
  'gitlab', 'atlassian', 'jira', 'confluence',
  'slack', 'discord', 'zoom', 'salesforce',
  'oracle', 'ibm', 'intel', 'adobe',
];

export function validateWorkspace(template: TemplateData): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (!template.creator) {
    results.push({
      rule: RULE,
      passed: true,
      severity: 'info',
      message: 'No creator information available',
      suggestions: [],
    });
    return results;
  }

  const creatorName = (template.creator.name || '').toLowerCase();
  const workspaceName = (template.creator.workspaceName || '').toLowerCase();

  // Check if claiming to be Railway official
  if ((creatorName.includes('railway') || workspaceName.includes('railway')) &&
      !OFFICIAL_RAILWAY_WORKSPACES.has(workspaceName)) {
    results.push({
      rule: RULE,
      passed: false,
      severity: 'warning',
      message: `Template creator "${template.creator.name}" uses "Railway" in name but may not be official`,
      details: {
        creator: template.creator.name,
        workspace: template.creator.workspaceName,
      },
      suggestions: [
        'Only official Railway accounts should use "Railway" in workspace names',
        'Consider using a different workspace name to avoid confusion',
      ],
    });
    return results;
  }

  // Check if using major brand names
  const usesMajorBrand = MAJOR_BRANDS.some(brand =>
    creatorName.includes(brand) || workspaceName.includes(brand)
  );

  if (usesMajorBrand) {
    results.push({
      rule: RULE,
      passed: false,
      severity: 'warning',
      message: `Template creator workspace appears to use a major brand name - ensure you have authorization`,
      details: {
        creator: template.creator.name,
        workspace: template.creator.workspaceName,
      },
      suggestions: [
        'Only use company/brand names in workspaces if you are authorized',
        'Impersonating brands can lead to template removal',
      ],
    });
    return results;
  }

  // All good
  results.push({
    rule: RULE,
    passed: true,
    severity: 'info',
    message: `Template creator workspace "${template.creator.name}" looks appropriate`,
    details: {
      creator: template.creator.name,
      workspace: template.creator.workspaceName,
    },
    suggestions: [],
  });

  return results;
}
