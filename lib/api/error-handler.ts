export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// O wrapper `withErrorHandler` será implementado na Story 1.4 quando aparecer
// o primeiro Route Handler. Por ora exportamos só a classe pra `requireUser` usar.
