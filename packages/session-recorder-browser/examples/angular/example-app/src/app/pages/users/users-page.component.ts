import { Component, OnInit, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JsonPlaceholderService, User } from '../../services/jsonplaceholder.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { UserCardComponent } from '../../components/user-card/user-card.component';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, UserCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.scss'
})
export class UsersPageComponent implements OnInit {
  private readonly api = inject(JsonPlaceholderService);
  private readonly destroyRef = inject(DestroyRef);
  users = signal<User[]>([]);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  reload(): void {
    this.load();
  }

  private load(): void {
    this.error.set(null);
    this.users.set([]);
    this.api.getUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.users.set(data),
        error: () => this.error.set('Failed to load users')
      });
  }
}
