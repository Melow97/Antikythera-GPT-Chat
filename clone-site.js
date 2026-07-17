import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    'out-dir': { type: 'string' },
    provider: { type: 'string', default: 'openai' }, // 'openai' (vision) or 'deepseek' (text-only)
    'api-key': { type: 'string' },
    model: { type: 'string' },
    width: { type: 'string', default: '1440' },
    height: { type: 'string', default: '1800' },
    'full-page': { type: 'boolean', default: false },
    tagline: { type: 'string' },
  },
});

const url = values.url;
if (!url) {
  console.error('Missing --url');
  process.exit(1);
}

const PROVIDERS = {
  openai: {
    envVar: 'OPENAI_API_KEY',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    supportsVision: true,
  },
  deepseek: {
    envVar: 'DEEPSEEK_API_KEY',
    endpoint: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-chat',
    supportsVision: false,
  },
};

const provider = values.provider;
const providerConfig = PROVIDERS[provider];
if (!providerConfig) {
  console.error(`Unknown --provider "${provider}". Valid values: ${Object.keys(PROVIDERS).join(', ')}`);
  process.exit(1);
}

const model = values.model || providerConfig.defaultModel;

const apiKey = values['api-key'] || process.env[providerConfig.envVar];
if (!apiKey) {
  console.error(`No API key found. Set ${providerConfig.envVar} or pass --api-key.`);
  process.exit(1);
}

if (!providerConfig.supportsVision) {
  console.warn(
    `Note: ${provider} is text-only here — the screenshot is captured for reference but not sent to the model. ` +
      `The clone is reconstructed from the DOM alone, so visual fidelity (colors, spacing, imagery) will be rougher than with a vision-capable provider.`
  );
}

const outDir = values['out-dir'];
if (!outDir) {
  console.error('Missing --out-dir');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const screenshotPath = path.join(outDir, 'reference.png');
const domPath = path.join(outDir, 'reference.dom.html');

function buildSystemPrompt(hasImage) {
  const inputDescription = hasImage
    ? 'You are given a screenshot and the rendered DOM of the original page.'
    : 'You are given the rendered DOM of the original page (no screenshot is available — infer layout, spacing, and styling from the DOM/CSS structure as best you can).';
  return `You rebuild the visual design of a webpage as a clean, standalone static clone using only HTML, CSS,
and minimal vanilla JS. ${inputDescription}

Rules:
- Recreate layout, spacing, typography, colors, and imagery placement as closely as possible.
- Do not copy the original site's JavaScript bundles, analytics, tracking scripts, or backend API calls.
- Do not reproduce any login, signup, password-reset, payment, or other credential/financial data-collection
  form with a real or fake submission endpoint. If the page contains one, render it as a visually faithful but
  inert/non-functional placeholder (no action attribute, no submit handler) and add an HTML comment noting it
  was stubbed out.
- Use placeholder boxes or original public image URLs found in the DOM; do not invent fake image URLs.
- Output must be self-contained: one index.html and one style.css. Inline JS only if trivial (e.g. a mobile nav toggle).
- Respond ONLY using this exact delimiter format, nothing else before or after:

===FILE:index.html===
<full file contents>
===FILE:style.css===
<full file contents>
===END===`;
}

function extractFile(content, startMarker, endMarker) {
  const startIdx = content.indexOf(startMarker);
  if (startIdx < 0) return null;
  const from = startIdx + startMarker.length;
  let endIdx = content.indexOf(endMarker, from);
  if (endIdx < 0) endIdx = content.length;
  return content.slice(from, endIdx).trim();
}

async function main() {
  console.log(`Capturing screenshot of ${url} ...`);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: Number(values.width), height: Number(values.height) },
    });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {
      // some pages (heavy animation/polling) never go idle — proceed with whatever loaded
    });
    await page.screenshot({ path: screenshotPath, fullPage: values['full-page'] });
    const domHtml = await page.content();
    fs.writeFileSync(domPath, domHtml, 'utf8');

    let domText = domHtml;
    const maxDomChars = 40000;
    if (domText.length > maxDomChars) {
      domText = domText.slice(0, maxDomChars) + '\n<!-- truncated -->';
    }

    const taglineInstruction = values.tagline
      ? `\n\nReplace the page's main headline/hero tagline with: "${values.tagline}". Keep every other section's original wording, layout, and styling untouched.`
      : '';
    const userText = `Original page URL: ${url}\n\nRendered DOM (may be truncated):\n${domText}\n\nRebuild this page's visual design as index.html + style.css per the rules.${taglineInstruction}`;

    const systemPrompt = buildSystemPrompt(providerConfig.supportsVision);

    let userContent;
    if (providerConfig.supportsVision) {
      const imageBase64 = fs.readFileSync(screenshotPath).toString('base64');
      userContent = [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
      ];
    } else {
      userContent = userText;
    }

    console.log(`Calling ${provider} (${model}) to rebuild the design...`);
    const response = await fetch(providerConfig.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`API call failed (${response.status}): ${errBody}`);
      process.exit(1);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;

    const html = extractFile(text, '===FILE:index.html===', '===FILE:style.css===');
    const css = extractFile(text, '===FILE:style.css===', '===END===');

    if (!html || !css) {
      const rawPath = path.join(outDir, 'raw-response.txt');
      fs.writeFileSync(rawPath, text, 'utf8');
      console.warn(`Could not parse expected file delimiters. Raw response saved to ${rawPath} for inspection.`);
      process.exit(1);
    }

    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    fs.writeFileSync(path.join(outDir, 'style.css'), css, 'utf8');
    console.log(`Clone written to ${outDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
