import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { relayedAuthResponse } from './app/core/auth/msal-bridge';

// An auth answer landing in a popup or a silent iframe goes back to the main window — no app here.
if (!relayedAuthResponse(window)) {
  bootstrapApplication(App, appConfig).catch((err) => console.error(err));
}
