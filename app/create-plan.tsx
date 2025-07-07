import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  ChevronDown,
  Calendar,
  X,
  Plus,
  Trash2,
  Copy
} from 'lucide-react-native';
import { useColorScheme, getColors } from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import { WorkoutPlan, Client, WorkoutTemplate, DayOfWeek } from '@/types/workout';
import { generateId, getWeekDates } from '@/utils/workoutUtils';
import { supabase } from '@/lib/supabase';

const daysOfWeek: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type ScheduleType = 'weekly' | 'monthly' | 'custom' | 'session';

interface CustomScheduleDay {
  id: string;
  date: string;
  templateId: string | null;
  label?: string;
}

export default function CreatePlanScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme as 'light' | 'dark' | null);
  const styles = createStyles(colors);
  const { edit } = useLocalSearchParams();

  const [planName, setPlanName] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 28); // 4 weeks default
    return date.toISOString().split('T')[0];
  });
  
  // Schedule type and data
  const [scheduleType, setScheduleType] = useState<ScheduleType>('weekly');
  const [weeklySchedule, setWeeklySchedule] = useState<{ [key in DayOfWeek]: string | null }>({
    Monday: null,
    Tuesday: null,
    Wednesday: null,
    Thursday: null,
    Friday: null,
    Saturday: null,
    Sunday: null,
  });
  const [monthlySchedule, setMonthlySchedule] = useState<{ [week: number]: { [key in DayOfWeek]: string | null } }>({
    1: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null, Sunday: null },
    2: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null, Sunday: null },
    3: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null, Sunday: null },
    4: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null, Sunday: null },
  });
  const [customSchedule, setCustomSchedule] = useState<CustomScheduleDay[]>([]);
  const [sessionSchedule, setSessionSchedule] = useState<{ [key: string]: string | null }>({});

  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showScheduleTypePicker, setShowScheduleTypePicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedCustomDay, setSelectedCustomDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isEditing = !!edit;

  useEffect(() => {
    loadData();
    if (isEditing) {
      loadPlan();
    }
  }, []);

  const loadData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setClients([]);
        setTemplates([]);
        return;
      }

      // Get user profile (trainers are in clients table)
      const { data: profileData, error: profileError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (profileError || !profileData) {
        setClients([]);
        setTemplates([]);
        return;
      }

      // Fetch only assigned clients for this trainer (simplified like TrainerNewSessionsView)
      try {
        // Get current trainer ID from Supabase Auth
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user?.id) {
          setClients([]);
          return;
        }
        const trainerId = userData.user.id;
        
        // Fetch assigned client IDs from client_assignments table
        const { data: assignments, error: assignError } = await supabase
          .from('client_assignments')
          .select('client_id')
          .eq('trainer_id', trainerId)
          .eq('status', 'active');
        
        if (assignError) throw assignError;
        
        const assignedClientIds = (assignments || []).map((a: any) => a.client_id).filter(Boolean);
        if (assignedClientIds.length === 0) {
          setClients([]);
          return;
        }
        
        // Fetch client profiles from profiles table
        const { data: clientsData, error: clientsError } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar')
          .in('id', assignedClientIds);
        
        if (clientsError) throw clientsError;
        
        const transformedClients: Client[] = (clientsData || []).map((c: any) => ({
          id: c.id,
          name: c.full_name || c.email || 'Unknown Client',
          email: c.email || '',
          avatar: c.avatar || '👤',
          joinDate: new Date().toISOString().split('T')[0], // Default to today
          trainerId: trainerId
        }));
        
        console.log('Transformed clients:', transformedClients);
        setClients(transformedClients);
      } catch (error) {
        console.error('Error fetching assigned clients:', error);
        setClients([]);
      }

      // Load templates (public and user-created)
      const { data: templatesData, error: templatesError } = await supabase
        .from('workout_templates')
        .select(`
          *,
          template_exercises (
            *,
            exercise:exercises (*)
          )
        `)
        .or(`is_public.eq.true,created_by.eq.${profileData.id}`)
        .order('created_at', { ascending: false });

      if (templatesError) {
        console.error('Error loading templates:', templatesError);
        setTemplates([]);
      } else {
        const transformedTemplates: WorkoutTemplate[] = (templatesData || []).map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          duration: template.estimated_duration_minutes || 60,
          exercises: (template.template_exercises || []).map((te: any) => ({
            id: te.id,
            exerciseId: te.exercise_id,
            exercise: {
              id: te.exercise?.id || '',
              name: te.exercise?.name || 'Unknown Exercise',
              category: te.exercise?.category || 'Unknown',
              muscleGroups: te.exercise?.muscle_groups || [],
              instructions: te.exercise?.instructions,
              equipment: te.exercise?.equipment
            },
            sets: te.sets_config ? (() => {
              try {
                const parsed = typeof te.sets_config === 'string' ? JSON.parse(te.sets_config) : te.sets_config;
                return Array.isArray(parsed) && parsed.length > 0 ? parsed : [
                  { reps: 10, weight: 0, restTime: 60 },
                  { reps: 10, weight: 0, restTime: 60 },
                  { reps: 10, weight: 0, restTime: 60 },
                ];
              } catch (error) {
                console.error('Error parsing sets_config:', error);
                return [
                  { reps: 10, weight: 0, restTime: 60 },
                  { reps: 10, weight: 0, restTime: 60 },
                  { reps: 10, weight: 0, restTime: 60 },
                ];
              }
            })() : [
              { reps: 10, weight: 0, restTime: 60 },
              { reps: 10, weight: 0, restTime: 60 },
              { reps: 10, weight: 0, restTime: 60 },
            ],
            order: te.order_index,
            notes: te.notes
          })),
          createdBy: template.created_by,
          createdAt: template.created_at,
          updatedAt: template.updated_at,
          isPublic: template.is_public
        }));
        setTemplates(transformedTemplates);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setClients([]);
      setTemplates([]);
    }
  };

  const loadPlan = async () => {
    try {
      const planId = edit as string;
      
      // Fetch plan from Supabase
      const { data: planData, error: planError } = await supabase
        .from('workout_plans')
        .select(`
          *,
          plan_templates (
            *,
            template:workout_templates (*)
          )
        `)
        .eq('id', planId)
        .single();

      if (planError) {
        console.error('Error loading plan from database:', planError);
        Alert.alert('Error', 'Failed to load plan');
        return;
      }

      if (planData) {
        setPlanName(planData.name);
        setStartDate(planData.start_date);
        setEndDate(planData.end_date);
        
        // Set schedule based on plan type
        if (planData.schedule_type === 'weekly') {
          setScheduleType('weekly');
          // Convert plan_templates to weekly schedule format
          const weeklyScheduleData: { [key in DayOfWeek]: string | null } = {
            Monday: null,
            Tuesday: null,
            Wednesday: null,
            Thursday: null,
            Friday: null,
            Saturday: null,
            Sunday: null,
          };
          
          (planData.plan_templates || []).forEach((pt: any) => {
            if (pt.day_of_week !== null) {
              const dayName = daysOfWeek[pt.day_of_week];
              if (dayName) {
                weeklyScheduleData[dayName] = pt.template_id;
              }
            }
          });
          
          setWeeklySchedule(weeklyScheduleData);
        } else if (planData.schedule_type === 'monthly') {
          setScheduleType('monthly');
          // Convert plan_templates to monthly schedule format
          const monthlyScheduleData: { [week: number]: { [key in DayOfWeek]: string | null } } = {
            1: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null, Sunday: null },
            2: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null, Sunday: null },
            3: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null, Sunday: null },
            4: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null, Sunday: null },
          };
          
          (planData.plan_templates || []).forEach((pt: any) => {
            if (pt.week_number && pt.day_of_week !== null) {
              const dayName = daysOfWeek[pt.day_of_week];
              if (dayName && monthlyScheduleData[pt.week_number]) {
                monthlyScheduleData[pt.week_number][dayName] = pt.template_id;
              }
            }
          });
          
          setMonthlySchedule(monthlyScheduleData);
        } else if (planData.schedule_type === 'custom') {
          setScheduleType('custom');
          // Convert plan_templates to custom schedule format
          const customScheduleData: CustomScheduleDay[] = (planData.plan_templates || [])
            .filter((pt: any) => pt.scheduled_date)
            .map((pt: any) => ({
              id: pt.id,
              date: pt.scheduled_date,
              templateId: pt.template_id,
              label: `Day ${pt.order_index + 1}`,
            }));
          
          setCustomSchedule(customScheduleData);
        } else if (planData.schedule_type === 'session') {
          setScheduleType('session');
          // Convert plan_templates to session schedule format
          const sessionScheduleData: { [key: string]: string | null } = {};
          (planData.plan_templates || []).forEach((pt: any, index: number) => {
            const sessionId = `session_${pt.id || index}`;
            sessionScheduleData[sessionId] = pt.template_id;
          });
          
          setSessionSchedule(sessionScheduleData);
        }
        
        // Set selected client
        const client = clients.find(c => c.id === planData.client_id);
        if (client) {
          setSelectedClient(client);
        }
      }
    } catch (error) {
      console.error('Error loading plan:', error);
      Alert.alert('Error', 'Failed to load plan');
    }
  };

  const handleDayPress = (day: DayOfWeek, week?: number) => {
    setSelectedDay(day);
    setSelectedWeek(week || null);
    setShowTemplatePicker(true);
  };

  const handleCustomDayPress = (dayId: string) => {
    setSelectedCustomDay(dayId);
    setShowTemplatePicker(true);
  };

  const handleTemplateSelect = (template: WorkoutTemplate | null) => {
    if (scheduleType === 'weekly' && selectedDay) {
      setWeeklySchedule(prev => ({
        ...prev,
        [selectedDay]: template?.id || null
      }));
    } else if (scheduleType === 'monthly' && selectedDay && selectedWeek) {
      setMonthlySchedule(prev => ({
        ...prev,
        [selectedWeek]: {
          ...prev[selectedWeek],
          [selectedDay]: template?.id || null
        }
      }));
    } else if (scheduleType === 'custom' && selectedCustomDay) {
      setCustomSchedule(prev => prev.map(day => 
        day.id === selectedCustomDay 
          ? { ...day, templateId: template?.id || null }
          : day
      ));
    } else if (scheduleType === 'session' && selectedCustomDay) {
      setSessionSchedule(prev => ({
        ...prev,
        [selectedCustomDay]: template?.id || null
      }));
    }
    
    setShowTemplatePicker(false);
    setSelectedDay(null);
    setSelectedWeek(null);
    setSelectedCustomDay(null);
  };

  const addCustomDay = () => {
    const newDay: CustomScheduleDay = {
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      templateId: null,
      label: `Day ${customSchedule.length + 1}`,
    };
    setCustomSchedule(prev => [...prev, newDay]);
  };

  const removeCustomDay = (dayId: string) => {
    setCustomSchedule(prev => prev.filter(day => day.id !== dayId));
  };

  const updateCustomDayDate = (dayId: string, date: string) => {
    setCustomSchedule(prev => prev.map(day => 
      day.id === dayId ? { ...day, date } : day
    ));
  };

  const updateCustomDayLabel = (dayId: string, label: string) => {
    setCustomSchedule(prev => prev.map(day => 
      day.id === dayId ? { ...day, label } : day
    ));
  };

  const copyWeekToAll = (sourceWeek: number) => {
    const sourceSchedule = monthlySchedule[sourceWeek];
    setMonthlySchedule(prev => ({
      1: sourceSchedule,
      2: sourceSchedule,
      3: sourceSchedule,
      4: sourceSchedule,
    }));
  };

  const getTemplateName = (templateId: string | null): string => {
    if (!templateId) return 'Rest Day';
    const template = templates.find(t => t.id === templateId);
    return template?.name || 'Unknown Template';
  };

  const getScheduleTypeLabel = (type: ScheduleType): string => {
    switch (type) {
      case 'weekly': return 'Weekly Repeat';
      case 'monthly': return 'Monthly Plan';
      case 'custom': return 'Custom Schedule';
      case 'session': return 'Session Based';
      default: return 'Weekly Repeat';
    }
  };

  const handleSavePlan = async () => {
    if (!planName.trim()) {
      Alert.alert('Error', 'Please enter a plan name');
      return;
    }

    if (!selectedClient) {
      Alert.alert('Error', 'Please select a client');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    // Validate schedule based on type
    let finalSchedule: any = {};
    if (scheduleType === 'weekly') {
      finalSchedule = weeklySchedule;
    } else if (scheduleType === 'monthly') {
      finalSchedule = monthlySchedule;
    } else if (scheduleType === 'custom') {
      if (customSchedule.length === 0) {
        Alert.alert('Error', 'Please add at least one day to your custom schedule');
        return;
      }
      finalSchedule = customSchedule;
    } else if (scheduleType === 'session') {
      if (Object.keys(sessionSchedule).length === 0) {
        Alert.alert('Error', 'Please add at least one session to your plan');
        return;
      }
      finalSchedule = sessionSchedule;
    }

    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        setLoading(false);
        return;
      }

      // Get user profile (trainers are in clients table)
      const { data: profileData, error: profileError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (profileError || !profileData) {
        Alert.alert('Error', 'User profile not found');
        setLoading(false);
        return;
      }

      const planId = isEditing ? (edit as string) : generateId();
      
      // Save workout plan
      const planData = {
        id: planId,
        name: planName.trim(),
        description: null,
        client_id: selectedClient.id,
        trainer_id: profileData.id,
        start_date: startDate,
        end_date: endDate,
        schedule_type: scheduleType,
        schedule_data: finalSchedule,
        status: 'active',
      };

      let planResult;
      if (isEditing) {
        const { data, error } = await supabase
          .from('workout_plans')
          .update(planData)
          .eq('id', planId)
          .select()
          .single();
        planResult = { data, error };
      } else {
        const { data, error } = await supabase
          .from('workout_plans')
          .insert(planData)
          .select()
          .single();
        planResult = { data, error };
      }

      if (planResult.error) {
        throw planResult.error;
      }

      // Remove existing plan_templates if editing
      if (isEditing) {
        await supabase
          .from('plan_templates')
          .delete()
          .eq('plan_id', planId);
      }

      // Insert plan_templates based on schedule type
      if (scheduleType === 'weekly') {
        for (let i = 0; i < daysOfWeek.length; i++) {
          const day = daysOfWeek[i];
          const templateId = weeklySchedule[day];
          if (templateId) {
            const { error: ptError } = await supabase
              .from('plan_templates')
              .insert({
                plan_id: planId,
                template_id: templateId,
                day_of_week: i,
                order_index: i,
              });
            if (ptError) {
              throw ptError;
            }
          }
        }
      } else if (scheduleType === 'monthly') {
        for (let week = 1; week <= 4; week++) {
          for (let i = 0; i < daysOfWeek.length; i++) {
            const day = daysOfWeek[i];
            const templateId = monthlySchedule[week][day];
            if (templateId) {
              const { error: ptError } = await supabase
                .from('plan_templates')
                .insert({
                  plan_id: planId,
                  template_id: templateId,
                  day_of_week: i,
                  week_number: week,
                  order_index: (week - 1) * 7 + i,
                });
              if (ptError) {
                throw ptError;
              }
            }
          }
        }
      } else if (scheduleType === 'custom') {
        for (let i = 0; i < customSchedule.length; i++) {
          const day = customSchedule[i];
          if (day.templateId) {
            const { error: ptError } = await supabase
              .from('plan_templates')
              .insert({
                plan_id: planId,
                template_id: day.templateId,
                scheduled_date: day.date,
                order_index: i,
              });
            if (ptError) {
              throw ptError;
            }
          }
        }
      } else if (scheduleType === 'session') {
        let sessionIndex = 0;
        for (const [sessionId, templateId] of Object.entries(sessionSchedule)) {
          if (templateId) {
            const { error: ptError } = await supabase
              .from('plan_templates')
              .insert({
                plan_id: planId,
                template_id: templateId,
                order_index: sessionIndex,
              });
            if (ptError) {
              throw ptError;
            }
            sessionIndex++;
          }
        }
      }

      Alert.alert(
        'Success',
        `Plan ${isEditing ? 'updated' : 'created'} successfully!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving plan:', error);
      Alert.alert('Error', 'Failed to save plan');
    } finally {
      setLoading(false);
    }
  };

  const renderWeeklySchedule = () => {
    const renderDayCard = (day: DayOfWeek) => {
      const templateId = weeklySchedule[day];
      const hasWorkout = templateId !== null;
      
      return (
        <TouchableOpacity
          key={day}
          style={[
            styles.dayCard,
            hasWorkout ? styles.activeDayCard : styles.restDayCard
          ]}
          onPress={() => handleDayPress(day)}
        >
          <Text style={[
            styles.dayName,
            hasWorkout ? styles.activeDayName : styles.restDayName
          ]}>
            {day}
          </Text>
          <Text style={[
            styles.templateName,
            hasWorkout ? styles.activeTemplateName : styles.restTemplateName
          ]} numberOfLines={2}>
            {getTemplateName(templateId)}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.weekGrid}>
        {daysOfWeek.map(renderDayCard)}
      </View>
    );
  };

  const renderMonthlySchedule = () => {
    return (
      <View style={styles.monthlyContainer}>
        {[1, 2, 3, 4].map((week) => (
          <View key={week} style={styles.weekContainer}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekTitle}>Week {week}</Text>
              <View style={styles.weekActions}>
                <TouchableOpacity
                  style={styles.weekActionButton}
                  onPress={() => copyWeekToAll(week)}
                >
                  <Copy size={14} color={colors.primary} />
                  <Text style={styles.weekActionText}>Copy to All</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.weekGrid}>
              {daysOfWeek.map((day) => {
                const templateId = monthlySchedule[week][day];
                const hasWorkout = templateId !== null;
                
                return (
                  <TouchableOpacity
                    key={`${week}-${day}`}
                    style={[
                      styles.monthlyDayCard,
                      hasWorkout ? styles.activeDayCard : styles.restDayCard
                    ]}
                    onPress={() => handleDayPress(day, week)}
                  >
                    <Text style={[
                      styles.monthlyDayName,
                      hasWorkout ? styles.activeDayName : styles.restDayName
                    ]}>
                      {day.slice(0, 3)}
                    </Text>
                    <Text style={[
                      styles.monthlyTemplateName,
                      hasWorkout ? styles.activeTemplateName : styles.restTemplateName
                    ]} numberOfLines={1}>
                      {getTemplateName(templateId)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderCustomSchedule = () => {
    return (
      <View style={styles.customContainer}>
        <View style={styles.customHeader}>
          <Text style={styles.customTitle}>Custom Days ({customSchedule.length})</Text>
          <TouchableOpacity style={styles.addDayButton} onPress={addCustomDay}>
            <Plus size={16} color={colors.primary} />
            <Text style={styles.addDayText}>Add Day</Text>
          </TouchableOpacity>
        </View>

        {customSchedule.length === 0 ? (
          <View style={styles.emptyCustom}>
            <Text style={styles.emptyCustomText}>No custom days added yet</Text>
            <TouchableOpacity style={styles.addFirstDayButton} onPress={addCustomDay}>
              <Text style={styles.addFirstDayText}>Add First Day</Text>
            </TouchableOpacity>
          </View>
        ) : (
          customSchedule.map((day) => (
            <View key={day.id} style={styles.customDayCard}>
              <View style={styles.customDayHeader}>
                <View style={styles.customDayInputs}>
                  <TextInput
                    style={styles.customDayLabel}
                    value={day.label}
                    onChangeText={(text) => updateCustomDayLabel(day.id, text)}
                    placeholder="Day label"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <TextInput
                    style={styles.customDayDate}
                    value={day.date}
                    onChangeText={(text) => updateCustomDayDate(day.id, text)}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <TouchableOpacity
                  style={styles.removeDayButton}
                  onPress={() => removeCustomDay(day.id)}
                >
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.customWorkoutSelector,
                  day.templateId ? styles.activeCustomWorkout : styles.restCustomWorkout
                ]}
                onPress={() => handleCustomDayPress(day.id)}
              >
                <Text style={[
                  styles.customWorkoutText,
                  day.templateId ? styles.activeCustomWorkoutText : styles.restCustomWorkoutText
                ]}>
                  {getTemplateName(day.templateId)}
                </Text>
                <ChevronDown size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    );
  };

  const renderSessionSchedule = () => {
    const sessionIds = Object.keys(sessionSchedule);
    
    return (
      <View style={styles.customContainer}>
        <View style={styles.customHeader}>
          <Text style={styles.customTitle}>Sessions ({sessionIds.length})</Text>
          <TouchableOpacity 
            style={styles.addDayButton} 
            onPress={() => {
              const newSessionId = `session_${Date.now()}`;
              setSessionSchedule(prev => ({ ...prev, [newSessionId]: null }));
            }}
          >
            <Plus size={16} color={colors.primary} />
            <Text style={styles.addDayText}>Add Session</Text>
          </TouchableOpacity>
        </View>

        {sessionIds.length === 0 ? (
          <View style={styles.emptyCustom}>
            <Text style={styles.emptyCustomText}>No sessions added yet</Text>
            <TouchableOpacity 
              style={styles.addFirstDayButton} 
              onPress={() => {
                const newSessionId = `session_${Date.now()}`;
                setSessionSchedule(prev => ({ ...prev, [newSessionId]: null }));
              }}
            >
              <Text style={styles.addFirstDayText}>Add First Session</Text>
            </TouchableOpacity>
          </View>
        ) : (
          sessionIds.map((sessionId, index) => (
            <View key={sessionId} style={styles.customDayCard}>
              <View style={styles.customDayHeader}>
                <View style={styles.customDayInputs}>
                  <Text style={styles.customDayLabel}>
                    Session {index + 1}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeDayButton}
                  onPress={() => {
                    setSessionSchedule(prev => {
                      const newSchedule = { ...prev };
                      delete newSchedule[sessionId];
                      return newSchedule;
                    });
                  }}
                >
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.customWorkoutSelector,
                  sessionSchedule[sessionId] ? styles.activeCustomWorkout : styles.restCustomWorkout
                ]}
                onPress={() => handleCustomDayPress(sessionId)}
              >
                <Text style={[
                  styles.customWorkoutText,
                  sessionSchedule[sessionId] ? styles.activeCustomWorkoutText : styles.restCustomWorkoutText
                ]}>
                  {getTemplateName(sessionSchedule[sessionId])}
                </Text>
                <ChevronDown size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isEditing ? 'Edit Plan' : 'Create Plan'}
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSavePlan}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Plan Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Information</Text>
          
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Plan Name *</Text>
            <TextInput
              style={styles.textInput}
              value={planName}
              onChangeText={setPlanName}
              placeholder="Enter plan name"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Client *</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowClientPicker(true)}
            >
              <Text style={[
                styles.pickerText,
                !selectedClient && styles.placeholderText
              ]}>
                {selectedClient?.name || 'Select a client'}
              </Text>
              <ChevronDown size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            
            {/* Debug button */}
            <TouchableOpacity
              style={{ 
                backgroundColor: colors.primary, 
                padding: 8, 
                borderRadius: 6, 
                marginTop: 8,
                alignItems: 'center'
              }}
              onPress={() => {
                console.log('Current clients state:', clients);
                console.log('Clients length:', clients.length);
                loadData();
              }}
            >
              <Text style={{ color: 'white', fontSize: 12 }}>Debug: Reload Clients</Text>
            </TouchableOpacity>
            
            {/* Database Debug button */}
            <TouchableOpacity
              style={{ 
                backgroundColor: colors.error, 
                padding: 8, 
                borderRadius: 6, 
                marginTop: 8,
                alignItems: 'center'
              }}
              onPress={async () => {
                console.log('=== DATABASE DEBUG ===');
                
                // Get current user
                const { data: userData } = await supabase.auth.getUser();
                console.log('Current user ID:', userData?.user?.id);
                
                // Check all assignments
                const { data: allAssignments, error: assignError } = await supabase
                  .from('client_assignments')
                  .select('*');
                console.log('All assignments:', allAssignments);
                console.log('Assignments error:', assignError);
                
                // Check all clients
                const { data: allClients, error: clientError } = await supabase
                  .from('profiles')
                  .select('id, full_name, email, role')
                  .eq('role', 'client');
                console.log('All clients:', allClients);
                console.log('Clients error:', clientError);
                
                // Check assignments for current user
                const { data: userAssignments, error: userAssignError } = await supabase
                  .from('client_assignments')
                  .select('*')
                  .eq('trainer_id', userData?.user?.id);
                console.log('User assignments:', userAssignments);
                console.log('User assignments error:', userAssignError);
                
                Alert.alert('Debug Complete', 'Check console for database info');
              }}
            >
              <Text style={{ color: 'white', fontSize: 12 }}>Debug: Check Database</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formFieldHalf}>
              <Text style={styles.fieldLabel}>Start Date</Text>
              <TextInput
                style={styles.textInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.formFieldHalf}>
              <Text style={styles.fieldLabel}>End Date</Text>
              <TextInput
                style={styles.textInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>
        </View>

        {/* Schedule Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule Type</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowScheduleTypePicker(true)}
          >
            <Text style={styles.pickerText}>
              {getScheduleTypeLabel(scheduleType)}
            </Text>
            <ChevronDown size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          
          <Text style={styles.scheduleDescription}>
            {scheduleType === 'weekly' && 'Same workout pattern repeats every week'}
            {scheduleType === 'monthly' && 'Different workout patterns for each week of the month'}
            {scheduleType === 'custom' && 'Specific workouts on specific dates'}
            {scheduleType === 'session' && 'Individual training sessions without specific dates'}
          </Text>
        </View>

        {/* Schedule Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {scheduleType === 'weekly' && 'Weekly Schedule'}
            {scheduleType === 'monthly' && 'Monthly Schedule'}
            {scheduleType === 'custom' && 'Custom Schedule'}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {scheduleType === 'weekly' && 'Tap on each day to assign a workout template or set as rest day'}
            {scheduleType === 'monthly' && 'Configure different workout patterns for each week'}
            {scheduleType === 'custom' && 'Add specific workout days with custom dates'}
          </Text>
          
          {scheduleType === 'weekly' && renderWeeklySchedule()}
          {scheduleType === 'monthly' && renderMonthlySchedule()}
          {scheduleType === 'custom' && renderCustomSchedule()}
        {scheduleType === 'session' && renderSessionSchedule()}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Client Picker Modal */}
      <Modal
        visible={showClientPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClientPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Select Client</Text>
          
          <ScrollView style={styles.clientList}>
            {(() => { console.log('Clients in modal:', clients); return null; })()}
            {clients.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>No clients found</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 8 }}>
                  Make sure you have assigned clients in the admin panel
                </Text>
              </View>
            ) : (
              clients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={[
                  styles.clientOption,
                  selectedClient?.id === client.id && styles.selectedClientOption
                ]}
                onPress={() => {
                  setSelectedClient(client);
                  setShowClientPicker(false);
                }}
              >
                <Text style={styles.clientAvatar}>{client.avatar}</Text>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{client.name}</Text>
                  <Text style={styles.clientEmail}>{client.email}</Text>
                </View>
                {selectedClient?.id === client.id && (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Schedule Type Picker Modal */}
      <Modal
        visible={showScheduleTypePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowScheduleTypePicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Select Schedule Type</Text>
          
          <View style={styles.scheduleTypeList}>
            {(['weekly', 'monthly', 'custom', 'session'] as ScheduleType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.scheduleTypeOption,
                  scheduleType === type && styles.selectedScheduleTypeOption
                ]}
                onPress={() => {
                  setScheduleType(type);
                  setShowScheduleTypePicker(false);
                }}
              >
                <View style={styles.scheduleTypeInfo}>
                  <Text style={[
                    styles.scheduleTypeTitle,
                    scheduleType === type && styles.selectedScheduleTypeTitle
                  ]}>
                    {getScheduleTypeLabel(type)}
                  </Text>
                  <Text style={styles.scheduleTypeDescription}>
                    {type === 'weekly' && 'Same workout pattern repeats every week'}
                    {type === 'monthly' && 'Different workout patterns for each week of the month'}
                    {type === 'custom' && 'Specific workouts on specific dates'}
                  </Text>
                </View>
                {scheduleType === type && (
                  <Text style={styles.selectedText}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Template Picker Modal */}
      <Modal
        visible={showTemplatePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTemplatePicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>
            Select Template
          </Text>
          
          <ScrollView style={styles.templateList}>
            {/* Rest Day Option */}
            <TouchableOpacity
              style={styles.templateOption}
              onPress={() => handleTemplateSelect(null)}
            >
              <View style={styles.templateInfo}>
                <Text style={styles.templateOptionName}>Rest Day</Text>
                <Text style={styles.templateOptionDescription}>No workout scheduled</Text>
              </View>
            </TouchableOpacity>

            {/* Template Options */}
            {templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateOption}
                onPress={() => handleTemplateSelect(template)}
              >
                <View style={styles.templateInfo}>
                  <Text style={styles.templateOptionName}>{template.name}</Text>
                  <Text style={styles.templateOptionDescription}>
                    {template.exercises.length} exercises • {template.duration} min
                  </Text>
                  <Text style={styles.templateOptionCategory}>{template.category}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  formField: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 16,
  },
  formFieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  textInput: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    color: colors.textTertiary,
  },
  scheduleDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dayCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    minHeight: 80,
    justifyContent: 'center',
  },
  activeDayCard: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  restDayCard: {
    borderColor: colors.border,
  },
  dayName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginBottom: 4,
  },
  activeDayName: {
    color: colors.primary,
  },
  restDayName: {
    color: colors.text,
  },
  templateName: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  activeTemplateName: {
    color: colors.text,
  },
  restTemplateName: {
    color: colors.textSecondary,
  },
  // Monthly Schedule Styles
  monthlyContainer: {
    gap: 20,
  },
  weekContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  weekTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  weekActions: {
    flexDirection: 'row',
    gap: 8,
  },
  weekActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  weekActionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.primary,
    marginLeft: 4,
  },
  monthlyDayCard: {
    width: '13%',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthlyDayName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    marginBottom: 4,
  },
  monthlyTemplateName: {
    fontFamily: 'Inter-Regular',
    fontSize: 8,
    textAlign: 'center',
    lineHeight: 10,
  },
  // Custom Schedule Styles
  customContainer: {
    gap: 16,
  },
  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  addDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addDayText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.primary,
    marginLeft: 4,
  },
  emptyCustom: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCustomText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  addFirstDayButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  addFirstDayText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  customDayCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customDayInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  customDayLabel: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  customDayDate: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeDayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customWorkoutSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  activeCustomWorkout: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  restCustomWorkout: {
    borderColor: colors.border,
  },
  customWorkoutText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  activeCustomWorkoutText: {
    color: colors.text,
  },
  restCustomWorkoutText: {
    color: colors.textSecondary,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 32,
  },
  clientList: {
    flex: 1,
  },
  clientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  selectedClientOption: {
    backgroundColor: `${colors.primary}20`,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  clientAvatar: {
    fontSize: 24,
    marginRight: 16,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  clientEmail: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  scheduleTypeList: {
    flex: 1,
  },
  scheduleTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  },
  selectedScheduleTypeOption: {
    backgroundColor: `${colors.primary}20`,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  scheduleTypeInfo: {
    flex: 1,
  },
  scheduleTypeTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  selectedScheduleTypeTitle: {
    color: colors.primary,
  },
  scheduleTypeDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  templateList: {
    flex: 1,
  },
  templateOption: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  templateInfo: {
    flex: 1,
  },
  templateOptionName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  templateOptionDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  templateOptionCategory: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.primary,
  },
});