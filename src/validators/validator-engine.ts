// Validation orchestrator - runs all validators and aggregates results

import { ValidationReport, ValidationResult } from '../types/validation.js';
import { TemplateData } from '../types/template.js';
import { validateEnvVars } from './env-vars.validator.js';
import { validateHealthChecks } from './health.validator.js';
import { validateNaming } from './naming.validator.js';

export async function validateTemplate(template: TemplateData): Promise<ValidationReport> {
  const allResults: ValidationResult[] = [];

  // Run all validators in parallel
  const validatorResults = await Promise.all([
    Promise.resolve(validateEnvVars(template)),
    Promise.resolve(validateHealthChecks(template)),
    Promise.resolve(validateNaming(template)),
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
  const passedRules = new Set(
    allResults
      .filter(r => r.passed)
      .map(r => r.rule.id)
  );

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
