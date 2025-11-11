import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { JsonPlaceholderService, Post } from '../../services/jsonplaceholder.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';

@Component({
  selector: 'app-http-client-demo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './http-client-demo.component.html',
  styleUrl: './http-client-demo.component.scss'
})
export class HttpClientDemoComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(JsonPlaceholderService);

  posts = signal<Post[]>([]);
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  creating = signal<boolean>(false);
  createError = signal<string | null>(null);
  createdPost = signal<Post | null>(null);

  postForm = this.fb.group({
    title: ['', [Validators.required]],
    body: ['', [Validators.required]],
    userId: [1, [Validators.required]]
  });

  loadPosts(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.getPosts().subscribe({
      next: (data) => {
        this.posts.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Failed to load posts');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  onSubmit(): void {
    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      return;
    }
    const payload = this.postForm.getRawValue();
    this.creating.set(true);
    this.createError.set(null);
    this.createdPost.set(null);
    this.api.createPost({
      title: payload.title ?? '',
      body: payload.body ?? '',
      userId: Number(payload.userId ?? 1)
    }).subscribe({
      next: (created) => {
        this.createdPost.set(created);
        this.creating.set(false);
      },
      error: (err) => {
        this.createError.set('Failed to create post');
        this.creating.set(false);
        console.error(err);
      }
    });
  }
}
