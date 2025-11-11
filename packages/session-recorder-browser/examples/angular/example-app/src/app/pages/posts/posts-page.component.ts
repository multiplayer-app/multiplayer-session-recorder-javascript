import { Component, OnInit, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JsonPlaceholderService, Post } from '../../services/jsonplaceholder.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { PostCardComponent } from '../../components/post-card/post-card.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-posts-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, PostCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './posts-page.component.html',
  styleUrl: './posts-page.component.scss'
})
export class PostsPageComponent implements OnInit {
  private readonly api = inject(JsonPlaceholderService);
  private readonly destroyRef = inject(DestroyRef);
  posts = signal<Post[]>([]);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  reload(): void {
    this.load();
  }

  private load(): void {
    this.error.set(null);
    this.posts.set([]);
    this.api.getPosts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.posts.set(data),
        error: () => this.error.set('Failed to load posts')
      });
  }
}
