#!/usr/bin/env node
/*
 * AI Code Review tool using OpenRouter.
 * Usage:
 *   node tools/review.mjs                  # review uncommitted git diff
 *   node tools/review.mjs <file-path>       # review a specific file
 *   node tools/review.mjs --security        # security-focused review of worker & endpoints
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Load key from worker/.dev.vars if not in env
let apiKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;
let model = process.env.COACH_MODEL;

const devVarsPath = join(root, 'worker/.dev.vars');
if (existsSync(devVarsPath)) {
  const lines = readFileSync(devVarsPath, 'utf8').split('\n');
  for (const line of lines) {
    if (!apiKey && line.startsWith('OPENROUTER_KEY=')) {
      apiKey = line.split('=')[1].replace(/^["']|["']$/g, '').trim();
    }
    if (!model && line.startsWith('COACH_MODEL=')) {
      model = line.split('=')[1].replace(/^["']|["']$/g, '').trim();
    }
  }
}
if (!model) model = 'openai/gpt-4o-mini';

if (!apiKey) {
  console.error('Error: OPENROUTER_KEY not found in environment or worker/.dev.vars');
  process.exit(1);
}

const args = process.argv.slice(2);
let contentToReview = '';
let targetDescription = '';

if (args.includes('--security')) {
  targetDescription = 'Worker & Security Architecture';
  const workerSrc = readFileSync(join(root, 'worker/worker.js'), 'utf8');
  contentToReview = `=== worker/worker.js (Auth, DO, and Model handling) ===\n${workerSrc.slice(0, 12000)}`;
} else if (args.length > 0 && !args[0].startsWith('--')) {
  const filePath = join(root, args[0]);
  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${args[0]}`);
    process.exit(1);
  }
  targetDescription = args[0];
  contentToReview = readFileSync(filePath, 'utf8');
  if (contentToReview.length > 15000) {
    contentToReview = contentToReview.slice(0, 15000) + '\n\n...[truncated for context limit]';
  }
} else {
  // Default: Git diff
  try {
    const diff = execSync('git diff HEAD', { cwd: root, encoding: 'utf8' }).trim();
    if (!diff) {
      console.log('No uncommitted changes in git. To review a file: node tools/review.mjs <file>');
      process.exit(0);
    }
    targetDescription = 'Current git diff (uncommitted changes)';
    contentToReview = diff.slice(0, 15000);
  } catch (err) {
    console.error('Error getting git diff:', err.message);
    process.exit(1);
  }
}

console.log(`\x1b[36mInitiating OpenRouter review with ${model} for: ${targetDescription}...\x1b[0m\n`);

const prompt = `You are a senior full-stack engineer and security auditor reviewing this code.
Review the following code changes/files:

${contentToReview}

Please provide a concise, high-signal review covering:
1. Key Strengths & Architecture
2. Potential Bugs, Race Conditions, or Edge Cases
3. Security & Data Validation
4. Practical Optimization Recommendations
`;

try {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://musetteapp.com',
      'X-Title': 'Musette Code Reviewer',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2500,
      messages: [
        {
          role: 'system',
          content: 'You are an expert software reviewer. Give concise, direct, actionable, bulleted feedback.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`OpenRouter API error (${response.status}):`, errText);
    process.exit(1);
  }

  const data = await response.json();
  const review = data.choices?.[0]?.message?.content;
  if (!review) {
    console.error('Received empty response from OpenRouter');
    process.exit(1);
  }

  console.log(review);
  if (data.usage?.cost) {
    console.log(`\n\x1b[90m[Review cost: $${data.usage.cost.toFixed(5)} | Tokens: ${data.usage.total_tokens}]\x1b[0m`);
  }
} catch (err) {
  console.error('Review failed:', err.message);
  process.exit(1);
}
