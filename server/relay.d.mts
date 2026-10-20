import type { IncomingMessage, ServerResponse } from 'node:http';

export const ASSISTANT_MODEL: string;
export function relay(
  env: Record<string, string | undefined>,
  options?: { cors?: boolean },
): (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => Promise<void>;
