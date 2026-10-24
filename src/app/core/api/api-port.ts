export type QueryParams = Readonly<Record<string, string | number | boolean | readonly string[]>>;

export interface ReadOptions {
  readonly params?: QueryParams;
}

/**
 * HTTP access to the engine, as the application needs it. Paths are engine-relative (`/me`);
 * where the engine lives and how a call is authenticated are the adapter's and the interceptor's
 * business. An abstract class, so it is both the contract and the injection token.
 */
export abstract class ApiPort {
  abstract get<T>(path: string, options?: ReadOptions): Promise<T>;
  abstract post<T>(path: string, body: unknown): Promise<T>;
  abstract put<T>(path: string, body: unknown): Promise<T>;
  abstract patch<T>(path: string, body: unknown): Promise<T>;
  abstract delete<T = void>(path: string): Promise<T>;
}
