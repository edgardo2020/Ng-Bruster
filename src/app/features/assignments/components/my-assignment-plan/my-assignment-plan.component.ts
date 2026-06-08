import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';

import { AssignmentDetail, AssignmentDetailExercise } from '../../data-access/assignments-api.service';

@Component({
  selector: 'app-my-assignment-plan',
  standalone: true,
  imports: [CommonModule, DatePipe, MatCardModule, MatChipsModule, MatDividerModule, MatIconModule],
  templateUrl: './my-assignment-plan.component.html',
  styleUrl: './my-assignment-plan.component.scss'
})
export class MyAssignmentPlanComponent {
  @Input({ required: true }) details: AssignmentDetail[] = [];

  private readonly defaultsByIntensity: Record<string, { sets: number; reps: number; weight: number }> = {
    Baja: { sets: 3, reps: 12, weight: 15 },
    Media: { sets: 3, reps: 10, weight: 20 },
    Alta: { sets: 4, reps: 8, weight: 25 }
  };

  get latestDetail(): AssignmentDetail | null {
    if (!this.details.length) {
      return null;
    }

    return [...this.details].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0] ?? null;
  }

  getAgendaLabel(week?: number, day?: string): string {
    const resolvedWeek = Number.isFinite(Number(week)) ? Number(week) : 1;
    const resolvedDay = day?.trim() || 'Dia programado';
    return `Semana ${resolvedWeek} - ${resolvedDay}`;
  }

  getEffectiveWeeks(detail: AssignmentDetail): number {
    const weeksWithExercises = this.getAgendaWithExercises(detail)
      .map((item) => Number(item.week))
      .filter((week) => Number.isFinite(week));

    if (weeksWithExercises.length > 0) {
      return Math.max(...weeksWithExercises);
    }

    return detail.durationWeeks ?? 0;
  }

  getAssignedSets(exercise: AssignmentDetailExercise, intensity?: string): number {
    return exercise.assignedSets ?? this.getDefaults(intensity).sets;
  }

  getAssignedReps(exercise: AssignmentDetailExercise, intensity?: string): number {
    return exercise.assignedReps ?? this.getDefaults(intensity).reps;
  }

  getAssignedWeight(exercise: AssignmentDetailExercise, intensity?: string): number {
    return exercise.assignedWeight ?? this.getDefaults(intensity).weight;
  }

  getAgendaWithExercises(detail: AssignmentDetail) {
    return (detail.agenda ?? []).filter((item) => (item.exercises?.length ?? 0) > 0);
  }

  private getDefaults(intensity?: string): { sets: number; reps: number; weight: number } {
    return this.defaultsByIntensity[intensity ?? ''] ?? this.defaultsByIntensity['Media'];
  }
}
