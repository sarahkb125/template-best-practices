// Main Express server entry point

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
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

    // Fetch template metadata from Railway API
    const metadata = await railwayClient.fetchTemplateMetadata(templateCode);

    if (!metadata) {
      return res.render('index', {
        error: `Template not found: ${templateCode}. Please check the template code and try again.`,
      });
    }

    // Get GitHub repository URL
    let repoUrl = metadata.repoUrl;

    if (!repoUrl) {
      return res.render('index', {
        error: `Template "${metadata.name}" does not have a GitHub repository configured`,
      });
    }

    // Fetch railway.json/toml from GitHub
    let config;
    try {
      config = await githubFetcher.fetchRailwayConfig(repoUrl);
    } catch (error: any) {
      return res.render('index', {
        error: `Failed to fetch template configuration: ${error.message}`,
      });
    }

    // Fetch README (optional)
    const readme = await githubFetcher.fetchReadme(repoUrl);

    // Build template data
    const templateData: TemplateData = {
      code: metadata.code,
      name: metadata.name,
      description: metadata.description,
      creator: metadata.creator,
      config,
      repoUrl,
      readme,
      serviceMetadata: metadata.services,
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
