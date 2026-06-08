
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AssignmentDetail } from '../../../assignments/data-access/assignments-api.service';
import { CommonModule, DatePipe } from '@angular/common';
@Component({
  selector: 'app-progress-card',
  templateUrl: './progress-card.component.html',
  styleUrls: ['./progress-card.component.scss'],
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    DatePipe
  ],
  animations: [
    trigger('collapseContent', [
      state('open', style({ height: '*', opacity: 1, padding: '*', margin: '*' })),
      state('closed', style({ height: '0px', opacity: 0, padding: '0px', margin: '0px' })),
      transition('open <=> closed', [
        animate('250ms cubic-bezier(0.4,0.0,0.2,1)')
      ]),
    ])
  ]
})
export class ProgressCardComponent {

  @Input() progress = 0;
  readonly radius = 20;
  readonly circumference = 2 * Math.PI * this.radius;
  @Input() week = 1;
  @Input() totalWeeks = 2;

  @Input() completedRoutines = 1;
  @Input() totalRoutines = 2;
  @Input() exercises = 1;
  @Input() days = 1;
  @Input() planName = "" ;
  @Input() startDate = "";
  @Input() focus = "";
  @Input() intensity = "";
  @Input() notes="";

  @Output() continue = new EventEmitter<void>();
    isCollapsed = false;
  onContinue() {
    this.continue.emit();
  }

  // Calcula el color del progreso según el porcentaje
  getProgressColor(): string {
    // Verde (#22c55e) para >=80, Amarillo (#facc15) para >=50, Rojo (#f87171) para menos
    if (this.progress >= 80) return '#22c55e'; // verde
    if (this.progress >= 50) return '#a58504'; // amarillo
    return '#f87171'; // rojo
  }

  // Devuelve el id de gradiente SVG según el progreso
  getProgressGradientId(): string {
    console.log('Calculando gradiente para progreso:', this.progress);
    if (this.progress >= 80) return 'progress-gradient-green';
    if (this.progress >= 60) return 'progress-gradient-blue';
    if (this.progress >= 30) return 'progress-gradient-yellow';
    if (this.progress >= 10) return 'progress-gradient-red';
    return 'progress-gradient-red';
  }

  // Calcula el dashoffset para el círculo de progreso
  getProgressDashOffset(): number {
    return this.circumference * (1 - this.progress / 100);
  }
   

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }
}
