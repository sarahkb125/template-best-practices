// Fetch railway.json/toml and README from GitHub repositories

import axios from 'axios';
import * as TOML from 'toml';
import { RailwayTemplate } from '../types/template.js';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

interface GitHubConfig {
  token?: string;
}

export class GitHubFetcher {
  private config: GitHubConfig;

  constructor(config: GitHubConfig = {}) {
    this.config = config;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    return headers;
  }

  async fetchRailwayConfig(repoUrl: string): Promise<RailwayTemplate> {
    const { owner, repo, branch } = this.parseGitHubUrl(repoUrl);

    // Try railway.json first
    try {
      const jsonContent = await this.fetchFileContent(owner, repo, 'railway.json', branch);
      return JSON.parse(jsonContent);
    } catch (error) {
      // If railway.json doesn't exist, try railway.toml
      try {
        const tomlContent = await this.fetchFileContent(owner, repo, 'railway.toml', branch);
        return TOML.parse(tomlContent) as RailwayTemplate;
      } catch (tomlError) {
        throw new Error(`Neither railway.json nor railway.toml found in repository: ${repoUrl}`);
      }
    }
  }

  async fetchReadme(repoUrl: string): Promise<string | undefined> {
    const { owner, repo, branch } = this.parseGitHubUrl(repoUrl);

    const possibleReadmeFiles = ['README.md', 'readme.md', 'Readme.md', 'README.MD'];

    for (const filename of possibleReadmeFiles) {
      try {
        return await this.fetchFileContent(owner, repo, filename, branch);
      } catch (error) {
        // Continue to next possibility
      }
    }

    return undefined; // No README found
  }

  private async fetchFileContent(owner: string, repo: string, path: string, branch: string): Promise<string> {
    // Use raw.githubusercontent.com for faster, direct file access
    const url = `${GITHUB_RAW_BASE}/${owner}/${repo}/${branch}/${path}`;

    try {
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 10000,
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`File not found: ${path}`);
      }
      throw new Error(`Failed to fetch ${path}: ${error.message}`);
    }
  }

  private parseGitHubUrl(repoUrl: string): { owner: string; repo: string; branch: string } {
    // Handle various GitHub URL formats:
    // https://github.com/owner/repo
    // https://github.com/owner/repo/tree/branch
    // github.com/owner/repo
    // owner/repo

    let url = repoUrl.trim();

    // Remove protocol if present
    url = url.replace(/^https?:\/\//, '');

    // Remove github.com if present
    url = url.replace(/^github\.com\//, '');

    // Remove trailing slash
    url = url.replace(/\/$/, '');

    const parts = url.split('/');

    if (parts.length < 2) {
      throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, ''); // Remove .git extension if present

    // Check if branch is specified
    let branch = 'main'; // Default branch
    if (parts.length > 3 && parts[2] === 'tree') {
      branch = parts[3];
    }

    // Try main first, fall back to master if needed
    return { owner, repo, branch };
  }

  async checkBranch(owner: string, repo: string, branch: string): Promise<boolean> {
    try {
      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/branches/${branch}`;
      await axios.get(url, { headers: this.getHeaders() });
      return true;
    } catch {
      return false;
    }
  }
}
