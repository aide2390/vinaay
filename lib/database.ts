import { supabase } from './supabase';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  role: 'client' | 'trainer' | 'nutritionist' | 'admin' | 'hr';
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSession {
  id: string;
  client_id: string;
  trainer_id?: string;
  template_id?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  exercises: any[];
  notes?: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailyStats {
  id: string;
  user_id: string;
  date: string;
  steps: number;
  water_intake_ml: number;
  calories_consumed: number;
  calories_burned: number;
  weight_kg?: number;
  sleep_hours?: number;
  mood_rating?: number;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  emoji: string;
  target_date?: string;
  progress_percentage: number;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientAssignment {
  id: string;
  client_id: string;
  trainer_id?: string;
  nutritionist_id?: string;
  assigned_date: string;
  assigned_by?: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface Consultation {
  id: string;
  client_id: string;
  nutritionist_id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  type: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingSession {
  id: string;
  client_id: string;
  trainer_id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  type: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  location?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// New interfaces for exercises and templates
export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscle_groups: string[];
  instructions?: string;
  equipment?: string;
  created_by?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  estimated_duration_minutes: number;
  created_by: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  exercises?: TemplateExercise[];
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  order_index: number;
  sets_config: any[];
  notes?: string;
  exercise?: Exercise;
}

// Profile functions
export const getCurrentUserProfile = async (): Promise<Profile | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getCurrentUserProfile:', error);
    return null;
  }
};

export const createOrUpdateProfile = async (profileData: Partial<Profile>): Promise<Profile | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        email: user.email,
        ...profileData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createOrUpdateProfile:', error);
    return null;
  }
};

// Exercise CRUD functions
export const getExercises = async (): Promise<Exercise[]> => {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile) return [];

    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .or(`is_public.eq.true,created_by.eq.${profile.id}`)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching exercises:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getExercises:', error);
    return [];
  }
};

export const createExercise = async (exerciseData: {
  name: string;
  category: string;
  muscle_groups: string[];
  instructions?: string;
  equipment?: string;
  is_public?: boolean;
}): Promise<Exercise | null> => {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile) return null;

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        ...exerciseData,
        created_by: profile.id,
        is_public: exerciseData.is_public || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating exercise:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createExercise:', error);
    return null;
  }
};

export const updateExercise = async (id: string, exerciseData: Partial<Exercise>): Promise<Exercise | null> => {
  try {
    const { data, error } = await supabase
      .from('exercises')
      .update({
        ...exerciseData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating exercise:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateExercise:', error);
    return null;
  }
};

export const deleteExercise = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('exercises')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting exercise:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteExercise:', error);
    return false;
  }
};

// Workout Template CRUD functions
export const getWorkoutTemplates = async (): Promise<WorkoutTemplate[]> => {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile) return [];

    const { data, error } = await supabase
      .from('workout_templates')
      .select(`
        *,
        template_exercises (
          id,
          exercise_id,
          order_index,
          sets_config,
          notes,
          exercises (*)
        )
      `)
      .or(`is_public.eq.true,created_by.eq.${profile.id}`)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching workout templates:', error);
      return [];
    }

    // Transform the data to match our interface
    const templates = data?.map(template => ({
      ...template,
      exercises: template.template_exercises?.map((te: any) => ({
        id: te.id,
        template_id: template.id,
        exercise_id: te.exercise_id,
        order_index: te.order_index,
        sets_config: te.sets_config,
        notes: te.notes,
        exercise: te.exercises,
      })) || [],
    })) || [];

    return templates;
  } catch (error) {
    console.error('Error in getWorkoutTemplates:', error);
    return [];
  }
};

export const getWorkoutTemplate = async (id: string): Promise<WorkoutTemplate | null> => {
  try {
    const { data, error } = await supabase
      .from('workout_templates')
      .select(`
        *,
        template_exercises (
          id,
          exercise_id,
          order_index,
          sets_config,
          notes,
          exercises (*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching workout template:', error);
      return null;
    }

    // Transform the data to match our interface
    const template = {
      ...data,
      exercises: data.template_exercises?.map((te: any) => ({
        id: te.id,
        template_id: data.id,
        exercise_id: te.exercise_id,
        order_index: te.order_index,
        sets_config: te.sets_config,
        notes: te.notes,
        exercise: te.exercises,
      })) || [],
    };

    return template;
  } catch (error) {
    console.error('Error in getWorkoutTemplate:', error);
    return null;
  }
};

export const createWorkoutTemplate = async (templateData: {
  name: string;
  description?: string;
  category: string;
  estimated_duration_minutes: number;
  is_public?: boolean;
  exercises: Array<{
    exercise_id: string;
    order_index: number;
    sets_config: any[];
    notes?: string;
  }>;
}): Promise<WorkoutTemplate | null> => {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile) return null;

    // Start a transaction
    const { data: template, error: templateError } = await supabase
      .from('workout_templates')
      .insert({
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        estimated_duration_minutes: templateData.estimated_duration_minutes,
        created_by: profile.id,
        is_public: templateData.is_public || false,
      })
      .select()
      .single();

    if (templateError) {
      console.error('Error creating workout template:', templateError);
      return null;
    }

    // Insert template exercises
    if (templateData.exercises.length > 0) {
      const templateExercises = templateData.exercises.map(exercise => ({
        template_id: template.id,
        exercise_id: exercise.exercise_id,
        order_index: exercise.order_index,
        sets_config: exercise.sets_config,
        notes: exercise.notes,
      }));

      const { error: exercisesError } = await supabase
        .from('template_exercises')
        .insert(templateExercises);

      if (exercisesError) {
        console.error('Error creating template exercises:', exercisesError);
        // Clean up the template if exercises failed
        await supabase.from('workout_templates').delete().eq('id', template.id);
        return null;
      }
    }

    // Return the complete template with exercises
    return await getWorkoutTemplate(template.id);
  } catch (error) {
    console.error('Error in createWorkoutTemplate:', error);
    return null;
  }
};

export const updateWorkoutTemplate = async (
  id: string,
  templateData: {
    name?: string;
    description?: string;
    category?: string;
    estimated_duration_minutes?: number;
    is_public?: boolean;
    exercises?: Array<{
      exercise_id: string;
      order_index: number;
      sets_config: any[];
      notes?: string;
    }>;
  }
): Promise<WorkoutTemplate | null> => {
  try {
    // Update the template
    const { error: templateError } = await supabase
      .from('workout_templates')
      .update({
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        estimated_duration_minutes: templateData.estimated_duration_minutes,
        is_public: templateData.is_public,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (templateError) {
      console.error('Error updating workout template:', templateError);
      return null;
    }

    // Update exercises if provided
    if (templateData.exercises) {
      // Delete existing template exercises
      await supabase
        .from('template_exercises')
        .delete()
        .eq('template_id', id);

      // Insert new template exercises
      if (templateData.exercises.length > 0) {
        const templateExercises = templateData.exercises.map(exercise => ({
          template_id: id,
          exercise_id: exercise.exercise_id,
          order_index: exercise.order_index,
          sets_config: exercise.sets_config,
          notes: exercise.notes,
        }));

        const { error: exercisesError } = await supabase
          .from('template_exercises')
          .insert(templateExercises);

        if (exercisesError) {
          console.error('Error updating template exercises:', exercisesError);
          return null;
        }
      }
    }

    // Return the updated template with exercises
    return await getWorkoutTemplate(id);
  } catch (error) {
    console.error('Error in updateWorkoutTemplate:', error);
    return null;
  }
};

export const deleteWorkoutTemplate = async (id: string): Promise<boolean> => {
  try {
    // Delete template exercises first (due to foreign key constraint)
    await supabase
      .from('template_exercises')
      .delete()
      .eq('template_id', id);

    // Delete the template
    const { error } = await supabase
      .from('workout_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting workout template:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteWorkoutTemplate:', error);
    return false;
  }
};

// Today's data functions
export const getTodayStats = async (userId: string): Promise<DailyStats | null> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('daily_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching today stats:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error in getTodayStats:', error);
    return null;
  }
};

export const updateTodayStats = async (userId: string, stats: Partial<DailyStats>): Promise<DailyStats | null> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('daily_stats')
      .upsert({
        user_id: userId,
        date: today,
        ...stats,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating today stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateTodayStats:', error);
    return null;
  }
};

// Workout sessions
export const getTodayWorkoutSessions = async (clientId: string): Promise<WorkoutSession[]> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('client_id', clientId)
      .eq('date', today)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching today workout sessions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getTodayWorkoutSessions:', error);
    return [];
  }
};

export const getTrainerTodaySessions = async (trainerId: string): Promise<TrainingSession[]> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('training_sessions')
      .select(`
        *,
        client:profiles!training_sessions_client_id_fkey(id, full_name, email)
      `)
      .eq('trainer_id', trainerId)
      .eq('scheduled_date', today)
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('Error fetching trainer today sessions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getTrainerTodaySessions:', error);
    return [];
  }
};

export const getNutritionistTodayConsultations = async (nutritionistId: string): Promise<Consultation[]> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('consultations')
      .select(`
        *,
        client:profiles!consultations_client_id_fkey(id, full_name, email)
      `)
      .eq('nutritionist_id', nutritionistId)
      .eq('scheduled_date', today)
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('Error fetching nutritionist today consultations:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getNutritionistTodayConsultations:', error);
    return [];
  }
};

// Goals
export const getActiveGoals = async (userId: string): Promise<Goal[]> => {
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active goals:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getActiveGoals:', error);
    return [];
  }
};

// Client assignments
export const getClientAssignments = async (clientId: string): Promise<ClientAssignment | null> => {
  try {
    const { data, error } = await supabase
      .from('client_assignments')
      .select(`
        *,
        trainer:profiles!client_assignments_trainer_id_fkey(id, full_name, email),
        nutritionist:profiles!client_assignments_nutritionist_id_fkey(id, full_name, email)
      `)
      .eq('client_id', clientId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching client assignments:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error in getClientAssignments:', error);
    return null;
  }
};

export const getTrainerClients = async (trainerId: string): Promise<Profile[]> => {
  try {
    const { data, error } = await supabase
      .from('client_assignments')
      .select(`
        client:profiles!client_assignments_client_id_fkey(*)
      `)
      .eq('trainer_id', trainerId)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching trainer clients:', error);
      return [];
    }

    return data?.map(item => item.client).filter(Boolean) || [];
  } catch (error) {
    console.error('Error in getTrainerClients:', error);
    return [];
  }
};

export const getNutritionistClients = async (nutritionistId: string): Promise<Profile[]> => {
  try {
    const { data, error } = await supabase
      .from('client_assignments')
      .select(`
        client:profiles!client_assignments_client_id_fkey(*)
      `)
      .eq('nutritionist_id', nutritionistId)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching nutritionist clients:', error);
      return [];
    }

    return data?.map(item => item.client).filter(Boolean) || [];
  } catch (error) {
    console.error('Error in getNutritionistClients:', error);
    return [];
  }
};

// System stats for admin
export const getSystemStats = async () => {
  try {
    const [usersResult, sessionsResult, assignmentsResult] = await Promise.all([
      supabase.from('profiles').select('role', { count: 'exact' }),
      supabase.from('workout_sessions').select('completed', { count: 'exact' }).eq('date', new Date().toISOString().split('T')[0]),
      supabase.from('client_assignments').select('status', { count: 'exact' }).eq('status', 'active')
    ]);

    const totalUsers = usersResult.count || 0;
    const todaySessions = sessionsResult.count || 0;
    const activeAssignments = assignmentsResult.count || 0;

    return {
      totalUsers,
      todaySessions,
      activeAssignments,
      systemHealth: 98.5, // Mock data
    };
  } catch (error) {
    console.error('Error fetching system stats:', error);
    return {
      totalUsers: 0,
      todaySessions: 0,
      activeAssignments: 0,
      systemHealth: 0,
    };
  }
};