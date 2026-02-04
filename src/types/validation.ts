// Validation result types

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
}

export interface ValidationResult {
  rule: ValidationRule;
  passed: boolean;
  severity: ValidationSeverity;
  message: string;
  details?: any;
  suggestions?: string[];
}

export interface ValidationReport {
  templateCode: string;
  templateName: string;
  overallScore: number; // Percentage of rules passed
  totalRules: number;
  passedRules: number;
  failedRules: number;
  warnings: number;
  results: ValidationResult[];
  aiSuggestions?: string;
}
