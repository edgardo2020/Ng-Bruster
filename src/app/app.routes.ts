import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { AppShellComponent } from './shared/layout/app-shell.component';

export const routes: Routes = [
	{
		path: 'auth',
		canActivate: [guestGuard],
		loadChildren: () => import('./features/auth/auth.routes').then((module) => module.AUTH_ROUTES)
	},
	{
		path: '',
		component: AppShellComponent,
		canActivate: [authGuard],
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'dashboard'
			},
			{
				path: 'dashboard',
				data: { roles: ['Trainer'] },
				canActivate: [roleGuard],
				loadChildren: () => import('./features/dashboard/dashboard.routes').then((module) => module.DASHBOARD_ROUTES)
			},
			{
				path: 'users',
				canActivate: [roleGuard],
				data: { roles: ['Trainer'] },
				loadChildren: () => import('./features/users/users.routes').then((module) => module.USERS_ROUTES)
			},
			{
				path: 'memberships',
				canActivate: [roleGuard],
				data: { roles: ['Trainer', ] },
				loadChildren: () => import('./features/memberships/memberships.routes').then((module) => module.MEMBERSHIPS_ROUTES)
			},
			{
				path: 'routines',
				canActivate: [roleGuard],
				data: { roles: ['Trainer', 'Trainee'] },
				loadChildren: () => import('./features/routines/routines.routes').then((module) => module.ROUTINES_ROUTES)
			},
			{
				path: 'exercises',
				canActivate: [roleGuard],
				data: { roles: ['Trainer'] },
				loadChildren: () => import('./features/exercises/exercises.routes').then((module) => module.EXERCISES_ROUTES)
			},
			{
				path: 'foods',
				canActivate: [roleGuard],
				data: { roles: ['Trainer', 'Trainee'] },
				loadChildren: () => import('./features/foods/foods.routes').then((module) => module.FOODS_ROUTES)
			},
			{
				path: 'training-plans',
				canActivate: [roleGuard],
				data: { roles: ['Trainer', 'Trainee'] },
				loadChildren: () => import('./features/training-plans/training-plans.routes').then((module) => module.TRAINING_PLANS_ROUTES)
			},
			{
				path: 'assignments',
				canActivate: [roleGuard],
				data: { roles: ['Trainer'] },
				loadChildren: () => import('./features/assignments/assignments.routes').then((module) => module.ASSIGNMENTS_ROUTES)
			},
			{
				path: 'checkin',
				canActivate: [roleGuard],
				data: { roles: ['Trainer'] },
				loadChildren: () => import('./features/checkin/checkin.routes').then((module) => module.CHECKIN_ROUTES)
			},
			{
				path: 'reports',
				canActivate: [roleGuard],
				data: { roles: ['Trainer'] },
				loadChildren: () => import('./features/reports/reports.routes').then((module) => module.REPORTS_ROUTES)
			}
		]
	},
	{
		path: '**',
		redirectTo: 'dashboard'
	}
];
