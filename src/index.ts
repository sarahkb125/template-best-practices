// Main Express server entry point

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { parseTemplateUrl, isValidTemplateCode } from './fetchers/url-parser.js';
import { GitHubFetcher } from './fetchers/github-fetcher.js';
import { RailwayAPIClient } from './fetchers/railway-api.js';
import { validateTemplate } from './validators/validator-engine.js';
import { TemplateData } from './types/template.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Set up EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Initialize fetchers
const githubFetcher = new GitHubFetcher({
  token: process.env.GITHUB_TOKEN,
});

const railwayClient = new RailwayAPIClient({
  token: process.env.RAILWAY_API_TOKEN,
});

// Routes
app.get('/', (req, res) => {
  res.render('index', {
    error: null,
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/validate', async (req, res) => {
  try {
    const { templateUrl } = req.body;

    if (!templateUrl) {
      return res.render('index', {
        error: 'Please provide a Railway template URL or code',
      });
    }

    // Parse the template URL/code
    let templateCode: string;
    try {
      templateCode = parseTemplateUrl(templateUrl);
    } catch (error: any) {
      return res.render('index', {
        error: `Invalid template URL or code: ${error.message}`,
      });
    }

    if (!isValidTemplateCode(templateCode)) {
      return res.render('index', {
        error: 'Invalid template code format',
      });
    }

    // Fetch template metadata from Railway API (includes serializedConfig)
    const response = await axios.post(
      'https://backboard.railway.com/graphql/v2',
      {
        query: `
          query GetTemplate($code: String!) {
            template(code: $code) {
              code
              name
              description
              readme
              creator {
                name
                username
              }
              serializedConfig
            }
          }
        `,
        variables: { code: templateCode },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    if (response.data.errors || !response.data.data?.template) {
      return res.render('index', {
        error: `Template not found: ${templateCode}. Please check the template code and try again.`,
      });
    }

    const templateRaw = response.data.data.template;

    // Parse serializedConfig into our RailwayTemplate format
    const config = railwayClient.parseSerializedConfigToRailwayTemplate(templateRaw.serializedConfig);

    // Extract repo URL from services if available
    let repoUrl: string | undefined;
    if (templateRaw.serializedConfig?.services) {
      for (const [serviceId, serviceConfig] of Object.entries(templateRaw.serializedConfig.services)) {
        const svc: any = serviceConfig;
        if (svc.source?.repo) {
          repoUrl = svc.source.repo;
          break;
        }
      }
    }

    // Fetch README and Dockerfile from GitHub if repo is available (optional)
    let readme = templateRaw.readme;
    let dockerfile: string | undefined;

    if (repoUrl) {
      try {
        if (!readme) {
          readme = await githubFetcher.fetchReadme(repoUrl);
        }
        dockerfile = await githubFetcher.fetchDockerfile(repoUrl);
      } catch (error) {
        // Ignore errors - README and Dockerfile are optional
      }
    }

    // Build template data
    const templateData: TemplateData = {
      code: templateRaw.code,
      name: templateRaw.name,
      description: templateRaw.description,
      creator: {
        name: templateRaw.creator?.name || templateRaw.creator?.username || 'Unknown',
        workspaceName: templateRaw.creator?.username,
      },
      config,
      repoUrl: repoUrl || 'N/A',
      readme,
      dockerfile,
    };

    // Validate the template
    const report = await validateTemplate(templateData);

    // Render results page
    res.render('results', {
      report,
      templateData,
    });

  } catch (error: any) {
    console.error('Validation error:', error);
    res.render('index', {
      error: `An error occurred: ${error.message}`,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Railway Template Validator running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to validate templates`);
});
