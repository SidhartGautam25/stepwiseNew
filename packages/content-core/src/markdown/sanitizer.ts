export interface HtmlSafetyCheckResult {
  safe: boolean;
  offendingTag?: string;
  line?: number;
}

// Disallow raw HTML tags in authored markdown.
// Code blocks and inline code fences (which are not executed HTML) are exempted.
export function checkMarkdownHtmlSafety(markdown: string): HtmlSafetyCheckResult {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  let inCodeBlock = false;

  const dangerousTagRegex = /<\s*(script|iframe|object|embed|form|input|button|style|link|meta|base|applet|svg|math)[^>]*>/i;
  const inlineEventRegex = /\s(on\w+)\s*=/i;
  const anyRawHtmlTagRegex = /<\s*([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // Check code fences
    if (line.trim().startsWith('```') || line.trim().startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      continue;
    }

    // Strip inline backticks `...` so `<div>` inside inline code doesn't falsely trigger
    const withoutInlineCode = line.replace(/`[^`]*`/g, '');

    const dangerousMatch = withoutInlineCode.match(dangerousTagRegex);
    if (dangerousMatch) {
      return {
        safe: false,
        offendingTag: dangerousMatch[1],
        line: lineNo,
      };
    }

    const eventMatch = withoutInlineCode.match(inlineEventRegex);
    if (eventMatch) {
      return {
        safe: false,
        offendingTag: eventMatch[1],
        line: lineNo,
      };
    }

    // Check if raw HTML tags are present (Handrail content model specifies: no raw HTML or script tags)
    const rawTagMatch = withoutInlineCode.match(anyRawHtmlTagRegex);
    if (rawTagMatch) {
      const tag = rawTagMatch[1].toLowerCase();
      // Allow markdown comments or specific void tags if needed, but per rule: "no raw HTML or script tags"
      if (!['!--'].includes(tag)) {
        return {
          safe: false,
          offendingTag: tag,
          line: lineNo,
        };
      }
    }
  }

  return { safe: true };
}

/**
 * Sanitizes markdown string by escaping or stripping dangerous HTML tokens
 */
export function sanitizeMarkdown(markdown: string): string {
  return markdown
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<\s*(object|embed|form|input|button|style|link)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
}
