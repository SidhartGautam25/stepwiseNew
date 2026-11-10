/**
 * ContentSource port representing access to workshop content in Git/GitHub.
 */
export interface ContentSource {
  /**
   * Lists all available branch names mapped to their latest commit SHAs.
   * e.g. "main" -> "a1b2c3...", "chapter/bind-port" -> "d4e5f6..."
   */
  listBranchTips(): Promise<Map<string, string>>;

  /**
   * Reads the complete file tree at a specific commit SHA into an in-memory map.
   * Keys are normalized POSIX relative paths (e.g. "handrail/chapter.yaml").
   * Values are raw file buffers.
   */
  readTree(commitSha: string): Promise<Map<string, Buffer>>;
}
