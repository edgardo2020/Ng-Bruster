import { CommonModule, DatePipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  Input,
  QueryList,
  ViewChildren,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, startWith, take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  AssignmentDetail,
  AssignmentDetailExercise,
} from '../../../assignments/data-access/assignments-api.service';
import { Routine, RoutineExercise } from '../../../../core/models/gym.models';
import { ToastrService } from 'ngx-toastr';
import { RoutinesApiService } from '../../../routines/data-access/routines-api.service';
import { RoutinesStore } from '../../../routines/data-access/routines.store';
import { ProgressCardComponent } from '../progress-card/progress-card.component';

@Component({
  selector: 'app-my-training-plan',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatTabsModule,
    MatTooltipModule,
    ProgressCardComponent
  ],
  templateUrl: './my-training-plan.component.html',
  styleUrls: ['./my-training-plan.component.scss'],
})
export class MyTrainingPlanComponent {
  // Estado para expandir/comprimir cards de rutina finalizada
  public readonly collapsedCards = signal<Record<string, boolean>>({});

  readonly previewExercise = signal<AssignmentDetailExercise | null>(null);
  readonly descriptionDialog = signal<AssignmentDetailExercise | null>(null);

  openDescriptionDialog(exercise: AssignmentDetailExercise): void {
    this.descriptionDialog.set(exercise);
  }

  closeDescriptionDialog(): void {
    this.descriptionDialog.set(null);
  }

  showImagePreview(exercise: AssignmentDetailExercise): void {
    this.previewExercise.set(exercise);
  }

  closeImagePreview(): void {
    this.previewExercise.set(null);
  }

  // Devuelve true si todos los ejercicios de la agenda están finalizados
  public isAgendaItemFinished(item: { exercises: AssignmentDetailExercise[] }): boolean {
    return (item.exercises ?? []).length > 0 && (item.exercises ?? []).every(ex => !!ex.isFinished);
  }



  /** Comparte el avance con imagen de marca para redes + texto. */
  public async shareProgress(): Promise<void> {
    const detail = this.latestDetail;
    if (!detail) {
      this.toastr.info('No hay avance para compartir.');
      return;
    }
    const progress = this.getPlanProgress(detail);
    const total = this.getAgendaWithExercises(detail).length || 0;
    const week = this.getCurrentWeek(detail);
    const totalWeeks = this.getEffectiveWeeks(detail);
    const url = window.location.href;
    const focus = detail.focus || 'General';
    const message =
      progress >= 100 ? '¡Plan completado! 🏆' :
      progress >= 70 ? '¡Ya casi lo logro! 🔥' :
      progress >= 30 ? '¡Buen ritmo, sin parar! 💪' : '¡Recién empiezo, acompáñame! 🚀';
    const text =
      `💪 Llevo ${progress}% de mi plan "${detail.planName || 'de entrenamiento'}" ` +
      `(semana ${week}/${totalWeeks}, foco ${focus}, ` +
      `${this.generalStats.completedRoutines}/${total} rutinas, ` +
      `${this.generalStats.completedExercises} ejercicios, ` +
      `${this.generalStats.trainingDays} días) en NUVYRA 🏋️ ${message} ¡Únete!`;
    const nav = navigator as Navigator & {
      share?: (d: ShareData) => Promise<void>;
      canShare?: (d: ShareData) => boolean;
    };

    // 1. Generar imagen promocional con canvas
    let file: File | null = null;
    try {
      const blob = await this.buildShareImage(
        detail.planName || 'Mi plan',
        progress,
        this.generalStats.completedRoutines,
        total,
        this.generalStats.completedExercises,
        this.generalStats.trainingDays,
        focus,
        week,
        totalWeeks,
        message,
      );
      file = new File([blob], 'mi-avance-nuvyra.png', { type: 'image/png' });
    } catch { file = null; }

    // 2. Web Share con archivos (ideal para Instagram / WhatsApp / X en móvil)
    try {
      if (file && nav.canShare?.({ files: [file] })) {
        await nav.share?.({ title: 'Mi avance en NUVYRA', text, url, files: [file] });
        return;
      }
      if (nav.share && !file) {
        await nav.share({ title: 'Mi avance', text, url });
        return;
      }
      throw new Error('no-share');
    } catch {
      // 3. Fallback desktop: descargar imagen + copiar texto + abrir WhatsApp
      if (file) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      const fullText = `${text} ${url}`;
      try {
        await navigator.clipboard.writeText(fullText);
      } catch { /* sin portapapeles */ }
      const encoded = encodeURIComponent(fullText);
      window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener');
      this.toastr.success('Imagen descargada y texto copiado. ¡Compártelos en tus redes!');
    }
  }

  /** Genera PNG usando share-template.png de fondo + overlay con stats. */
  private buildShareImage(
    planName: string, progress: number, routines: number, totalRoutines: number,
    exercises: number, days: number, focus: string, week: number, totalWeeks: number,
    message: string,
  ): Promise<Blob> {
    const loadTemplate = (): Promise<HTMLImageElement | null> => {
      const urls = ['assets/share-template.png', 'share-template.png', '/share-template.png'];
      const tryUrl = (i: number): Promise<HTMLImageElement | null> => {
        if (i >= urls.length) return Promise.resolve(null);
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => void tryUrl(i + 1).then(resolve);
          img.src = urls[i];
        });
      };
      return tryUrl(0);
    };

    return loadTemplate().then((img) => new Promise<Blob>((resolve, reject) => {
      const W = 1080;
      const H = img ? Math.round(W * img.naturalHeight / img.naturalWidth) : 1080;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no-canvas')); return; }

      if (img) {
        // Fondo foto en cover
        ctx.drawImage(img, 0, 0, W, H);
      } else {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0d1526');
        bg.addColorStop(1, '#070c18');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
      }
      // Overlay oscuro para legibilidad (más arriba, menos abajo)
      const ov = ctx.createLinearGradient(0, 0, 0, H);
      ov.addColorStop(0, 'rgba(4,7,14,0.82)');
      ov.addColorStop(0.55, 'rgba(4,7,14,0.55)');
      ov.addColorStop(1, 'rgba(4,7,14,0.88)');
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, W, H);

      // Franja hazard amarilla arriba
      ctx.fillStyle = '#ffd400';
      for (let x = -40; x < W + 40; x += 48) {
        ctx.save();
        ctx.translate(x, 0);
        ctx.rotate(-Math.PI / 4);
        ctx.fillRect(0, -60, 24, 120);
        ctx.restore();
      }

      const cx = W / 2;
      const u = H / 1080; // escala según alto del template
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd400';
      ctx.font = `800 ${Math.round(46 * u)}px system-ui, sans-serif`;
      ctx.fillText('NUVYRA', cx, 165 * u);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `600 ${Math.round(25 * u)}px system-ui, sans-serif`;
      ctx.fillText('MI AVANCE DE ENTRENAMIENTO', cx, 208 * u);

      // Badge semana + foco
      ctx.font = `700 ${Math.round(24 * u)}px system-ui, sans-serif`;
      const badge = `SEMANA ${week} DE ${totalWeeks}  •  FOCO ${focus.toUpperCase().slice(0, 18)}`;
      const bw = ctx.measureText(badge).width + 48 * u;
      const bx = cx - bw / 2, by = 232 * u, bh = 48 * u;
      ctx.fillStyle = 'rgba(255,212,0,0.16)';
      ctx.strokeStyle = 'rgba(255,212,0,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffe44d';
      ctx.fillText(badge, cx, by + 32 * u);

      // Anillo de progreso
      const cy = 490 * u, r = 160 * u;
      ctx.lineWidth = 36 * u;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffd400';
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (progress / 100));
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${Math.round(92 * u)}px system-ui, sans-serif`;
      ctx.fillText(`${progress}%`, cx, cy + 32 * u);

      // Plan + stats
      ctx.fillStyle = '#eef2ff';
      ctx.font = `700 ${Math.round(36 * u)}px system-ui, sans-serif`;
      ctx.fillText(planName.slice(0, 32), cx, 770 * u);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `600 ${Math.round(30 * u)}px system-ui, sans-serif`;
      ctx.fillText(`${routines}/${totalRoutines} rutinas  •  ${exercises} ejercicios  •  ${days} dias`, cx, 820 * u);
      // Mensaje motivacional según progreso
      ctx.fillStyle = '#ffe44d';
      ctx.font = `700 ${Math.round(28 * u)}px system-ui, sans-serif`;
      ctx.fillText(message.slice(0, 44), cx, 866 * u);

      // CTA
      const btnW = 520 * u, btnH = 76 * u, btnX = (W - btnW) / 2, btnY = H - 160 * u;
      ctx.fillStyle = '#ffd400';
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 12);
      ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      ctx.font = `800 ${Math.round(31 * u)}px system-ui, sans-serif`;
      ctx.fillText('ENTRENA EN NUVYRA', cx, btnY + 50 * u);

      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('blob-fail')), 'image/png');
    }));
  }

  public irARutina() {    const detail = this.latestDetail;
    if (detail) this.jumpToFirstUnfinished(detail);
    // Esperar al re-render de las tabs antes de buscar el elemento
    setTimeout(() => {
      const renderedItems = this.exerciseItems?.toArray() ?? [];
    console.log('Ejercicios renderizados:', renderedItems.length);
    if (!renderedItems.length) {
      this.toastr.info('No hay ejercicios para mostrar.');
      return;
    }
    // Buscar el primer ejercicio que NO esté finalizado
    const firstUnfinishedItem = renderedItems.find(
      (item) => item.nativeElement.dataset['finished'] !== 'true'
    );
    if (firstUnfinishedItem) {
      firstUnfinishedItem.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }
    this.toastr.info('¡Ya completaste todos los ejercicios!');
    }, 50);
  }

  // Alterna el estado de comprimido/expandido para una card
  public toggleCardCollapse(routineId: any): void {
    const prev = this.collapsedCards();
    const current = prev[routineId];
    // Si es undefined (primer clic), lo consideramos colapsado y lo expandimos
    this.collapsedCards.set({ ...prev, [routineId]: current === undefined ? false : !current });
  }
  private readonly routinesApiService = inject(RoutinesApiService);
  readonly store = inject(RoutinesStore);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);
  private hasAutoScrolledToFinished = false;

  @ViewChildren('exerciseItem') private readonly exerciseItems?: QueryList<
    ElementRef<HTMLElement>
  >;

  private readonly detailsState = signal<AssignmentDetail[]>([]);
  public readonly routinesState = signal<Routine[]>([]);
  readonly updatingExerciseKeys = signal<string[]>([]);
  readonly dasharray = 2 * Math.PI * 18;
  
  //[attr.stroke-dashoffset]="(2 * Math.PI * 18) * (1 - (generalStats?.completedRoutines / (totalRoutines || 1)))"// Circunferencia de un círculo con radio 18 (para el gráfico de progreso)
  readonly dashoffset = (1 - (this.generalStats?.completedRoutines / (10))) * this.dasharray;
  @Input({ required: true })
  set details(value: AssignmentDetail[]) {
    const nextDetails = this.cloneDetails(value ?? []);
    this.detailsState.set(nextDetails);
    this.hasAutoScrolledToFinished = false;

    // Posicionar las tabs (semana/día) en el primer ejercicio sin finalizar
    const latest = [...nextDetails].sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    )[0];
    if (latest) this.jumpToFirstUnfinished(latest);

    const userId = nextDetails[0]?.userId;
    if (!userId) {
      this.routinesState.set([]);
      return;
    }

    this.routinesApiService
      .getByUser(userId)
      .pipe(take(1))
      .subscribe((routines) =>
        this.routinesState.set(
          Array.isArray(routines)
            ? routines.map((routine) => ({ ...routine }))
            : [],
        ),
      );

    // Verificar si el plan está completado
    setTimeout(() => this.checkIfPlanCompleted(), 0);
  }

  get details(): AssignmentDetail[] {
    return this.detailsState();
  }

  /** Busca el primer ejercicio sin finalizar y selecciona su semana/día. */
  private jumpToFirstUnfinished(detail: AssignmentDetail): void {
    const agenda = this.getAgendaWithExercises(detail);
    if (!agenda.length) return;

    const firstPending = [...agenda]
      .sort((a, b) => Number(a.week ?? 0) - Number(b.week ?? 0))
      .find((item) => (item.exercises ?? []).some((ex) => !ex.isFinished));
    if (!firstPending) return;

    const week = Number(firstPending.week);
    if (Number.isFinite(week)) this.selectedWeek.set(week);
    const day = firstPending.day?.trim();
    if (day) {
      // Asegurar que el día se resuelva dentro de la semana recién seleccionada
      const prevWeek = this.selectedWeek();
      void prevWeek;
      this.selectedDay.set(day);
    }
  }

  private readonly defaultsByIntensity: Record<
    string,
    { sets: number; reps: number; weight: number }
  > = {
    Baja: { sets: 3, reps: 12, weight: 15 },
    Media: { sets: 3, reps: 10, weight: 20 },
    Alta: { sets: 4, reps: 8, weight: 25 },
  };

  ngAfterViewInit(): void {
    this.exerciseItems?.changes
      .pipe(startWith(this.exerciseItems), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.scrollToLastFinishedExercise());
  }

  get latestDetail(): AssignmentDetail | null {
    if (!this.detailsState().length) {
      return null;
    }

    return (
      [...this.detailsState()].sort(
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      )[0] ?? null
    );
  }

  getAgendaLabel(week?: number, day?: string): string {
    //const resolvedWeek = Number.isFinite(Number(week)) ? Number(week) : 1;
    const resolvedDay = day?.trim() || 'Dia programado';
    return `${resolvedDay}`;
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

  getAssignedSets(
    exercise: AssignmentDetailExercise,
    intensity?: string,
  ): number {
    console.log('Exercise:', exercise);
    console.log('Intensity:', intensity);
    return exercise.assignedSets ?? this.getDefaults(intensity).sets;
  }

  getAssignedReps(
    exercise: AssignmentDetailExercise,
    intensity?: string,
  ): number {
    return exercise.assignedReps ?? this.getDefaults(intensity).reps;
  }

  getAssignedWeight(
    exercise: AssignmentDetailExercise,
    intensity?: string,
  ): number {
    return exercise.assignedWeight ?? this.getDefaults(intensity).weight;
  }

  getAgendaWithExercises(detail: AssignmentDetail) {
    return (detail.agenda ?? []).filter(
      (item) => (item.exercises?.length ?? 0) > 0,
    );
  }

  readonly selectedWeek = signal<number | null>(null);

  getAvailableWeeks(detail: AssignmentDetail): number[] {
    const weeks = this.getAgendaWithExercises(detail)
      .map((item) => Number(item.week))
      .filter((w) => Number.isFinite(w));
    return [...new Set(weeks)].sort((a, b) => a - b);
  }

  getResolvedWeek(detail: AssignmentDetail): number {
    const weeks = this.getAvailableWeeks(detail);
    if (!weeks.length) return 1;
    const sel = this.selectedWeek();
    if (sel != null && weeks.includes(sel)) return sel;
    const current = this.getCurrentWeek(detail);
    return weeks.includes(current) ? current : weeks[0];
  }

  selectWeek(week: number): void {
    this.selectedWeek.set(week);
    this.selectedDay.set(null);
    this.hasAutoScrolledToFinished = false;
  }

  readonly selectedDay = signal<string | null>(null);

  getAvailableDays(detail: AssignmentDetail): string[] {
    return this.getAgendaForWeek(detail).map((item) => item.day?.trim() || 'Día programado');
  }

  getResolvedDay(detail: AssignmentDetail): string {
    const days = this.getAvailableDays(detail);
    if (!days.length) return '';
    const sel = this.selectedDay();
    if (sel != null && days.includes(sel)) return sel;
    return days[0];
  }

  getDayIndex(detail: AssignmentDetail): number {
    const idx = this.getAvailableDays(detail).indexOf(this.getResolvedDay(detail));
    return idx >= 0 ? idx : 0;
  }

  onDayTabChange(detail: AssignmentDetail, index: number): void {
    const days = this.getAvailableDays(detail);
    if (days[index] != null) {
      this.selectedDay.set(days[index]);
      this.hasAutoScrolledToFinished = false;
    }
  }

  stepDay(detail: AssignmentDetail, delta: 1 | -1): void {
    const days = this.getAvailableDays(detail);
    const next = this.getDayIndex(detail) + delta;
    if (next >= 0 && next < days.length) {
      this.selectedDay.set(days[next]);
      this.hasAutoScrolledToFinished = false;
    }
  }

  getAgendaForDay(detail: AssignmentDetail) {
    const day = this.getResolvedDay(detail);
    return this.getAgendaForWeek(detail).filter(
      (item) => (item.day?.trim() || 'Día programado') === day,
    );
  }

  getDayShort(day: string): string {
    const clean = (day || '').trim();
    if (!clean) return '·';
    return clean.charAt(0).toUpperCase();
  }

  getAgendaForWeek(detail: AssignmentDetail) {
    const week = this.getResolvedWeek(detail);
    return this.getAgendaWithExercises(detail).filter((item) => Number(item.week) === week);
  }

  getWeekIndex(detail: AssignmentDetail): number {
    const weeks = this.getAvailableWeeks(detail);
    const idx = weeks.indexOf(this.getResolvedWeek(detail));
    return idx >= 0 ? idx : 0;
  }

  onWeekTabChange(detail: AssignmentDetail, index: number): void {
    const weeks = this.getAvailableWeeks(detail);
    if (weeks[index] != null) this.selectWeek(weeks[index]);
  }

  stepWeek(detail: AssignmentDetail, delta: 1 | -1): void {
    const weeks = this.getAvailableWeeks(detail);
    const next = this.getWeekIndex(detail) + delta;
    if (next >= 0 && next < weeks.length) this.selectWeek(weeks[next]);
  }

  isExerciseFinished(exercise: AssignmentDetailExercise): boolean {
    return Boolean(exercise.isFinished);
  }

  isUpdatingExercise(exerciseKey: string): boolean {
    return this.updatingExerciseKeys().includes(exerciseKey);
  }

  markExerciseFinished(routine: any, exercise: any): void {
    // 1. Actualizar la vista localmente (AssignmentDetail.agenda)
    const details = this.detailsState();
    let updated = false;
    const updatedDetails = details.map((detail) => {
      let agendaChanged = false;
      const newAgenda = (detail.agenda ?? []).map((item) => {
        if (item.routineId === routine.routineId && (item.exercises ?? []).some((ex) => ex.id === exercise.id)) {
          const newExercises = (item.exercises ?? []).map((ex) =>
            ex.id === exercise.id ? { ...ex, isFinished: true } : ex
          );
          agendaChanged = true;
          return { ...item, exercises: newExercises };
        }
        return item;
      });
      if (agendaChanged) updated = true;
      return agendaChanged ? { ...detail, agenda: newAgenda } : detail;
    });
    if (updated) {
      this.detailsState.set(updatedDetails);
      this.toastr.success('Ejercicio marcado como finalizado.');
      // Verificar si el plan está completado tras marcar ejercicio
      setTimeout(() => this.checkIfPlanCompleted(), 0);
    }

    // 2. Actualizar la rutina en backend
    const detail = updatedDetails.find((d) =>
      (d.agenda ?? []).some(
        (item) =>
          item.routineId === routine.routineId &&
          (item.exercises ?? []).some((ex) => ex.id === exercise.id),
      ),
    );
    const agendaItem = (detail?.agenda ?? []).find(
      (item) =>
        item.routineId === routine.routineId &&
        (item.exercises ?? []).some((ex) => ex.id === exercise.id),
    );

    var listaEjercicios: RoutineExercise[] = [];
    agendaItem?.exercises?.forEach((ex: any) => {
      var ejercicio: RoutineExercise = {
        id: ex.id,
        exerciseId: ex.id,
        exerciseName: ex.name,
        exerciseDescription: ex.description,
        sets: ex.assignedSets ?? 3,
        reps: ex.assignedReps ?? 10,
        weight: ex.assignedWeight ?? 0,
        isFinished: ex.id === exercise.id ? true : !!ex.isFinished
      };
      listaEjercicios.push(ejercicio);
    });

    const routinePayload: Routine = {
      id: agendaItem?.routineId?.toString() ?? '0',
      name: '-',
      description: '-',
      isCustomized: false,
      planId: '0',
      week: agendaItem?.week ?? 0,
      day: agendaItem?.day ?? '',
      exercises: listaEjercicios,
    };

    const request$: Observable<Routine> =
      this.routinesApiService.update(routinePayload);
    request$.pipe(take(1)).subscribe({
      next: (result) => {
        // Actualización exitosa en backend
      },
      error: () =>
        this.toastr.error(
          `No se pudo sincronizar la rutina del semana `,
        ),
    });
  }


  private updateRoutineExercise(
    detail: AssignmentDetail,
    currentRoutine: Routine,
    week: number | undefined,
    day: string,
    exerciseId: string,
    exerciseKey: string,
  ): void {
    const hasMatchingExercise = currentRoutine.exercises.some(
      (exercise) => String(exercise.id) === String(exerciseId),
    );

    if (!hasMatchingExercise) {
      this.toastr.error(
        'No se encontró el ejercicio dentro de la rutina asociada.',
      );
      this.removeUpdatingExerciseKey(exerciseKey);
      return;
    }

    // Actualizar el campo isFinished en el nivel de routineExercises
    const updatedRoutine: Routine = {
      ...currentRoutine,
      exercises: currentRoutine.exercises.map((exercise) =>
        String(exercise.id) === String(exerciseId)
          ? { ...exercise, isFinished: true }
          : exercise,
      ),
    };

    // No es necesario modificar AssignmentDetail.agenda.exercises para isFinished

    this.routinesApiService
      .update(updatedRoutine)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          const nextRoutine: Routine = {
            ...updatedRoutine,
            ...response,
            exercises: response?.exercises?.length
              ? response.exercises
              : updatedRoutine.exercises,
          };

          this.routinesState.update((routines) =>
            routines.map((routine) =>
              routine.id === currentRoutine.id ? { ...nextRoutine } : routine,
            ),
          );

          this.hasAutoScrolledToFinished = false;
          this.toastr.success(
            'Ejercicio marcado como finalizado.',
          );
          this.removeUpdatingExerciseKey(exerciseKey);
        },
        error: () => {
          this.toastr.error(
            'No se pudo actualizar la rutina del ejercicio.',
          );
          this.removeUpdatingExerciseKey(exerciseKey);
        },
      });
  }

  private getDefaults(intensity?: string): {
    sets: number;
    reps: number;
    weight: number;
  } {
    return (
      this.defaultsByIntensity[intensity ?? ''] ??
      this.defaultsByIntensity['Media']
    );
  }

  private buildUpdatedDetail(
    detail: AssignmentDetail,
    week: number | undefined,
    day: string,
    exerciseId: string,
  ): AssignmentDetail {
    return {
      ...detail,
      agenda: (detail.agenda ?? []).map((item) => ({
        ...item,
        exercises: (item.exercises ?? []).map((exercise) => {
          const isTargetExercise =
            Number(item.week) === Number(week) &&
            item.day === day &&
            exercise.id === exerciseId;
          return isTargetExercise
            ? { ...exercise, isFinished: true }
            : exercise;
        }),
      })),
    };
  }

  private scrollToLastFinishedExercise(): void {
    if (this.hasAutoScrolledToFinished) {
      return;
    }

    const renderedItems = this.exerciseItems?.toArray() ?? [];
    if (!renderedItems.length) {
      return;
    }

    // Buscar el primer ejercicio que NO esté finalizado
    const firstUnfinishedItem = renderedItems.find(
      (item) => item.nativeElement.dataset['finished'] !== 'true'
    );

    this.hasAutoScrolledToFinished = true;

    firstUnfinishedItem?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  private getExerciseKey(
    detailId: number,
    week: number | undefined,
    day: string,
    exerciseId: string,
  ): string {
    return `${detailId}-${week ?? 0}-${day}-${exerciseId}`;
  }

  private removeUpdatingExerciseKey(exerciseKey: string): void {
    this.updatingExerciseKeys.update((keys) =>
      keys.filter((key) => key !== exerciseKey),
    );
  }

  private cloneDetails(details: AssignmentDetail[]): AssignmentDetail[] {
    return details.map((detail) => this.cloneDetail(detail));
  }

  private cloneDetail(detail: AssignmentDetail): AssignmentDetail {
    return {
      ...detail,
      agenda: (detail.agenda ?? []).map((item) => ({
        ...item,
        exercises: (item.exercises ?? []).map((exercise) => ({ ...exercise })),
      })),
    };
  }

      /**
     * Estadísticas generales calculadas para el resumen
     */
    public get generalStats() {
      const detail = this.latestDetail;
      if (!detail) {
        return {
          completedRoutines: 0,
          completedExercises: 0,
          trainingDays: 0,
        };
      }

      // Rutinas completadas: agenda con todos los ejercicios finalizados
      const agenda = (detail.agenda ?? []).filter(item => (item.exercises?.length ?? 0) > 0);
      const completedRoutines = agenda.filter(item => (item.exercises ?? []).every(ex => !!ex.isFinished)).length;

      // Ejercicios completados: suma de todos los ejercicios finalizados
      const completedExercises = agenda.reduce((acc, item) => acc + (item.exercises?.filter(ex => !!ex.isFinished).length ?? 0), 0);

      // Días entrenados: cantidad de días únicos con al menos un ejercicio finalizado
      const daysSet = new Set(
        agenda
          .filter(item => (item.exercises ?? []).some(ex => !!ex.isFinished))
          .map(item => `${item.week ?? ''}-${item.day ?? ''}`)
      );
      const trainingDays = daysSet.size;

      return {
        completedRoutines,
        completedExercises,
        trainingDays,
      };
    }

      // Estado para mostrar el splash de felicitación
  public showCongratsSplash = signal(false);

  /**
   * Detecta si el usuario ha completado todas las rutinas y muestra el splash
   * solo una vez (lo persiste en localStorage por plan).
   */
  private checkIfPlanCompleted() {
    const detail = this.latestDetail;
    if (!detail) return;

    const SPLASH_KEY = `splash_shown_${detail.id}`;
    const agenda = this.getAgendaWithExercises(detail);
    const total = agenda.length;
    const finished = agenda.filter(item => (item.exercises ?? []).every(ex => !!ex.isFinished)).length;
    const isComplete = total > 0 && finished === total;

    if (!isComplete) {
      localStorage.removeItem(SPLASH_KEY);
      return;
    }

    if (localStorage.getItem(SPLASH_KEY)) return;

    this.showCongratsSplash.set(true);
    localStorage.setItem(SPLASH_KEY, '1');
    setTimeout(() => this.showCongratsSplash.set(false), 5000);
  }

    /**
   * Calcula la semana actual del plan según la fecha de inicio y la fecha actual
   */
  getCurrentWeek(detail: AssignmentDetail): number {
    if (!detail?.startDate) return 1;
    const start = new Date(detail.startDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.min(this.getEffectiveWeeks(detail), Math.floor(diff / 7) + 1));
  }

    /**
   * Calcula el porcentaje de progreso del plan
   */
  getPlanProgress(detail: AssignmentDetail | null): number {
    if (!detail) return 0;
    const total = this.getAgendaWithExercises(detail)?.length || 1;
    return Math.round((this.generalStats.completedRoutines / total) * 100);
  }
}
