import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('MacroAngularMain');

logger.info('Macro Angular App');
bootstrapApplication(App, appConfig).catch((err) => logger.error('Bootstrap error', err));
