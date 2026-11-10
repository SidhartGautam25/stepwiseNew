export type LintSeverity = 'error' | 'warning';

export interface LintDiagnostic {
  ruleId: string;
  severity: LintSeverity;
  filePath: string;
  line?: number;
  message: string;
}

export interface LintReport {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  diagnostics: LintDiagnostic[];
}

export function createLintReport(diagnostics: LintDiagnostic[]): LintReport {
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  return {
    valid: errorCount === 0,
    errorCount,
    warningCount,
    diagnostics,
  };
}
