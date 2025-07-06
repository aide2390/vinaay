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
  ChevronDown,
  Calendar,
  X,
  Plus,
  Trash2,
  Copy,
  Save
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
  ClientProfile,
  WorkoutPlan,
} from '@/lib/planDatabase';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type ScheduleType = 'weekly' | 'monthly' | 'custom';

interface CustomScheduleDay {
  id: string;
  date: string;
  templateId: string | null;
  label?: string;
}

interface WorkoutTemplate {
  id: string;
  name: string;
  category: string;
  estimated_duration_minutes: number;
}

export default function CreatePlanScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const styles = createStyles(colors);
  const { edit } = useLocalSearchParams();

  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 28); // 4 weeks default
    return date;
  });
  
  // Schedule type and data
  const [scheduleType, setScheduleType] = useState<ScheduleType>('weekly');
  const [weeklySchedule, setWeeklySchedule] = useState<{ [key: string]: string | null }>({
    Monday: null,
    Tuesday: null,
    Wednesday: null,
    Thursday: null,
    Friday: null,
    Saturday: null,
    Sunday: null,
  });
  const [monthlySchedule, setMonthlySchedule] = useState<{ [week: number]: { [key: string]: string | null } }>({
    1: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null, Sunday: null },
    2: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null, Sunday: null },
    3: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null, Sunday: null },
    4: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null, Sunday: null },
  });
  const [customSchedule, setCustomSchedule] = useState<CustomScheduleDay[]>([]);

  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showScheduleTypePicker, setShowScheduleTypePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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
      const [loadedClients, loadedTemplates] = await Promise.all([
        getTrainerClients(),
        getWorkoutTemplatesForPlans()
      ]);
      setClients(loadedClients);
      setTemplates(loadedTemplates);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    }
  };

  const loadPlan = async () => {
    try {
      const planId = edit as string;
      const plan = await getWorkoutPlan(planId);
      if (plan) {
        setPlanName(plan.name);
        setPlanDescription(plan.description || '');
        setStartDate(new Date(plan.start_date));
        setEndDate(new Date(plan.end_date));
        setScheduleType(plan.schedule_type);
        
        // Load schedule data based on type
        if (plan.schedule_type === 'weekly') {
          setWeeklySchedule(plan.schedule_data || {});
        } else if (plan.schedule_type === 'monthly') {
          setMonthlySchedule(plan.schedule_data || {});
        } else if (plan.schedule_type === 'custom') {
          setCustomSchedule(plan.schedule_data || []);
        }
        
        const client = clients.find(c => c.id === plan.client_id);
        if (client) {
          setSelectedClient(client);
        }
      }
    } catch (error) {
      console.error('Error loading plan:', error);
      Alert.alert('Error', 'Failed to load plan');
    }
  };

  const generateId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const handleDayPress = (day: string, week?: number) => {
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

    if (endDate <= startDate) {
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
    }

    setLoading(true);
    try {
      const planData = {
        client_id: selectedClient.id,
        name: planName.trim(),
        description: planDescription.trim() || undefined,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        schedule_type: scheduleType,
        schedule_data: finalSchedule,
      };

      let savedPlan;
      if (isEditing) {
        savedPlan = await updateWorkoutPlan(edit as string, planData);
      } else {
        savedPlan = await createWorkoutPlan(planData);
      }

      if (savedPlan) {
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
      setLoading(false);
    }
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const renderWeeklySchedule = () => {
    const renderDayCard = (day: string) => {
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
          <Save size={16} color="#FFFFFF" />
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
                {selectedClient?.full_name || 'Select a client'}
              </Text>
              <ChevronDown size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formFieldHalf}>
              <Text style={styles.fieldLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Calendar size={16} color={colors.textSecondary} />
                <Text style={styles.pickerText}>
                  {startDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formFieldHalf}>
              <Text style={styles.fieldLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Calendar size={16} color={colors.textSecondary} />
                <Text style={styles.pickerText}>
                  {endDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
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
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onStartDateChange}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onEndDateChange}
        />
      )}

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
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedText}>✓</Text>
                  </View>
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
            <Text style={styles.modalTitle}>Select Schedule Type</Text>
            <TouchableOpacity onPress={() => setShowScheduleTypePicker(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.scheduleTypeList}>
            {(['weekly', 'monthly', 'custom'] as ScheduleType[]).map((type) => (
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
                    {template.estimated_duration_minutes} min • {template.category}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
  },
  selectedClientOption: {
    backgroundColor: `${colors.primary}20`,
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
    paddingHorizontal: 20,
  },
  scheduleTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginVertical: 6,
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
    paddingHorizontal: 20,
  },
  templateOption: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
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
  },
});