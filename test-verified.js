// Test script to validate verified templates
import axios from 'axios';

const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';

async function fetchTemplate(code) {
  const response = await axios.post(RAILWAY_API_URL, {
    query: `
      query GetTemplate($code: String!) {
        template(code: $code) {
          code
          name
          description
          isVerified
          serializedConfig
        }
      }
    `,
    variables: { code },
  });

  return response.data.data.template;
}

function parseSerializedConfig(serializedConfig) {
  const services = [];

  if (serializedConfig?.services) {
    for (const [serviceId, serviceConfig] of Object.entries(serializedConfig.services)) {
      const variables = {};
      if (serviceConfig.variables) {
        for (const [varName, varConfig] of Object.entries(serviceConfig.variables)) {
          variables[varName] = {
            description: varConfig.description,
            default: varConfig.defaultValue,
            isSecret: varConfig.isSecret,
          };
        }
      }

      services.push({
        name: serviceConfig.name || 'Unnamed Service',
        variables,
        healthcheckPath: serviceConfig.deploy?.healthcheckPath || serviceConfig.healthcheckPath,
      });
    }
  }

  return { services };
}

// Simulated validators
function validateNaming(services) {
  const issues = [];
  for (const service of services) {
    const name = service.name;
    // Check capital case
    const words = name.split(/\s+/);
    const hasCapitalCase = words.every(word => word.length === 0 || /^[A-Z]/.test(word));

    if (!hasCapitalCase) {
      issues.push(`Service "${name}" - not capital case`);
    }

    // Check for special chars/dashes
    if (/[^a-zA-Z0-9\s\-_]/.test(name) || name.includes('-') || name.includes('_')) {
      issues.push(`Service "${name}" - has special chars or dashes`);
    }
  }
  return issues;
}

function validateHealthChecks(services) {
  const issues = [];
  const DATABASE_INDICATORS = ['redis', 'postgres', 'postgis', 'mysql', 'mariadb', 'mongo', 'mongodb'];

  for (const service of services) {
    const serviceName = service.name.toLowerCase();

    // Skip databases
    const isDatabase = DATABASE_INDICATORS.some(db => serviceName.includes(db));
    if (isDatabase) {
      continue;
    }

    // Check if looks like web service
    const hasPort = service.variables && Object.keys(service.variables).some(
      key => key.toLowerCase().includes('port')
    );
    const WEB_INDICATORS = ['http', 'api', 'server', 'web', 'frontend', 'backend', 'app'];
    const looksLikeWebService = hasPort || WEB_INDICATORS.some(ind => serviceName.includes(ind));

    if (looksLikeWebService && !service.healthcheckPath) {
      issues.push(`Service "${service.name}" - missing health check`);
    }
  }
  return issues;
}

function validateEnvVars(services) {
  const issues = [];
  const WELL_KNOWN_VARS = new Set(['PORT', 'NODE_ENV', 'DATABASE_URL', 'REDIS_URL', 'POSTGRES_USER', 'POSTGRES_DB']);
  const STANDARD_DB_VALUES = new Set(['6379', '5432', '3306', '27017', 'default', 'postgres', 'root', 'admin']);

  function usesRailwayProvidedValue(defaultValue) {
    if (!defaultValue) return false;
    return defaultValue.includes('RAILWAY_') ||
           defaultValue.includes('${{RAILWAY') ||
           defaultValue === 'railway' ||
           defaultValue === 'production';
  }

  function isReferenceVariable(defaultValue) {
    if (!defaultValue) return false;
    return /^\$\{\{\s*[A-Z_][A-Z0-9_]*\s*\}\}$/i.test(defaultValue);
  }

  function usesTemplateFunction(defaultValue) {
    if (!defaultValue) return false;
    return /\$\{\{\s*(secret|randomInt|randomString)\s*\(/i.test(defaultValue);
  }

  for (const service of services) {
    if (!service.variables) continue;

    for (const [varName, varConfig] of Object.entries(service.variables)) {
      const defaultValue = varConfig.default || '';

      if (!varConfig.description || varConfig.description.trim() === '') {
        const isWellKnown = WELL_KNOWN_VARS.has(varName);
        const isRailwayProvided = usesRailwayProvidedValue(defaultValue);
        const isStandardValue = STANDARD_DB_VALUES.has(defaultValue);
        const isReference = isReferenceVariable(defaultValue);
        const usesFunction = usesTemplateFunction(defaultValue);

        const shouldSkip = isWellKnown || isRailwayProvided || isStandardValue || isReference || usesFunction;

        if (!shouldSkip) {
          issues.push(`Service "${service.name}" - var "${varName}" missing description (default: "${defaultValue?.substring(0, 50)}")`);
        }
      }

      // Check for weak passwords
      if ((varName.toLowerCase().includes('password') || varName.toLowerCase().includes('secret')) &&
          defaultValue && !defaultValue.includes('${{')) {
        const WEAK_DEFAULTS = ['password', 'admin', 'password123', 'secret', 'changeme', '123456'];
        if (WEAK_DEFAULTS.includes(defaultValue.toLowerCase())) {
          issues.push(`Service "${service.name}" - var "${varName}" has weak default password`);
        }
      }
    }
  }
  return issues;
}

async function testTemplate(code) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${code}`);
  console.log('='.repeat(60));

  try {
    const template = await fetchTemplate(code);

    if (!template) {
      console.log('❌ Template not found');
      return;
    }

    console.log(`Name: ${template.name}`);
    console.log(`Verified: ${template.isVerified ? '✓' : '✗'}`);
    console.log();

    const config = parseSerializedConfig(template.serializedConfig);
    console.log(`Services: ${config.services.map(s => s.name).join(', ')}`);
    console.log();

    // Run validators
    const namingIssues = validateNaming(config.services);
    const healthIssues = validateHealthChecks(config.services);
    const envVarIssues = validateEnvVars(config.services);

    const allIssues = [...namingIssues, ...healthIssues, ...envVarIssues];

    if (allIssues.length === 0) {
      console.log('✅ ALL VALIDATORS PASSED');
    } else {
      console.log(`⚠️  Found ${allIssues.length} issues:\n`);
      allIssues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function main() {
  const templates = ['redis', 'directus-official'];

  for (const code of templates) {
    await testTemplate(code);
  }
}

main().catch(console.error);
