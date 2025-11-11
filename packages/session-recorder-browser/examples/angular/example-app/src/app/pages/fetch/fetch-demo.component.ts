import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';

interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

@Component({
  selector: 'app-fetch-demo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './fetch-demo.component.html',
  styleUrl: './fetch-demo.component.scss'
})
export class FetchDemoComponent {
  private readonly fb = inject(FormBuilder);

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

  private readonly baseUrl = 'https://jsonplaceholder.typicode.com';

  async loadPosts(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const res = await fetch(`${this.baseUrl}/posts`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as Post[];
      this.posts.set(data);
    } catch (e) {
      console.error(e);
      this.errorMessage.set('Failed to load posts');
    } finally {
      this.loading.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      return;
    }
    const payload = this.postForm.getRawValue();
    this.creating.set(true);
    this.createError.set(null);
    this.createdPost.set(null);
    try {
      const res = await fetch(`${this.baseUrl}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify({
          title: payload.title ?? '',
          body: payload.body ?? '',
          userId: Number(payload.userId ?? 1)
        })
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const created = await res.json() as Post;
      this.createdPost.set(created);
    } catch (e) {
      console.error(e);
      this.createError.set('Failed to create post');
    } finally {
      this.creating.set(false);
    }
  }
}
