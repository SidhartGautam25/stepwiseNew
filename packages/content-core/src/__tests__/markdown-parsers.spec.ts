import { describe, it, expect } from 'vitest';
import { parseOverviewMarkdown } from '../markdown/overview-parser.js';
import { parseChapterMarkdown } from '../markdown/chapter-parser.js';
import { checkMarkdownHtmlSafety, sanitizeMarkdown } from '../markdown/sanitizer.js';

describe('Markdown Parsers', () => {
  describe('Overview Parser', () => {
    it('parses all 5 mandatory sections correctly', () => {
      const markdown = `
# Redis Workshop

## What we build
An in-memory, single-threaded Redis clone supporting strings and lists.

## What you will learn
Socket programming, event loops, RESP protocol parsing.

## Prerequisites
Familiarity with Go or Python, basic terminal skills.

## Limitations and scope
Does not implement clustering or persistence.

## How this workshop works
Complete steps locally, git push to run tests.
      `;

      const result = parseOverviewMarkdown(markdown);
      expect(result.missingSections).toHaveLength(0);
      expect(result.sections.whatWeBuild).toContain('in-memory');
      expect(result.sections.whatYouLearn).toContain('Socket programming');
      expect(result.sections.prerequisites).toContain('Familiarity with Go');
      expect(result.sections.limitations).toContain('Does not implement');
      expect(result.sections.howItWorks).toContain('Complete steps locally');
    });

    it('detects missing sections in overview.md', () => {
      const incomplete = `
## What we build
An HTTP server.
      `;
      const result = parseOverviewMarkdown(incomplete);
      expect(result.missingSections).toContain('What you will learn');
      expect(result.missingSections).toContain('Prerequisites');
    });
  });

  describe('Chapter Parser', () => {
    it('parses chapter intro and step subsections with {#heading-id}', () => {
      const markdown = `
# Chapter 1: Bind to Port

This chapter guides you through creating a TCP socket and binding to port 6379.
Make sure port 6379 is not occupied.

## Bind to a Port {#bind-socket}

### Task
Create a TCP listener on 127.0.0.1:6379.

### Theory
Sockets represent network communication endpoints.

### Hints
Use net.Listen in Go or socket.socket in Python.

## Accept Connections {#accept-connection}

### Task
Call Accept() in a loop.

### Theory
Accept blocks until an incoming client initiates a connection.
      `;

      const result = parseChapterMarkdown(markdown);
      expect(result.intro).toContain('This chapter guides you');
      expect(result.steps).toHaveLength(2);

      const step1 = result.steps[0];
      expect(step1.id).toBe('bind-socket');
      expect(step1.title).toBe('Bind to a Port');
      expect(step1.hasTask).toBe(true);
      expect(step1.hasTheory).toBe(true);
      expect(step1.hasHints).toBe(true);
      expect(step1.content.task).toContain('Create a TCP listener');
      expect(step1.content.hints).toContain('net.Listen');

      const step2 = result.steps[1];
      expect(step2.id).toBe('accept-connection');
      expect(step2.hasHints).toBe(false);
      expect(step2.content.hints).toBeUndefined();
    });

    it('detects duplicate heading IDs', () => {
      const duplicateMarkdown = `
## Step One {#dup-id}
### Task
Task 1
### Theory
Theory 1

## Step Two {#dup-id}
### Task
Task 2
### Theory
Theory 2
      `;

      const result = parseChapterMarkdown(duplicateMarkdown);
      expect(result.duplicateHeadingIds).toContain('dup-id');
    });
  });

  describe('HTML Safety and Sanitizer', () => {
    it('allows clean markdown and code blocks containing HTML strings', () => {
      const safe = `
# Safe Heading

Here is regular text with \`<code>\` inline.

\`\`\`html
<script>alert("safe inside code fence")</script>
\`\`\`
      `;
      const check = checkMarkdownHtmlSafety(safe);
      expect(check.safe).toBe(true);
    });

    it('detects unallowed raw HTML script tags', () => {
      const dangerous = `
Some text
<script>window.stealCookies()</script>
More text
      `;
      const check = checkMarkdownHtmlSafety(dangerous);
      expect(check.safe).toBe(false);
      expect(check.offendingTag).toBe('script');
      expect(check.line).toBe(3);
    });

    it('sanitizes dangerous tags', () => {
      const input = 'Hello <script>bad()</script> <iframe src="http://evil"></iframe> world';
      const output = sanitizeMarkdown(input);
      expect(output).not.toContain('<script>');
      expect(output).not.toContain('<iframe>');
      expect(output).toContain('Hello');
      expect(output).toContain('world');
    });
  });
});
