// Persistent Storage Validator - Rule 6
// Validates: database and stateful services have persistent volumes configured

import { ValidationResult } from '../types/validation.js';
import { TemplateData } from '../types/template.js';

const RULE = {
  id: 'persistent-storage',
  name: 'Persistent Storage',
  description: 'Database and stateful services should have persistent volumes configured',
};

// Services that need persistent storage
const STATEFUL_SERVICES = [
  'postgres', 'postgresql',
  'mysql', 'mariadb',
  'mongodb', 'mongo',
  'redis',
  'elasticsearch', 'elastic',
  'minio',
  'sqlite',
  'database', 'db',
];

export function validateStorage(template: TemplateData): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const service of template.config.services) {
    const serviceName = service.name.toLowerCase();

    // Check if this is a stateful service
    const isStateful = STATEFUL_SERVICES.some(
      indicator => serviceName.includes(indicator)
    );

    if (isStateful) {
      if (service.volumes && service.volumes.length > 0) {
        results.push({
          rule: RULE,
          passed: true,
          severity: 'info',
          message: `Service "${service.name}" has persistent storage configured (${service.volumes.length} volume(s))`,
          details: {
            service: service.name,
            volumes: service.volumes.map(v => v.mountPath).join(', '),
          },
          suggestions: [],
        });
      } else {
        results.push({
          rule: RULE,
          passed: false,
          severity: 'error',
          message: `Service "${service.name}" appears to be a database but has no persistent volumes configured`,
          details: { service: service.name },
          suggestions: [
            'Add a volume to persist data across deployments',
            'Common mount paths: /data (Redis), /var/lib/postgresql/data (PostgreSQL), /var/lib/mysql (MySQL)',
            'Without volumes, data will be lost on redeployment',
          ],
        });
      }
    } else if (service.volumes && service.volumes.length > 0) {
      // Non-database service has volumes - that's fine, just informational
      results.push({
        rule: RULE,
        passed: true,
        severity: 'info',
        message: `Service "${service.name}" has ${service.volumes.length} volume(s) configured`,
        details: {
          service: service.name,
          volumes: service.volumes.map(v => v.mountPath).join(', '),
        },
        suggestions: [],
      });
    }
  }

  if (results.length === 0) {
    results.push({
      rule: RULE,
      passed: true,
      severity: 'info',
      message: 'No stateful services detected or all storage is properly configured',
      suggestions: [],
    });
  }

  return results;
}
