import { bootstrapApplication } from '@angular/platform-browser';
import { Logger } from '@macro/logger';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const logger = Logger.getLogger('Prism');
logger.info('Prism — Blotter as a Service');

bootstrapApplication(App, appConfig).catch((err) => logger.error('Bootstrap error', err));
