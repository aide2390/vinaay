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
  avatar_url?: string;
  created_at: string;
}

export interface WorkoutTemplateForPlan {
  id: string;
  name: string;
  category: string;
  estimated_duration_minutes: number;
  is_public: boolean;
  created_by: string;
}

// Get trainer's clients with better error handling and logging
export const getTrainerClients = async (): Promise<ClientProfile[]> => {
  try {
    console.log('🔍 Getting trainer clients...');
    
    const profile = await getCurrentUserProfile();
    console.log('👤 Current profile:', profile);
    
    if (!profile) {
      console.log('❌ No profile found');
      return [];
    }
    
    if (profile.role !== 'trainer') {
      console.log('❌ User is not a trainer, role:', profile.role);
      return [];
    }

    console.log('🔍 Fetching client assignments for trainer:', profile.id);

    // First, let's check if there are any client assignments at all
    const { data: allAssignments, error: allError } = await supabase
      .from('client_assignments')
      .select('*');
    
    console.log('📊 All client assignments:', allAssignments);
    if (allError) console.log('❌ Error fetching all assignments:', allError);

    // Now fetch trainer's specific assignments
    const { data: assignments, error: assignmentError } = await supabase
      .from('client_assignments')
      .select(`
        client_id,
        status,
        client:profiles!client_assignments_client_id_fkey(
          id,
          full_name,
          email,
          role,
          avatar_url,
          created_at
        )
      `)
      .eq('trainer_id', profile.id)
      .eq('status', 'active');

    console.log('📋 Trainer assignments query result:', assignments);
    console.log('❌ Assignment error:', assignmentError);

    if (assignmentError) {
      console.error('Error fetching trainer client assignments:', assignmentError);
      return [];
    }

    if (!assignments || assignments.length === 0) {
      console.log('📭 No active client assignments found for trainer');
      
      // Let's also try to get all clients for debugging
      const { data: allClients, error: clientsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client');
      
      console.log('👥 All clients in system:', allClients);
      if (clientsError) console.log('❌ Error fetching all clients:', clientsError);
      
      return [];
    }

    // Extract client profiles from assignments
    const clients = assignments
      .map(assignment => assignment.client)
      .filter(client => client !== null) as ClientProfile[];

    console.log('✅ Successfully fetched clients:', clients);
    return clients;

  } catch (error) {
    console.error('💥 Unexpected error in getTrainerClients:', error);
    return [];
  }
};

// Get workout templates for plans with better error handling
export const getWorkoutTemplatesForPlans = async (): Promise<WorkoutTemplateForPlan[]> => {
  try {
    console.log('🔍 Getting workout templates for plans...');
    
    const profile = await getCurrentUserProfile();
    if (!profile) {
      console.log('❌ No profile found for templates');
      return [];
    }

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

    console.log('✅ Successfully fetched templates:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('💥 Unexpected error in getWorkoutTemplatesForPlans:', error);
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
    console.log('💾 Creating workout plan:', planData);
    
    const profile = await getCurrentUserProfile();
    if (!profile || profile.role !== 'trainer') {
      console.log('❌ Invalid profile for plan creation');
      return null;
    }

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

    console.log('✅ Successfully created workout plan:', data);
    return data;
  } catch (error) {
    console.error('💥 Unexpected error in createWorkoutPlan:', error);
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

// Helper function to create sample client assignment for testing
export const createSampleClientAssignment = async (): Promise<boolean> => {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile || profile.role !== 'trainer') {
      console.log('❌ Not a trainer, cannot create sample assignment');
      return false;
    }

    // Get a client to assign
    const { data: clients, error: clientsError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'client')
      .limit(1);

    if (clientsError || !clients || clients.length === 0) {
      console.log('❌ No clients found to assign');
      return false;
    }

    const client = clients[0];

    // Check if assignment already exists
    const { data: existingAssignment } = await supabase
      .from('client_assignments')
      .select('id')
      .eq('trainer_id', profile.id)
      .eq('client_id', client.id)
      .single();

    if (existingAssignment) {
      console.log('✅ Assignment already exists');
      return true;
    }

    // Create new assignment
    const { data, error } = await supabase
      .from('client_assignments')
      .insert({
        trainer_id: profile.id,
        client_id: client.id,
        status: 'active',
        assigned_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating sample assignment:', error);
      return false;
    }

    console.log('✅ Created sample client assignment:', data);
    return true;
  } catch (error) {
    console.error('💥 Error in createSampleClientAssignment:', error);
    return false;
  }
};