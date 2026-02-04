// Parse Railway template URLs and extract template codes

export function parseTemplateUrl(input: string): string {
  // Handle different URL formats:
  // 1. railway.com/deploy/code
  // 2. railway.com/template/XXX
  // 3. Just the template code: XXX

  input = input.trim();

  // If it's already just a code (no URL), return it
  if (!input.includes('/') && !input.includes('?')) {
    return input;
  }

  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);

    // Check for ?code= parameter
    const codeParam = url.searchParams.get('code');
    if (codeParam) {
      return codeParam;
    }

    // Check for /template/XXX format
    const pathMatch = url.pathname.match(/\/template\/([^\/]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    // Check for /deploy/XXX format
    const deployPathMatch = url.pathname.match(/\/deploy\/([^\/]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    throw new Error(`Could not extract template code from URL: ${input}`);
  } catch (error) {
    // If URL parsing fails, maybe it's just a code
    if (!input.includes('/') && !input.includes('.')) {
      return input;
    }
    throw new Error(`Invalid template URL or code: ${input}`);
  }
}

export function isValidTemplateCode(code: string): boolean {
  // Template codes are typically alphanumeric with hyphens
  return /^[a-zA-Z0-9-]+$/.test(code) && code.length > 0;
}
