// Validation orchestrator - runs all validators and aggregates results

import { ValidationReport, ValidationResult } from '../types/validation.js';
import { TemplateData } from '../types/template.js';
import { validateEnvVars } from './env-vars.validator.js';
import { validateHealthChecks } from './health.validator.js';
import { validateNaming } from './naming.validator.js';
import { validateIcons } from './icons.validator.js';
import { validateNetwork } from './network.validator.js';
import { validateStorage } from './storage.validator.js';
import { validateAuth } from './auth.validator.js';
import { validateWorkspace } from './workspace.validator.js';

export async function validateTemplate(template: TemplateData): Promise<ValidationReport> {
  const allResults: ValidationResult[] = [];

  // Run all validators in parallel
  const validatorResults = await Promise.all([
    Promise.resolve(validateIcons(template)),
    Promise.resolve(validateNaming(template)),
    Promise.resolve(validateNetwork(template)),
    Promise.resolve(validateEnvVars(template)),
    Promise.resolve(validateHealthChecks(template)),
    Promise.resolve(validateStorage(template)),
    Promise.resolve(validateAuth(template)),
    Promise.resolve(validateWorkspace(template)),
  ]);

  // Flatten results
  for (const results of validatorResults) {
    allResults.push(...results);
  }

  // Calculate statistics
  const passedResults = allResults.filter(r => r.passed);
  const failedResults = allResults.filter(r => !r.passed);
  const warnings = allResults.filter(r => r.severity === 'warning');

  // Group by rule to count unique rules
  const uniqueRules = new Set(allResults.map(r => r.rule.id));

  // A rule passes if it has no ERROR-severity failures
  // Warnings and info messages don't count against the score
  const passedRules = new Set<string>();
  for (const ruleId of uniqueRules) {
    const ruleResults = allResults.filter(r => r.rule.id === ruleId);
    const hasErrors = ruleResults.some(r => !r.passed && r.severity === 'error');
    if (!hasErrors) {
      passedRules.add(ruleId);
    }
  }

  const totalRules = uniqueRules.size;
  const passedRulesCount = passedRules.size;
  const overallScore = totalRules > 0 ? Math.round((passedRulesCount / totalRules) * 100) : 0;

  return {
    templateCode: template.code,
    templateName: template.name,
    overallScore,
    totalRules,
    passedRules: passedRulesCount,
    failedRules: totalRules - passedRulesCount,
    warnings: warnings.length,
    results: allResults,
  };
}
