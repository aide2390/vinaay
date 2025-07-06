import { supabase } from './supabase';
import { getCurrentUserProfile } from './database';

export interface WorkoutPlan {
  id: string;
  client_id: string;
  trainer_id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  schedule_type: 'weekly' | 'monthly' | 'custom';
  schedule_data: any;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface PlanSession {
  id: string;
  plan_id: string;
  template_id?: string;
  scheduled_date: string;
  scheduled_time?: string;
  day_of_week?: string;
  week_number?: number;
  status: 'scheduled' | 'completed' | 'skipped' | 'cancelled';
  notes?: string;
}

export interface ClientProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

// Get trainer's clients
export const getTrainerClients = async (): Promise<ClientProfile[]> => {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile || profile.role !== 'trainer') return [];

    const { data, error } = await supabase
      .from('client_assignments')
      .select(`
        client:profiles!client_assignments_client_id_fkey(
          id,
          full_name,
          email,
          role
        )
      `)
      .eq('trainer_id', profile.id)
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

// Get workout templates for plans
export const getWorkoutTemplatesForPlans = async () => {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile) return [];

    const { data, error } = await supabase
      .from('workout_templates')
      .select(`
        id,
        name,
        category,
        estimated_duration_minutes,
        is_public,
        created_by
      `)
      .or(`is_public.eq.true,created_by.eq.${profile.id}`)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching workout templates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getWorkoutTemplatesForPlans:', error);
    return [];
  }
};

// Create workout plan
export const createWorkoutPlan = async (planData: {
  client_id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  schedule_type: 'weekly' | 'monthly' | 'custom';
  schedule_data: any;
}): Promise<WorkoutPlan | null> => {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile || profile.role !== 'trainer') return null;

    const { data, error } = await supabase
      .from('workout_plans')
      .insert({
        ...planData,
        trainer_id: profile.id,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating workout plan:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createWorkoutPlan:', error);
    return null;
  }
};

// Update workout plan
export const updateWorkoutPlan = async (
  id: string,
  planData: Partial<WorkoutPlan>
): Promise<WorkoutPlan | null> => {
  try {
    const { data, error } = await supabase
      .from('workout_plans')
      .update({
        ...planData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating workout plan:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateWorkoutPlan:', error);
    return null;
  }
};

// Get workout plan by ID
export const getWorkoutPlan = async (id: string): Promise<WorkoutPlan | null> => {
  try {
    const { data, error } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching workout plan:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getWorkoutPlan:', error);
    return null;
  }
};

// Create plan sessions
export const createPlanSessions = async (sessions: Omit<PlanSession, 'id' | 'created_at' | 'updated_at'>[]): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('plan_sessions')
      .insert(sessions);

    if (error) {
      console.error('Error creating plan sessions:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in createPlanSessions:', error);
    return false;
  }
};

// Delete plan sessions for a plan
export const deletePlanSessions = async (planId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('plan_sessions')
      .delete()
      .eq('plan_id', planId);

    if (error) {
      console.error('Error deleting plan sessions:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deletePlanSessions:', error);
    return false;
  }
};