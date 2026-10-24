import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideApi } from './core/api/provide-api';
import { authInterceptor } from './core/auth/auth-interceptor';
import { provideAuth } from './core/auth/provide-auth';
import { ENVIRONMENT } from './core/config/environment';
import { provideI18n } from './core/i18n/provide-i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideI18n(),
    provideApi(ENVIRONMENT.apiBaseUrl),
    provideAuth(ENVIRONMENT.auth),
  ],
};
