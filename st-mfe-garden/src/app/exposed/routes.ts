// expose ผ่าน federation เป็น './routes' — shell mount ที่ /garden (loadRemoteModule('mfe-garden', './routes'))
import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import { RuntimeConfigService } from '@supertrees/shared-ui';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    // MOCK-003: ยังไม่มีแปลงจริง (TASK-004) → ใช้แปลงทดลองจาก runtime config
    redirectTo: () => `parcels/${inject(RuntimeConfigService).config()?.demoParcelId ?? 'none'}/tree-surveys`,
  },
  {
    path: 'parcels/:parcelId/tree-surveys',
    loadComponent: () => import('../pages/tree-survey-list.page').then((m) => m.TreeSurveyListPage),
  },
  {
    path: 'parcels/:parcelId/tree-surveys/new',
    loadComponent: () => import('../pages/tree-survey-new.page').then((m) => m.TreeSurveyNewPage),
  },
  {
    path: 'parcels/:parcelId/tree-surveys/:surveyId',
    loadComponent: () => import('../pages/tree-survey-result.page').then((m) => m.TreeSurveyResultPage),
  },
  // วางแผนปลูก: ปักขอบเขตบนแผนที่ + ระยะปลูก → ตำแหน่งต้นไม้
  {
    path: 'parcels/:parcelId/planting-plans',
    loadComponent: () => import('../pages/planting-plan-list.page').then((m) => m.PlantingPlanListPage),
  },
  {
    path: 'parcels/:parcelId/planting-plans/new',
    loadComponent: () => import('../pages/planting-plan-new.page').then((m) => m.PlantingPlanNewPage),
  },
  // เทียบแผนปลูกกับผลนับจากภาพ (?plan=&survey=)
  {
    path: 'parcels/:parcelId/compare',
    loadComponent: () => import('../pages/plan-compare.page').then((m) => m.PlanComparePage),
  },
  {
    path: 'parcels/:parcelId/planting-plans/:planId',
    loadComponent: () => import('../pages/planting-plan-view.page').then((m) => m.PlantingPlanViewPage),
  },
];
