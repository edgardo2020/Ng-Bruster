import { Routes } from '@angular/router';

import { UsersPageComponent } from './pages/users.page';
import { UserProgressPageComponent } from './pages/user-progress.page';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    component: UsersPageComponent
  },
  {
    path: 'progress',
    component: UserProgressPageComponent
  }
];