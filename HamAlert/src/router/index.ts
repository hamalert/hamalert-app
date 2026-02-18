import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import HomePage from '../views/HomePage.vue';
import LoginPage from '../views/LoginPage.vue';
import SettingsPage from '../views/SettingsPage.vue';
import { apiService } from '@/services/api';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginPage,
    meta: { requiresAuth: false }
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage,
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsPage,
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// Navigation guard to check authentication
router.beforeEach(async (to, from, next) => {
  // Ensure credentials are loaded from storage
  await apiService.initialize();
  
  const isLoggedIn = apiService.isLoggedIn();
  const requiresAuth = to.meta.requiresAuth !== false; // Default to true if not specified

  if (requiresAuth && !isLoggedIn) {
    // Redirect to login if not authenticated
    next('/login');
  } else if (to.path === '/login' && isLoggedIn) {
    // Redirect to home if already logged in and trying to access login
    next('/home');
  } else {
    next();
  }
});

export default router;
