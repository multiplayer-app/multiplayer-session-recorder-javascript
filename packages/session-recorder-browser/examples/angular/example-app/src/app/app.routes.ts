import { Routes } from '@angular/router';
import { HttpClientDemoComponent } from './pages/http-client/http-client-demo.component';
import { FetchDemoComponent } from './pages/fetch/fetch-demo.component';
import { PostsPageComponent } from './pages/posts/posts-page.component';
import { UsersPageComponent } from './pages/users/users-page.component';
import { HomePageComponent } from './pages/home/home-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomePageComponent, title: 'Home' },
  { path: 'posts', component: PostsPageComponent, title: 'Posts' },
  { path: 'users', component: UsersPageComponent, title: 'Users' },
  { path: 'http-client', component: HttpClientDemoComponent, title: 'HttpClient Demo' },
  { path: 'fetch', component: FetchDemoComponent, title: 'Fetch API Demo' }
];
