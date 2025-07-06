import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutTemplate, WorkoutPlan, WorkoutSession, Client, Exercise } from '../types/workout';
import { 
  getExercises as dbGetExercises, 
  createExercise as dbCreateExercise,
  getWorkoutTemplates as dbGetWorkoutTemplates,
  getWorkoutTemplate as dbGetWorkoutTemplate,
  createWorkoutTemplate as dbCreateWorkoutTemplate,
  updateWorkoutTemplate as dbUpdateWorkoutTemplate,
  deleteWorkoutTemplate as dbDeleteWorkoutTemplate,
  Exercise as DbExercise,
  WorkoutTemplate as DbWorkoutTemplate
} from '../lib/database';

const STORAGE_KEYS = {
  PLANS: '@workout_plans',
  SESSIONS: '@workout_sessions',
  CLIENTS: '@clients',
  PENDING_SYNC: '@pending_sync',
  USER_ROLE: '@user_role',
  USER_ID: '@user_id',
};

// Generic storage functions
export const storeData = async (key: string, data: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error storing data:', error);
    throw error;
  }
};

export const getData = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting data:', error);
    return null;
  }
};

export const removeData = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing data:', error);
    throw error;
  }
};

// Exercise functions - now using Supabase
export const getExercises = async (): Promise<Exercise[]> => {
  try {
    const dbExercises = await dbGetExercises();
    // Transform database exercises to match our Exercise interface
    return dbExercises.map(exercise => ({
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      muscleGroups: exercise.muscle_groups,
      instructions: exercise.instructions,
      equipment: exercise.equipment,
    }));
  } catch (error) {
    console.error('Error getting exercises:', error);
    return [];
  }
};

export const saveExercise = async (exercise: Omit<Exercise, 'id'>): Promise<Exercise | null> => {
  try {
    const dbExercise = await dbCreateExercise({
      name: exercise.name,
      category: exercise.category,
      muscle_groups: exercise.muscleGroups,
      instructions: exercise.instructions,
      equipment: exercise.equipment,
      is_public: false, // Default to private
    });

    if (!dbExercise) return null;

    // Transform back to our Exercise interface
    return {
      id: dbExercise.id,
      name: dbExercise.name,
      category: dbExercise.category,
      muscleGroups: dbExercise.muscle_groups,
      instructions: dbExercise.instructions,
      equipment: dbExercise.equipment,
    };
  } catch (error) {
    console.error('Error saving exercise:', error);
    return null;
  }
};

// Template functions - now using Supabase
export const getTemplates = async (): Promise<WorkoutTemplate[]> => {
  try {
    const dbTemplates = await dbGetWorkoutTemplates();
    // Transform database templates to match our WorkoutTemplate interface
    return dbTemplates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      duration: template.estimated_duration_minutes,
      exercises: template.exercises?.map(te => ({
        id: te.id,
        exerciseId: te.exercise_id,
        exercise: te.exercise ? {
          id: te.exercise.id,
          name: te.exercise.name,
          category: te.exercise.category,
          muscleGroups: te.exercise.muscle_groups,
          instructions: te.exercise.instructions,
          equipment: te.exercise.equipment,
        } : {} as Exercise,
        sets: te.sets_config || [],
        order: te.order_index,
        notes: te.notes,
      })) || [],
      createdBy: template.created_by,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      isPublic: template.is_public,
    }));
  } catch (error) {
    console.error('Error getting templates:', error);
    return [];
  }
};

export const getTemplate = async (id: string): Promise<WorkoutTemplate | null> => {
  try {
    const dbTemplate = await dbGetWorkoutTemplate(id);
    if (!dbTemplate) return null;

    // Transform database template to match our WorkoutTemplate interface
    return {
      id: dbTemplate.id,
      name: dbTemplate.name,
      description: dbTemplate.description,
      category: dbTemplate.category,
      duration: dbTemplate.estimated_duration_minutes,
      exercises: dbTemplate.exercises?.map(te => ({
        id: te.id,
        exerciseId: te.exercise_id,
        exercise: te.exercise ? {
          id: te.exercise.id,
          name: te.exercise.name,
          category: te.exercise.category,
          muscleGroups: te.exercise.muscle_groups,
          instructions: te.exercise.instructions,
          equipment: te.exercise.equipment,
        } : {} as Exercise,
        sets: te.sets_config || [],
        order: te.order_index,
        notes: te.notes,
      })) || [],
      createdBy: dbTemplate.created_by,
      createdAt: dbTemplate.created_at,
      updatedAt: dbTemplate.updated_at,
      isPublic: dbTemplate.is_public,
    };
  } catch (error) {
    console.error('Error getting template:', error);
    return null;
  }
};

export const saveTemplate = async (template: WorkoutTemplate): Promise<void> => {
  try {
    const templateData = {
      name: template.name,
      description: template.description,
      category: template.category,
      estimated_duration_minutes: template.duration,
      is_public: template.isPublic || false,
      exercises: template.exercises.map(exercise => ({
        exercise_id: exercise.exerciseId,
        order_index: exercise.order,
        sets_config: exercise.sets,
        notes: exercise.notes,
      })),
    };

    if (template.id && template.id !== 'new') {
      // Update existing template
      await dbUpdateWorkoutTemplate(template.id, templateData);
    } else {
      // Create new template
      await dbCreateWorkoutTemplate(templateData);
    }

    await addToPendingSync('template', template.id, 'create');
  } catch (error) {
    console.error('Error saving template:', error);
    throw error;
  }
};

export const deleteTemplate = async (id: string): Promise<void> => {
  try {
    await dbDeleteWorkoutTemplate(id);
    await addToPendingSync('template', id, 'delete');
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
};

// Plan functions
export const savePlan = async (plan: WorkoutPlan): Promise<void> => {
  const plans = await getPlans();
  const updatedPlans = plans.filter(p => p.id !== plan.id);
  updatedPlans.push(plan);
  await storeData(STORAGE_KEYS.PLANS, updatedPlans);
  await addToPendingSync('plan', plan.id, 'create');
};

export const getPlans = async (): Promise<WorkoutPlan[]> => {
  return await getData<WorkoutPlan[]>(STORAGE_KEYS.PLANS) || [];
};

export const getPlan = async (id: string): Promise<WorkoutPlan | null> => {
  const plans = await getPlans();
  return plans.find(p => p.id === id) || null;
};

export const getClientPlans = async (clientId: string): Promise<WorkoutPlan[]> => {
  const plans = await getPlans();
  return plans.filter(p => p.clientId === clientId);
};

// Session functions
export const saveSession = async (session: WorkoutSession): Promise<void> => {
  const sessions = await getSessions();
  const updatedSessions = sessions.filter(s => s.id !== session.id);
  updatedSessions.push(session);
  await storeData(STORAGE_KEYS.SESSIONS, updatedSessions);
  await addToPendingSync('session', session.id, 'create');
};

export const getSessions = async (): Promise<WorkoutSession[]> => {
  return await getData<WorkoutSession[]>(STORAGE_KEYS.SESSIONS) || [];
};

export const getSession = async (id: string): Promise<WorkoutSession | null> => {
  const sessions = await getSessions();
  return sessions.find(s => s.id === id) || null;
};

export const getClientSessions = async (clientId: string): Promise<WorkoutSession[]> => {
  const sessions = await getSessions();
  return sessions.filter(s => s.clientId === clientId);
};

// Client functions
export const saveClient = async (client: Client): Promise<void> => {
  const clients = await getClients();
  const updatedClients = clients.filter(c => c.id !== client.id);
  updatedClients.push(client);
  await storeData(STORAGE_KEYS.CLIENTS, updatedClients);
  await addToPendingSync('client', client.id, 'create');
};

export const getClients = async (): Promise<Client[]> => {
  return await getData<Client[]>(STORAGE_KEYS.CLIENTS) || [];
};

export const getClient = async (id: string): Promise<Client | null> => {
  const clients = await getClients();
  return clients.find(c => c.id === id) || null;
};

// Sync functions
export const addToPendingSync = async (type: string, id: string, action: 'create' | 'update' | 'delete'): Promise<void> => {
  const pendingSync = await getData<any[]>(STORAGE_KEYS.PENDING_SYNC) || [];
  const syncItem = {
    type,
    id,
    action,
    timestamp: new Date().toISOString(),
  };
  
  // Remove existing sync item for the same type and id
  const updatedSync = pendingSync.filter(item => !(item.type === type && item.id === id));
  updatedSync.push(syncItem);
  
  await storeData(STORAGE_KEYS.PENDING_SYNC, updatedSync);
};

export const getPendingSync = async (): Promise<any[]> => {
  return await getData<any[]>(STORAGE_KEYS.PENDING_SYNC) || [];
};

export const clearPendingSync = async (): Promise<void> => {
  await storeData(STORAGE_KEYS.PENDING_SYNC, []);
};

export const removeSyncItem = async (type: string, id: string): Promise<void> => {
  const pendingSync = await getPendingSync();
  const updatedSync = pendingSync.filter(item => !(item.type === type && item.id === id));
  await storeData(STORAGE_KEYS.PENDING_SYNC, updatedSync);
};