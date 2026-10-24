import { InjectionToken } from '@angular/core';

/** Where the engine lives. Injected so tests and builds can swap it without touching the adapter. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
