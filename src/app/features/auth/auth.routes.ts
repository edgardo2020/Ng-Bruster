import { Routes } from '@angular/router';

import { LoginPageComponent } from './pages/login.page';
import { LoginComponent } from './components/login/login.component';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    component: LoginPageComponent
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'login-component',
    component: LoginComponent
  }
];