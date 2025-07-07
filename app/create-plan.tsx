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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  RefreshCw
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

export default function CreatePlanScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const styles = createStyles(colors);
  const { edit } = useLocalSearchParams();

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
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading initial data...');
      
      // Load clients and templates in parallel
      const [clientsData, templatesData] = await Promise.all([
        getTrainerClients(),
        getWorkoutTemplatesForPlans(),
      ]);

      console.log('👥 Loaded clients:', clientsData);
      console.log('📋 Loaded templates:', templatesData);

      setClients(clientsData);
      setTemplates(templatesData);

      // If no clients found, show helpful message
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
                  // Reload clients
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

      // Load existing plan if editing
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

        // Find and set the client
        const client = clients.find(c => c.id === plan.client_id);
        if (client) {
          setSelectedClient(client);
        }

        // Load schedule data based on type
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

  const handleSavePlan = async () => {
    // Validation
    if (!planName.trim()) {
      Alert.alert('Error', 'Please enter a plan name');
      return;
    }

    if (!selectedClient) {
      Alert.alert('Error', 'Please select a client');
      return;
    }

    if (startDate >= endDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    // Validate schedule has at least one workout
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
      Alert.alert('Error', 'Please add at least one workout to the schedule');
      return;
    }

    try {
      setSaving(true);

      const planData = {
        client_id: selectedClient.id,
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
        // Generate plan sessions
        await generatePlanSessions(savedPlan);

        Alert.alert(
          'Success',
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
      // Delete existing sessions if updating
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

  const renderWeeklySchedule = () => {
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return (
      <View style={styles.scheduleContainer}>
        <Text style={styles.scheduleTitle}>Weekly Schedule</Text>
        {days.map(day => (
          <View key={day} style={styles.dayRow}>
            <Text style={styles.dayLabel}>{day}</Text>
            <TouchableOpacity
              style={styles.templateButton}
              onPress={() => openTemplatePicker({ type: 'weekly', day })}
            >
              <Text style={styles.templateButtonText}>
                {getTemplateName(weeklySchedule[day])}
              </Text>
              <ChevronDown size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  const renderMonthlySchedule = () => {
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return (
      <View style={styles.scheduleContainer}>
        <Text style={styles.scheduleTitle}>Monthly Schedule</Text>
        {[1, 2, 3, 4].map(week => (
          <View key={week} style={styles.weekContainer}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekTitle}>Week {week}</Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyWeekToAll(week)}
              >
                <Copy size={16} color={colors.primary} />
                <Text style={styles.copyButtonText}>Copy to All</Text>
              </TouchableOpacity>
            </View>
            {days.map(day => (
              <View key={`${week}-${day}`} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{day}</Text>
                <TouchableOpacity
                  style={styles.templateButton}
                  onPress={() => openTemplatePicker({ type: 'monthly', day, week })}
                >
                  <Text style={styles.templateButtonText}>
                    {getTemplateName(monthlySchedule[week][day])}
                  </Text>
                  <ChevronDown size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const renderCustomSchedule = () => {
    return (
      <View style={styles.scheduleContainer}>
        <View style={styles.customHeader}>
          <Text style={styles.scheduleTitle}>Custom Schedule</Text>
          <TouchableOpacity style={styles.addButton} onPress={addCustomWorkout}>
            <Plus size={16} color={colors.primary} />
            <Text style={styles.addButtonText}>Add Workout</Text>
          </TouchableOpacity>
        </View>

        {customWorkouts.length === 0 ? (
          <View style={styles.emptyCustom}>
            <Text style={styles.emptyCustomText}>No custom workouts added yet</Text>
          </View>
        ) : (
          customWorkouts.map(workout => (
            <View key={workout.id} style={styles.customWorkoutRow}>
              <View style={styles.customWorkoutInfo}>
                <Text style={styles.customWorkoutDate}>
                  {new Date(workout.date).toLocaleDateString()}
                </Text>
                <TouchableOpacity
                  style={styles.templateButton}
                  onPress={() => openTemplatePicker({ type: 'custom', customId: workout.id })}
                >
                  <Text style={styles.templateButtonText}>
                    {getTemplateName(workout.templateId)}
                  </Text>
                  <ChevronDown size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeCustomWorkout(workout.id)}
              >
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading plan data...</Text>
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
        <Text style={styles.title}>
          {isEditing ? 'Edit Plan' : 'Create Workout Plan'}
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSavePlan}
          disabled={saving}
        >
          <Save size={16} color="#FFFFFF" />
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Information */}
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
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={planDescription}
              onChangeText={setPlanDescription}
              placeholder="Describe this workout plan..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Client Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Client Assignment *</Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={handleRefreshClients}
            >
              <RefreshCw size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          {clients.length === 0 ? (
            <View style={styles.noClientsContainer}>
              <Users size={48} color={colors.textTertiary} />
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
            </View>
          ) : (
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowClientPicker(true)}
            >
              <User size={20} color={colors.textSecondary} />
              <Text style={[
                styles.pickerText,
                !selectedClient && styles.placeholderText
              ]}>
                {selectedClient ? selectedClient.full_name : 'Select a client'}
              </Text>
              <ChevronDown size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Schedule Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule Type *</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowScheduleTypePicker(true)}
          >
            <Calendar size={20} color={colors.textSecondary} />
            <Text style={styles.pickerText}>
              {scheduleType === 'weekly' ? 'Weekly Repeat' :
               scheduleType === 'monthly' ? 'Monthly Plan' : 'Custom Schedule'}
            </Text>
            <ChevronDown size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Date Range */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date Range *</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Calendar size={16} color={colors.textSecondary} />
                <Text style={styles.dateButtonText}>
                  {startDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Calendar size={16} color={colors.textSecondary} />
                <Text style={styles.dateButtonText}>
                  {endDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Schedule Builder */}
        <View style={styles.section}>
          {scheduleType === 'weekly' && renderWeeklySchedule()}
          {scheduleType === 'monthly' && renderMonthlySchedule()}
          {scheduleType === 'custom' && renderCustomSchedule()}
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
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{client.full_name}</Text>
                  <Text style={styles.clientEmail}>{client.email}</Text>
                </View>
                {selectedClient?.id === client.id && (
                  <Text style={styles.selectedIndicator}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Schedule Type Picker Modal */}
      <Modal
        visible={showScheduleTypePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowScheduleTypePicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Schedule Type</Text>
            <TouchableOpacity onPress={() => setShowScheduleTypePicker(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.scheduleTypeList}>
            {[
              { value: 'weekly', label: 'Weekly Repeat', description: 'Same pattern every week' },
              { value: 'monthly', label: 'Monthly Plan', description: 'Different patterns for each week' },
              { value: 'custom', label: 'Custom Schedule', description: 'Specific dates with custom workouts' },
            ].map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.scheduleTypeOption,
                  scheduleType === type.value && styles.selectedScheduleTypeOption
                ]}
                onPress={() => {
                  setScheduleType(type.value as ScheduleType);
                  setShowScheduleTypePicker(false);
                }}
              >
                <View style={styles.scheduleTypeInfo}>
                  <Text style={styles.scheduleTypeLabel}>{type.label}</Text>
                  <Text style={styles.scheduleTypeDescription}>{type.description}</Text>
                </View>
                {scheduleType === type.value && (
                  <Text style={styles.selectedIndicator}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
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
              <View style={styles.templateInfo}>
                <Text style={styles.templateName}>Rest Day</Text>
                <Text style={styles.templateCategory}>No workout scheduled</Text>
              </View>
            </TouchableOpacity>

            {/* Template Options */}
            {templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateOption}
                onPress={() => handleTemplateSelect(template.id)}
              >
                <View style={styles.templateInfo}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateCategory}>{template.category}</Text>
                  <Text style={styles.templateDuration}>
                    {template.estimated_duration_minutes} minutes
                  </Text>
                </View>
                <Dumbbell size={20} color={colors.primary} />
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
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.textSecondary,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 16,
  },
  refreshButton: {
    padding: 4,
  },
  formField: {
    marginBottom: 16,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  pickerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  placeholderText: {
    color: colors.textTertiary,
  },
  noClientsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
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
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  refreshClientsText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.primary,
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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  dateButtonText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
  },
  scheduleContainer: {
    marginTop: 8,
  },
  scheduleTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.text,
    width: 80,
  },
  templateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  templateButtonText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.text,
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
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  copyButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.primary,
  },
  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  addButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.primary,
  },
  emptyCustom: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCustomText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  customWorkoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customWorkoutInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customWorkoutDate: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.text,
    width: 100,
  },
  removeButton: {
    padding: 8,
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
  },
  clientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
  },
  selectedClientOption: {
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
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
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: colors.primary,
  },
  scheduleTypeList: {
    padding: 20,
  },
  scheduleTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  selectedScheduleTypeOption: {
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  scheduleTypeInfo: {
    flex: 1,
  },
  scheduleTypeLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  scheduleTypeDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  templateList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  templateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
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
    marginBottom: 2,
  },
  templateDuration: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
});