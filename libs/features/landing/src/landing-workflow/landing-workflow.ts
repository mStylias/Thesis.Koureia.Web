import { Component } from '@angular/core';
import { LucideCalendarDays, LucideCheck, LucideLayoutDashboard } from '@lucide/angular';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'lib-landing-workflow',
  imports: [LucideCalendarDays, LucideCheck, LucideLayoutDashboard, TranslocoPipe],
  templateUrl: './landing-workflow.html',
  styleUrl: './landing-workflow.scss',
})
export class LandingWorkflow {}
