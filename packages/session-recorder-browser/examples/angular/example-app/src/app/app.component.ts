import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import SessionRecorder from '@multiplayer-app/session-recorder-browser';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'angular-example';

  private destroy$ = new Subject<void>();

  constructor(private readonly router: Router) { }

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        // Record navigation with full context
        SessionRecorder.navigation.record({
          path: event.urlAfterRedirects,
          url: event.urlAfterRedirects,
          routeName: event.urlAfterRedirects,
          title: document.title,
          navigationType: 'push',
          framework: 'angular',
          source: 'router'
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
