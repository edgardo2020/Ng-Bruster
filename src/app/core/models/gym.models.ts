import { UserRole } from './auth.models';

export interface ApiResponse<T> {
  exito: boolean;
  mensaje: string;
  respuesta: T | null;
}

export interface QueryParams {
  search?: string;
  idRol?: number | 'All';
  status?: string;
}

export interface ResourceState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface DashboardSummary {
  activeUsers: number;
  monthlyRevenue: number;
  attendanceRate: number;
  monthlyGrowth: number;
  recentCheckins: CheckInRecord[];
  revenueSeries: ChartPoint[];
  attendanceSeries: ChartPoint[];
}

export interface UserRecord {
  id: string;
  nombre: string;
  Correo: string;
  Telefono: string;
  usuario: string;
  password: string;
  newPassword?: string | null;
  idRol: number;
  idUbicacion?: number;
  membershipStatus: MembershipStatus;
  active: boolean;
  ultimoAcceso?: string;
  visible?: boolean;
  idEmpresa?: number;
  expiredTime?: string;
  joinedAt: string;
}

export type MembershipStatus = 'Active' | 'Expired' | 'Cancelled';

export interface Membership {
  id: string;
  name: string;
  price: number;
  durationInDays: number;
  status: MembershipStatus;
  benefits: string[];
}

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Arms'
  | 'Legs'
  | 'Core'
  | 'FullBody'
  | 'Cardio';

export interface ExerciseCatalogItem {
  id: string;
  name: string;
  description: string;
  muscleGroup: MuscleGroup;
  muscleGroupCatalogId?: number;
  muscleGroupCatalog?: MuscleGroupCatalogItem;
  ImageBase64?: string;
}

export interface MuscleGroupCatalogItem {
  id: number;
  description: string;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseDescription?: string;
  isFinished?: boolean;
  sets: number;
  reps: number;
  weight: number;
  ImageBase64?: string;
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  EntrenadorId?: string;
  isCustomized?: boolean;
  planId?: string;
  week?: number;
  day?: string;
  exercises: RoutineExercise[];
}

export interface TrainingPlanScheduleItem {
  id: string;
  week: number;
  day: string;
  routineId: string;
  routineName: string;
}

export interface TrainingPlan {
  id: string;
  EntrenadorId?: string;
  name: string;
  durationWeeks: number;
  objective: string;
  schedule: TrainingPlanScheduleItem[];
}

export interface UserPlanAssignment {
  id: number;
  userId: string;
  userName: string;
  planId: string;
  planName: string;
  startDate: string;
  isCustomized?: boolean;
}

export type NewUserPlanAssignment = Omit<UserPlanAssignment, 'id'>;

export interface CheckInRecord {
  id: string;
  userName: string;
  membershipName: string;
  checkInAt: string;
  channel: 'Manual' | 'QR';
}

export interface ReportSnapshot {
  attendanceByDay: ChartPoint[];
  revenueByMonth: ChartPoint[];
  activeMemberships: ChartPoint[];
}

export interface UserPhysicalProfile {
  id?: string;
  userId: string;
  pesoInicio: number;
  pesoObjetivo: number;
  fechaInicio: string;
  altura: number;
  pesoIdeal: number;
  imc: number;
  comentario?: string;
}

export interface UserWeightRecord {
  id?: string;
  userId: string;
  fecha: string | Date;
  peso: number;
  comentario?: string;
}

export interface FoodCatalogItem {
  id: number;
  name: string;
  category: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  active?: boolean;
}

//export type MealType = 'Desayuno' | 'Media manana' | 'Almuerzo' | 'Merienda' | 'Cena' | 'Snack';

export type Meals = {
  id?:  number;
  nombre?: string ;
  idEmpresa?: number;
};


export interface UserNutritionPlanMealItem {
  id: string;
  mealType: string;
  foodId: number;
  foodName: string;
  quantity: number;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  notes?: string;
  completed?: boolean;
}

export interface UserNutritionPlan {
  id: string;
  userId: string;
  name: string;
  objective: string;
  startDate: string;
  endDate?: string;
  targetCalories: number;
  notes?: string;
  items: UserNutritionPlanMealItem[];
}