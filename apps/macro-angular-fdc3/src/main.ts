import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('MacroAngularFdc3Main');

logger.info('Macro Angular FDC3 App');
bootstrapApplication(App, appConfig).catch((err) => logger.error('Bootstrap error', err));
