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
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft, 
  Plus, 
  Calendar,
  Clock,
  User,
  ChevronDown,
  X,
  Save,
  Copy,
  Trash2,
  Users,
  Dumbbell,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Target,
  Zap,
  Star,
  TrendingUp,
  Activity,
  MapPin,
  Timer,
  Award
} from 'lucide-react-native';
import { useColorScheme, getColors } from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getTrainerClients,
  getWorkoutTemplatesForPlans,
  createWorkoutPlan,
  updateWorkoutPlan,
  getWorkoutPlan,
  createPlanSessions,
  deletePlanSessions,
  createSampleClientAssignment,
  ClientProfile,
  WorkoutTemplateForPlan,
  WorkoutPlan,
} from '@/lib/planDatabase';

const { width } = Dimensions.get('window');

type ScheduleType = 'weekly' | 'monthly' | 'custom';
type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

interface WeeklySchedule {
  [key in DayOfWeek]: string | null;
}

interface MonthlySchedule {
  [weekNumber: number]: WeeklySchedule;
}

interface CustomWorkout {
  id: string;
  date: string;
  templateId: string | null;
  label: string;
}

const scheduleTypeOptions = [
  {
    value: 'weekly',
    label: 'Weekly Repeat',
    description: 'Same pattern every week',
    icon: '🔄',
    color: '#3B82F6',
    gradient: ['#3B82F6', '#1D4ED8']
  },
  {
    value: 'monthly',
    label: 'Monthly Plan',
    description: 'Different patterns for each week',
    icon: '📅',
    color: '#10B981',
    gradient: ['#10B981', '#059669']
  },
  {
    value: 'custom',
    label: 'Custom Schedule',
    description: 'Specific dates with custom workouts',
    icon: '⚡',
    color: '#F59E0B',
    gradient: ['#F59E0B', '#D97706']
  }
];

export default function CreatePlanScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const styles = createStyles(colors);
  const { edit } = useLocalSearchParams();

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  // Form state
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [scheduleType, setScheduleType] = useState<ScheduleType>('weekly');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
  });

  // Schedule data
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({
    Monday: null,
    Tuesday: null,
    Wednesday: null,
    Thursday: null,
    Friday: null,
    Saturday: null,
    Sunday: null,
  });
  const [monthlySchedule, setMonthlySchedule] = useState<MonthlySchedule>({
    1: { ...weeklySchedule },
    2: { ...weeklySchedule },
    3: { ...weeklySchedule },
    4: { ...weeklySchedule },
  });
  const [customWorkouts, setCustomWorkouts] = useState<CustomWorkout[]>([]);

  // Data state
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplateForPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showScheduleTypePicker, setShowScheduleTypePicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Template picker state
  const [templatePickerContext, setTemplatePickerContext] = useState<{
    type: 'weekly' | 'monthly' | 'custom';
    day?: DayOfWeek;
    week?: number;
    customId?: string;
  } | null>(null);

  const [customWorkoutDate, setCustomWorkoutDate] = useState(new Date());

  const isEditing = !!edit;

  useEffect(() => {
    loadInitialData();
    
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading initial data...');
      
      const [clientsData, templatesData] = await Promise.all([
        getTrainerClients(),
        getWorkoutTemplatesForPlans(),
      ]);

      console.log('👥 Loaded clients:', clientsData);
      console.log('📋 Loaded templates:', templatesData);

      setClients(clientsData);
      setTemplates(templatesData);

      if (clientsData.length === 0) {
        console.log('⚠️ No clients found, showing alert');
        Alert.alert(
          'No Clients Found',
          'You don\'t have any assigned clients yet. Would you like to create a sample client assignment for testing?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Create Sample', 
              onPress: async () => {
                const success = await createSampleClientAssignment();
                if (success) {
                  const updatedClients = await getTrainerClients();
                  setClients(updatedClients);
                  Alert.alert('Success', 'Sample client assignment created!');
                } else {
                  Alert.alert('Error', 'Failed to create sample assignment. Please check if there are any clients in the system.');
                }
              }
            }
          ]
        );
      }

      if (isEditing && typeof edit === 'string') {
        await loadExistingPlan(edit);
      }

    } catch (error) {
      console.error('💥 Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingPlan = async (planId: string) => {
    try {
      const plan = await getWorkoutPlan(planId);
      if (plan) {
        setPlanName(plan.name);
        setPlanDescription(plan.description || '');
        setScheduleType(plan.schedule_type);
        setStartDate(new Date(plan.start_date));
        setEndDate(new Date(plan.end_date));

        const client = clients.find(c => c.id === plan.client_id);
        if (client) {
          setSelectedClient(client);
        }

        if (plan.schedule_data) {
          switch (plan.schedule_type) {
            case 'weekly':
              setWeeklySchedule(plan.schedule_data);
              break;
            case 'monthly':
              setMonthlySchedule(plan.schedule_data);
              break;
            case 'custom':
              setCustomWorkouts(plan.schedule_data);
              break;
          }
        }
      }
    } catch (error) {
      console.error('Error loading existing plan:', error);
      Alert.alert('Error', 'Failed to load plan data');
    }
  };

  const handleRefreshClients = async () => {
    try {
      console.log('🔄 Refreshing clients...');
      const clientsData = await getTrainerClients();
      setClients(clientsData);
      
      if (clientsData.length === 0) {
        Alert.alert(
          'No Clients Found',
          'Still no clients found. Make sure you have active client assignments in the database.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Success', `Found ${clientsData.length} client(s)`);
      }
    } catch (error) {
      console.error('Error refreshing clients:', error);
      Alert.alert('Error', 'Failed to refresh clients');
    }
  };

  const validateForm = () => {
    if (!planName.trim()) {
      Alert.alert('Missing Information', 'Please enter a plan name');
      return false;
    }

    if (!selectedClient) {
      Alert.alert('Missing Information', 'Please select a client');
      return false;
    }

    if (startDate >= endDate) {
      Alert.alert('Invalid Date Range', 'End date must be after start date');
      return false;
    }

    let hasWorkouts = false;
    switch (scheduleType) {
      case 'weekly':
        hasWorkouts = Object.values(weeklySchedule).some(templateId => templateId !== null);
        break;
      case 'monthly':
        hasWorkouts = Object.values(monthlySchedule).some(week =>
          Object.values(week).some(templateId => templateId !== null)
        );
        break;
      case 'custom':
        hasWorkouts = customWorkouts.length > 0;
        break;
    }

    if (!hasWorkouts) {
      Alert.alert('Missing Workouts', 'Please add at least one workout to the schedule');
      return false;
    }

    return true;
  };

  const handleSavePlan = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const planData = {
        client_id: selectedClient!.id,
        name: planName.trim(),
        description: planDescription.trim() || undefined,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        schedule_type: scheduleType,
        schedule_data: getScheduleData(),
      };

      let savedPlan: WorkoutPlan | null = null;

      if (isEditing && typeof edit === 'string') {
        savedPlan = await updateWorkoutPlan(edit, planData);
      } else {
        savedPlan = await createWorkoutPlan(planData);
      }

      if (savedPlan) {
        await generatePlanSessions(savedPlan);

        Alert.alert(
          'Success! 🎉',
          `Plan ${isEditing ? 'updated' : 'created'} successfully!`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', 'Failed to save plan');
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      Alert.alert('Error', 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const getScheduleData = () => {
    switch (scheduleType) {
      case 'weekly':
        return weeklySchedule;
      case 'monthly':
        return monthlySchedule;
      case 'custom':
        return customWorkouts;
      default:
        return {};
    }
  };

  const generatePlanSessions = async (plan: WorkoutPlan) => {
    try {
      if (isEditing) {
        await deletePlanSessions(plan.id);
      }

      const sessions: any[] = [];
      const start = new Date(plan.start_date);
      const end = new Date(plan.end_date);

      switch (plan.schedule_type) {
        case 'weekly':
          generateWeeklySessions(sessions, start, end, plan.schedule_data, plan.id);
          break;
        case 'monthly':
          generateMonthlySessions(sessions, start, end, plan.schedule_data, plan.id);
          break;
        case 'custom':
          generateCustomSessions(sessions, plan.schedule_data, plan.id);
          break;
      }

      if (sessions.length > 0) {
        await createPlanSessions(sessions);
      }
    } catch (error) {
      console.error('Error generating plan sessions:', error);
    }
  };

  const generateWeeklySessions = (sessions: any[], start: Date, end: Date, schedule: WeeklySchedule, planId: string) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const current = new Date(start);

    while (current <= end) {
      const dayName = dayNames[current.getDay()] as DayOfWeek;
      const templateId = schedule[dayName];

      if (templateId) {
        sessions.push({
          plan_id: planId,
          template_id: templateId,
          scheduled_date: current.toISOString().split('T')[0],
          day_of_week: dayName,
          status: 'scheduled',
        });
      }

      current.setDate(current.getDate() + 1);
    }
  };

  const generateMonthlySessions = (sessions: any[], start: Date, end: Date, schedule: MonthlySchedule, planId: string) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const current = new Date(start);

    while (current <= end) {
      const weekOfMonth = Math.ceil(current.getDate() / 7);
      const weekSchedule = schedule[weekOfMonth];

      if (weekSchedule) {
        const dayName = dayNames[current.getDay()] as DayOfWeek;
        const templateId = weekSchedule[dayName];

        if (templateId) {
          sessions.push({
            plan_id: planId,
            template_id: templateId,
            scheduled_date: current.toISOString().split('T')[0],
            day_of_week: dayName,
            week_number: weekOfMonth,
            status: 'scheduled',
          });
        }
      }

      current.setDate(current.getDate() + 1);
    }
  };

  const generateCustomSessions = (sessions: any[], customWorkouts: CustomWorkout[], planId: string) => {
    customWorkouts.forEach(workout => {
      if (workout.templateId) {
        sessions.push({
          plan_id: planId,
          template_id: workout.templateId,
          scheduled_date: workout.date,
          status: 'scheduled',
          notes: workout.label,
        });
      }
    });
  };

  const handleTemplateSelect = (templateId: string | null) => {
    if (!templatePickerContext) return;

    const { type, day, week, customId } = templatePickerContext;

    switch (type) {
      case 'weekly':
        if (day) {
          setWeeklySchedule(prev => ({ ...prev, [day]: templateId }));
        }
        break;
      case 'monthly':
        if (day && week) {
          setMonthlySchedule(prev => ({
            ...prev,
            [week]: { ...prev[week], [day]: templateId }
          }));
        }
        break;
      case 'custom':
        if (customId) {
          setCustomWorkouts(prev =>
            prev.map(workout =>
              workout.id === customId ? { ...workout, templateId } : workout
            )
          );
        }
        break;
    }

    setShowTemplatePicker(false);
    setTemplatePickerContext(null);
  };

  const openTemplatePicker = (context: typeof templatePickerContext) => {
    setTemplatePickerContext(context);
    setShowTemplatePicker(true);
  };

  const addCustomWorkout = () => {
    setShowCustomDatePicker(true);
  };

  const handleCustomDateSelect = (event: any, selectedDate?: Date) => {
    setShowCustomDatePicker(false);
    if (selectedDate) {
      const newWorkout: CustomWorkout = {
        id: Date.now().toString(),
        date: selectedDate.toISOString().split('T')[0],
        templateId: null,
        label: `Workout ${customWorkouts.length + 1}`,
      };
      setCustomWorkouts(prev => [...prev, newWorkout].sort((a, b) => a.date.localeCompare(b.date)));
    }
  };

  const removeCustomWorkout = (id: string) => {
    setCustomWorkouts(prev => prev.filter(workout => workout.id !== id));
  };

  const copyWeekToAll = (sourceWeek: number) => {
    const sourceSchedule = monthlySchedule[sourceWeek];
    setMonthlySchedule(prev => ({
      1: { ...sourceSchedule },
      2: { ...sourceSchedule },
      3: { ...sourceSchedule },
      4: { ...sourceSchedule },
    }));
  };

  const getTemplateName = (templateId: string | null): string => {
    if (!templateId) return 'Rest Day';
    const template = templates.find(t => t.id === templateId);
    return template ? template.name : 'Unknown Template';
  };

  const getTemplateCategory = (templateId: string | null): string => {
    if (!templateId) return '';
    const template = templates.find(t => t.id === templateId);
    return template ? template.category : '';
  };

  const getTemplateDuration = (templateId: string | null): number => {
    if (!templateId) return 0;
    const template = templates.find(t => t.id === templateId);
    return template ? template.estimated_duration_minutes : 0;
  };

  const getScheduleStats = () => {
    let totalWorkouts = 0;
    let totalDuration = 0;

    switch (scheduleType) {
      case 'weekly':
        Object.values(weeklySchedule).forEach(templateId => {
          if (templateId) {
            totalWorkouts++;
            totalDuration += getTemplateDuration(templateId);
          }
        });
        break;
      case 'monthly':
        Object.values(monthlySchedule).forEach(week => {
          Object.values(week).forEach(templateId => {
            if (templateId) {
              totalWorkouts++;
              totalDuration += getTemplateDuration(templateId);
            }
          });
        });
        totalWorkouts = Math.ceil(totalWorkouts / 4); // Average per week
        totalDuration = Math.ceil(totalDuration / 4);
        break;
      case 'custom':
        customWorkouts.forEach(workout => {
          if (workout.templateId) {
            totalWorkouts++;
            totalDuration += getTemplateDuration(workout.templateId);
          }
        });
        break;
    }

    return { totalWorkouts, totalDuration };
  };

  const renderProgressHeader = () => {
    const stats = getScheduleStats();
    const progress = (planName && selectedClient && stats.totalWorkouts > 0) ? 100 : 
                    (planName && selectedClient) ? 75 :
                    planName ? 50 : 25;

    return (
      <View style={styles.progressHeader}>
        <LinearGradient
          colors={colorScheme === 'dark' ? ['#1E293B', '#334155'] : ['#F8FAFC', '#E2E8F0']}
          style={styles.progressCard}
        >
          <View style={styles.progressInfo}>
            <Text style={styles.progressTitle}>Plan Creation Progress</Text>
            <Text style={styles.progressSubtitle}>{progress}% Complete</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View 
                style={[
                  styles.progressBarFill,
                  { width: `${progress}%` }
                ]}
              />
            </View>
          </View>
          {stats.totalWorkouts > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Activity size={16} color={colors.primary} />
                <Text style={styles.statText}>{stats.totalWorkouts} workouts/week</Text>
              </View>
              <View style={styles.statItem}>
                <Timer size={16} color={colors.success} />
                <Text style={styles.statText}>{stats.totalDuration} min/week</Text>
              </View>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  const renderWeeklySchedule = () => {
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return (
      <View style={styles.scheduleContainer}>
        <View style={styles.scheduleHeader}>
          <View style={styles.scheduleHeaderLeft}>
            <Text style={styles.scheduleTitle}>Weekly Schedule</Text>
            <Text style={styles.scheduleSubtitle}>Set your weekly workout pattern</Text>
          </View>
          <View style={styles.scheduleIcon}>
            <Text style={styles.scheduleEmoji}>🔄</Text>
          </View>
        </View>
        
        <View style={styles.daysGrid}>
          {days.map(day => {
            const templateId = weeklySchedule[day];
            const hasWorkout = templateId !== null;
            
            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayCard,
                  hasWorkout && styles.dayCardActive
                ]}
                onPress={() => openTemplatePicker({ type: 'weekly', day })}
              >
                <Text style={styles.dayName}>{day.slice(0, 3)}</Text>
                {hasWorkout ? (
                  <View style={styles.workoutInfo}>
                    <Dumbbell size={16} color={colors.primary} />
                    <Text style={styles.workoutName} numberOfLines={2}>
                      {getTemplateName(templateId)}
                    </Text>
                    <Text style={styles.workoutDuration}>
                      {getTemplateDuration(templateId)}min
                    </Text>
                  </View>
                ) : (
                  <View style={styles.restDay}>
                    <Plus size={20} color={colors.textTertiary} />
                    <Text style={styles.restDayText}>Add Workout</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderMonthlySchedule = () => {
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return (
      <View style={styles.scheduleContainer}>
        <View style={styles.scheduleHeader}>
          <View style={styles.scheduleHeaderLeft}>
            <Text style={styles.scheduleTitle}>Monthly Schedule</Text>
            <Text style={styles.scheduleSubtitle}>Different patterns for each week</Text>
          </View>
          <View style={styles.scheduleIcon}>
            <Text style={styles.scheduleEmoji}>📅</Text>
          </View>
        </View>

        {[1, 2, 3, 4].map(week => (
          <View key={week} style={styles.weekContainer}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekTitle}>Week {week}</Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyWeekToAll(week)}
              >
                <Copy size={14} color={colors.primary} />
                <Text style={styles.copyButtonText}>Copy to All</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.weekDaysGrid}>
              {days.map(day => {
                const templateId = monthlySchedule[week][day];
                const hasWorkout = templateId !== null;
                
                return (
                  <TouchableOpacity
                    key={`${week}-${day}`}
                    style={[
                      styles.monthlyDayCard,
                      hasWorkout && styles.monthlyDayCardActive
                    ]}
                    onPress={() => openTemplatePicker({ type: 'monthly', day, week })}
                  >
                    <Text style={styles.monthlyDayName}>{day.slice(0, 3)}</Text>
                    {hasWorkout ? (
                      <View style={styles.monthlyWorkoutInfo}>
                        <Text style={styles.monthlyWorkoutName} numberOfLines={1}>
                          {getTemplateName(templateId)}
                        </Text>
                        <Text style={styles.monthlyWorkoutDuration}>
                          {getTemplateDuration(templateId)}min
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.monthlyRestDay}>
                        <Plus size={16} color={colors.textTertiary} />
                      </View>
                    )}
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
      <View style={styles.scheduleContainer}>
        <View style={styles.scheduleHeader}>
          <View style={styles.scheduleHeaderLeft}>
            <Text style={styles.scheduleTitle}>Custom Schedule</Text>
            <Text style={styles.scheduleSubtitle}>Add workouts on specific dates</Text>
          </View>
          <View style={styles.scheduleIcon}>
            <Text style={styles.scheduleEmoji}>⚡</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.addCustomButton} onPress={addCustomWorkout}>
          <LinearGradient
            colors={['#3B82F6', '#1D4ED8']}
            style={styles.addCustomGradient}
          >
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.addCustomText}>Add Custom Workout</Text>
          </LinearGradient>
        </TouchableOpacity>

        {customWorkouts.length === 0 ? (
          <View style={styles.emptyCustom}>
            <Calendar size={48} color={colors.textTertiary} />
            <Text style={styles.emptyCustomTitle}>No custom workouts yet</Text>
            <Text style={styles.emptyCustomText}>
              Add specific workout dates to create your custom schedule
            </Text>
          </View>
        ) : (
          <View style={styles.customWorkoutsList}>
            {customWorkouts.map(workout => (
              <View key={workout.id} style={styles.customWorkoutCard}>
                <View style={styles.customWorkoutLeft}>
                  <View style={styles.customDateContainer}>
                    <Text style={styles.customWorkoutDate}>
                      {new Date(workout.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Text>
                    <Text style={styles.customWorkoutDay}>
                      {new Date(workout.date).toLocaleDateString('en-US', { 
                        weekday: 'short' 
                      })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.customTemplateButton}
                    onPress={() => openTemplatePicker({ type: 'custom', customId: workout.id })}
                  >
                    <Text style={styles.customTemplateName}>
                      {getTemplateName(workout.templateId)}
                    </Text>
                    <ChevronDown size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.removeCustomButton}
                  onPress={() => removeCustomWorkout(workout.id)}
                >
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LinearGradient
            colors={colorScheme === 'dark' ? ['#1E293B', '#334155'] : ['#F8FAFC', '#E2E8F0']}
            style={styles.loadingCard}
          >
            <Activity size={32} color={colors.primary} />
            <Text style={styles.loadingText}>Loading plan data...</Text>
            <Text style={styles.loadingSubtext}>Setting up your workspace</Text>
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>
            {isEditing ? 'Edit Plan' : 'Create Workout Plan'}
          </Text>
          <Text style={styles.subtitle}>
            {isEditing ? 'Update your training plan' : 'Design a personalized training program'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSavePlan}
          disabled={saving}
        >
          <LinearGradient
            colors={saving ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']}
            style={styles.saveButtonGradient}
          >
            {saving ? (
              <Activity size={16} color="#FFFFFF" />
            ) : (
              <Save size={16} color="#FFFFFF" />
            )}
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView 
        style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]} 
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Header */}
        {renderProgressHeader()}

        {/* Basic Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Target size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Plan Information</Text>
          </View>
          
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Plan Name *</Text>
            <TextInput
              style={styles.textInput}
              value={planName}
              onChangeText={setPlanName}
              placeholder="e.g., Summer Shred Program"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={planDescription}
              onChangeText={setPlanDescription}
              placeholder="Describe the goals and focus of this workout plan..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Client Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Client Assignment</Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={handleRefreshClients}
            >
              <RefreshCw size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          {clients.length === 0 ? (
            <View style={styles.noClientsContainer}>
              <LinearGradient
                colors={colorScheme === 'dark' ? ['#1E293B', '#334155'] : ['#FEF3C7', '#FDE68A']}
                style={styles.noClientsCard}
              >
                <Users size={48} color={colors.warning} />
                <Text style={styles.noClientsTitle}>No Clients Found</Text>
                <Text style={styles.noClientsText}>
                  You don't have any assigned clients yet. Make sure you have active client assignments in the database.
                </Text>
                <TouchableOpacity 
                  style={styles.refreshClientsButton}
                  onPress={handleRefreshClients}
                >
                  <RefreshCw size={16} color={colors.primary} />
                  <Text style={styles.refreshClientsText}>Refresh Clients</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.picker, selectedClient && styles.pickerSelected]}
              onPress={() => setShowClientPicker(true)}
            >
              <View style={styles.pickerLeft}>
                <View style={[styles.pickerIcon, selectedClient && styles.pickerIconSelected]}>
                  <User size={20} color={selectedClient ? '#FFFFFF' : colors.textSecondary} />
                </View>
                <View style={styles.pickerContent}>
                  <Text style={[
                    styles.pickerText,
                    !selectedClient && styles.placeholderText
                  ]}>
                    {selectedClient ? selectedClient.full_name : 'Select a client'}
                  </Text>
                  {selectedClient && (
                    <Text style={styles.pickerSubtext}>{selectedClient.email}</Text>
                  )}
                </View>
              </View>
              <ChevronDown size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Schedule Type */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Schedule Type</Text>
          </View>
          
          <View style={styles.scheduleTypeGrid}>
            {scheduleTypeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.scheduleTypeCard,
                  scheduleType === option.value && styles.scheduleTypeCardSelected
                ]}
                onPress={() => setScheduleType(option.value as ScheduleType)}
              >
                <LinearGradient
                  colors={scheduleType === option.value ? option.gradient : ['transparent', 'transparent']}
                  style={styles.scheduleTypeGradient}
                >
                  <Text style={styles.scheduleTypeEmoji}>{option.icon}</Text>
                  <Text style={[
                    styles.scheduleTypeLabel,
                    scheduleType === option.value && styles.scheduleTypeLabelSelected
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={[
                    styles.scheduleTypeDescription,
                    scheduleType === option.value && styles.scheduleTypeDescriptionSelected
                  ]}>
                    {option.description}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date Range */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Clock size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Date Range</Text>
          </View>
          
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Calendar size={16} color={colors.primary} />
                <Text style={styles.dateButtonText}>
                  {startDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Calendar size={16} color={colors.primary} />
                <Text style={styles.dateButtonText}>
                  {endDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.durationInfo}>
            <Text style={styles.durationText}>
              Duration: {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days
            </Text>
          </View>
        </View>

        {/* Schedule Builder */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Dumbbell size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Workout Schedule</Text>
          </View>
          
          {scheduleType === 'weekly' && renderWeeklySchedule()}
          {scheduleType === 'monthly' && renderMonthlySchedule()}
          {scheduleType === 'custom' && renderCustomSchedule()}
        </View>

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* Client Picker Modal */}
      <Modal
        visible={showClientPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClientPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Client</Text>
            <TouchableOpacity onPress={() => setShowClientPicker(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.clientList}>
            {clients.map((client) => (
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
                <View style={styles.clientAvatar}>
                  <Text style={styles.clientAvatarText}>
                    {client.full_name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{client.full_name}</Text>
                  <Text style={styles.clientEmail}>{client.email}</Text>
                  <Text style={styles.clientJoined}>
                    Joined {new Date(client.created_at).toLocaleDateString()}
                  </Text>
                </View>
                {selectedClient?.id === client.id && (
                  <CheckCircle size={24} color={colors.success} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Template Picker Modal */}
      <Modal
        visible={showTemplatePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTemplatePicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Template</Text>
            <TouchableOpacity onPress={() => setShowTemplatePicker(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.templateList}>
            {/* Rest Day Option */}
            <TouchableOpacity
              style={styles.templateOption}
              onPress={() => handleTemplateSelect(null)}
            >
              <View style={styles.templateIcon}>
                <Text style={styles.templateEmoji}>😴</Text>
              </View>
              <View style={styles.templateInfo}>
                <Text style={styles.templateName}>Rest Day</Text>
                <Text style={styles.templateCategory}>Recovery & Rest</Text>
                <Text style={styles.templateDescription}>No workout scheduled</Text>
              </View>
            </TouchableOpacity>

            {/* Template Options */}
            {templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateOption}
                onPress={() => handleTemplateSelect(template.id)}
              >
                <View style={styles.templateIcon}>
                  <Dumbbell size={24} color={colors.primary} />
                </View>
                <View style={styles.templateInfo}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateCategory}>{template.category}</Text>
                  <View style={styles.templateMeta}>
                    <View style={styles.templateMetaItem}>
                      <Timer size={14} color={colors.textSecondary} />
                      <Text style={styles.templateDuration}>
                        {template.estimated_duration_minutes} min
                      </Text>
                    </View>
                    {template.is_public && (
                      <View style={styles.templateMetaItem}>
                        <Star size={14} color={colors.warning} />
                        <Text style={styles.templatePublic}>Public</Text>
                      </View>
                    )}
                  </View>
                </View>
                <ChevronDown size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate) {
              setStartDate(selectedDate);
            }
          }}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate) {
              setEndDate(selectedDate);
            }
          }}
        />
      )}

      {showCustomDatePicker && (
        <DateTimePicker
          value={customWorkoutDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleCustomDateSelect}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingCard: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    marginTop: 16,
  },
  loadingSubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  saveButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  saveButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  progressHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  progressCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  progressInfo: {
    marginBottom: 16,
  },
  progressTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  progressSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressBarContainer: {
    marginBottom: 16,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    flex: 1,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formField: {
    marginBottom: 20,
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
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  pickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  pickerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerIconSelected: {
    backgroundColor: colors.primary,
  },
  pickerContent: {
    flex: 1,
  },
  pickerText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: colors.text,
  },
  pickerSubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  placeholderText: {
    color: colors.textTertiary,
  },
  noClientsContainer: {
    marginTop: 8,
  },
  noClientsCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  noClientsTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noClientsText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  refreshClientsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  refreshClientsText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.primary,
  },
  scheduleTypeGrid: {
    gap: 12,
  },
  scheduleTypeCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
  },
  scheduleTypeCardSelected: {
    borderColor: colors.primary,
  },
  scheduleTypeGradient: {
    padding: 20,
    alignItems: 'center',
  },
  scheduleTypeEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  scheduleTypeLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  scheduleTypeLabelSelected: {
    color: '#FFFFFF',
  },
  scheduleTypeDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scheduleTypeDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dateField: {
    flex: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  dateButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.text,
  },
  durationInfo: {
    marginTop: 12,
    alignItems: 'center',
  },
  durationText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  scheduleContainer: {
    marginTop: 8,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  scheduleHeaderLeft: {
    flex: 1,
  },
  scheduleTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  scheduleSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scheduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleEmoji: {
    fontSize: 24,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayCard: {
    width: (width - 56) / 4,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
  },
  dayCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  dayName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: colors.text,
    marginBottom: 8,
  },
  workoutInfo: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  workoutName: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    color: colors.text,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  workoutDuration: {
    fontFamily: 'Inter-Regular',
    fontSize: 9,
    color: colors.textSecondary,
  },
  restDay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  restDayText: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  weekContainer: {
    marginBottom: 24,
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
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  copyButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: colors.primary,
  },
  weekDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthlyDayCard: {
    width: (width - 56) / 7,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 60,
  },
  monthlyDayCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  monthlyDayName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: colors.text,
    marginBottom: 4,
  },
  monthlyWorkoutInfo: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  monthlyWorkoutName: {
    fontFamily: 'Inter-Medium',
    fontSize: 8,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  monthlyWorkoutDuration: {
    fontFamily: 'Inter-Regular',
    fontSize: 7,
    color: colors.textSecondary,
  },
  monthlyRestDay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  addCustomButton: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addCustomGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  addCustomText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  emptyCustom: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCustomTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyCustomText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  customWorkoutsList: {
    gap: 12,
  },
  customWorkoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customWorkoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  customDateContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  customWorkoutDate: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.text,
  },
  customWorkoutDay: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  customTemplateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  customTemplateName: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.text,
  },
  removeCustomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: colors.text,
  },
  clientList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  clientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedClientOption: {
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  clientAvatarText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#FFFFFF',
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
    marginBottom: 2,
  },
  clientJoined: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textTertiary,
  },
  templateList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  templateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  templateEmoji: {
    fontSize: 24,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  templateCategory: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.primary,
    marginBottom: 6,
  },
  templateDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  templateMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  templateMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  templateDuration: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  templatePublic: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.warning,
  },
});