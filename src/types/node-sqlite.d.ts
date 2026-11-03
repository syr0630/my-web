/**
 * Minimal ambient types for Node's built-in SQLite module.
 * @types/node 20 predates `node:sqlite`; the runtime is Node 24.
 */
declare module "node:sqlite" {
  export type SQLInputValue = string | number | bigint | null | Uint8Array;

  export class StatementSync {
    run(...params: SQLInputValue[]): {
      changes: number;
      lastInsertRowid: number | bigint;
    };
    get<T = Record<string, unknown>>(...params: SQLInputValue[]): T | undefined;
    all<T = Record<string, unknown>>(...params: SQLInputValue[]): T[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}