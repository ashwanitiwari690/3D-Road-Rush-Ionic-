import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage) },
  { path: 'game', loadComponent: () => import('./pages/game/game.page').then(m => m.GamePage) },
  { path: 'result', loadComponent: () => import('./pages/result/result.page').then(m => m.ResultPage) },
  { path: 'shop', loadComponent: () => import('./pages/shop/shop.page').then(m => m.ShopPage) },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings.page').then(m => m.SettingsPage) },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage) },
  { path: 'garage', loadComponent: () => import('./pages/garage/garage.page').then(m => m.GaragePage) },
  { path: 'missions', loadComponent: () => import('./pages/missions/missions.page').then(m => m.MissionsPage) },
  { path: '**', redirectTo: 'home' }
];
