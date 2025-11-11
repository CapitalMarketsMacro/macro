import { Component, OnInit } from '@angular/core';
import { Logger } from '@macro/logger';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: true,
})
export class App implements OnInit {
  private logger = Logger.getLogger('AngularApp');

  ngOnInit(): void {
    this.logger.info('Angular app initialized');
    this.logger.debug('This is a debug message');
  }
}
