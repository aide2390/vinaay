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
  Plus, 
  Search,
  X,
  ChevronDown,
  Trash2,
  GripVertical
} from 'lucide-react-native';
import { useColorScheme, getColors } from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import { WorkoutTemplate, Exercise, TemplateExercise } from '@/types/workout';
import { saveTemplate, getTemplate, getExercises } from '@/utils/storage';

const templateCategories = [
  'Strength',
  'Cardio', 
  'Bodyweight',
  'HIIT',
  'Flexibility',
  'Athletic Performance',
  'Rehabilitation',
  'Full Body',
  'Upper Body',
  'Lower Body',
];

export default function CreateTemplateScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const styles = createStyles(colors);
  const { edit, duplicate } = useLocalSearchParams();

  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('60');
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);
  
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditing = !!edit;
  const isDuplicating = !!duplicate;

  useEffect(() => {
    loadExercises();
    if (isEditing || isDuplicating) {
      loadTemplate();
    }
  }, []);

  const loadExercises = async () => {
    try {
      const loadedExercises = await getExercises();
      setExercises(loadedExercises);
    } catch (error) {
      console.error('Error loading exercises:', error);
    }
  };

  const loadTemplate = async () => {
    try {
      const templateId = (edit || duplicate) as string;
      const template = await getTemplate(templateId);
      if (template) {
        setTemplateName(isDuplicating ? `${template.name} (Copy)` : template.name);
        setTemplateDescription(template.description || '');
        setSelectedCategory(template.category);
        setEstimatedDuration(template.duration.toString());
        setTemplateExercises(template.exercises);
      }
    } catch (error) {
      console.error('Error loading template:', error);
      Alert.alert('Error', 'Failed to load template');
    }
  };

  const generateId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const handleAddExercise = (exercise: Exercise) => {
    const templateExercise: TemplateExercise = {
      id: generateId(),
      exerciseId: exercise.id,
      exercise,
      sets: [
        { reps: 10, weight: 0, restTime: 60 },
        { reps: 10, weight: 0, restTime: 60 },
        { reps: 10, weight: 0, restTime: 60 },
      ],
      order: templateExercises.length,
    };

    setTemplateExercises(prev => [...prev, templateExercise]);
    setShowExercisePicker(false);
    setSearchQuery('');
  };

  const handleRemoveExercise = (exerciseId: string) => {
    setTemplateExercises(prev => prev.filter(ex => ex.id !== exerciseId));
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      Alert.alert('Error', 'Please enter a template name');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (templateExercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    setLoading(true);
    try {
      const template: WorkoutTemplate = {
        id: isEditing ? (edit as string) : generateId(),
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        category: selectedCategory,
        duration: parseInt(estimatedDuration) || 60,
        exercises: templateExercises,
        createdBy: 'current-user', // TODO: Get from user context
        createdAt: isEditing ? new Date().toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublic: false,
      };

      await saveTemplate(template);
      Alert.alert(
        'Success',
        `Template ${isEditing ? 'updated' : 'created'} successfully!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const filteredExercises = exercises.filter(exercise =>
    exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exercise.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exercise.muscleGroups.some(mg => mg.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderExerciseCard = (templateExercise: TemplateExercise, index: number) => (
    <View key={templateExercise.id} style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>{templateExercise.exercise.name}</Text>
          <Text style={styles.exerciseCategory}>{templateExercise.exercise.category}</Text>
          <Text style={styles.exerciseMuscles}>
            {templateExercise.exercise.muscleGroups.join(', ')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveExercise(templateExercise.id)}
        >
          <Trash2 size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.setsInfo}>
        <Text style={styles.setsText}>
          {templateExercise.sets.length} sets • {templateExercise.sets[0]?.reps || 0} reps each
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isEditing ? 'Edit Template' : isDuplicating ? 'Duplicate Template' : 'Create Template'}
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveTemplate}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Template Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Template Information</Text>
          
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Template Name *</Text>
            <TextInput
              style={styles.textInput}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="Enter template name"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={styles.textArea}
              value={templateDescription}
              onChangeText={setTemplateDescription}
              placeholder="Describe this workout template..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.formRow}>
            <View style={styles.formFieldHalf}>
              <Text style={styles.fieldLabel}>Category *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowCategoryPicker(true)}
              >
                <Text style={[
                  styles.pickerText,
                  !selectedCategory && styles.placeholderText
                ]}>
                  {selectedCategory || 'Select category'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formFieldHalf}>
              <Text style={styles.fieldLabel}>Duration (min)</Text>
              <TextInput
                style={styles.textInput}
                value={estimatedDuration}
                onChangeText={setEstimatedDuration}
                placeholder="60"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Exercises */}
        <View style={styles.section}>
          <View style={styles.exercisesHeader}>
            <Text style={styles.sectionTitle}>Exercises ({templateExercises.length})</Text>
            <TouchableOpacity
              style={styles.addExerciseButton}
              onPress={() => setShowExercisePicker(true)}
            >
              <Plus size={16} color={colors.primary} />
              <Text style={styles.addExerciseText}>Add Exercise</Text>
            </TouchableOpacity>
          </View>

          {templateExercises.length === 0 ? (
            <View style={styles.emptyExercises}>
              <Text style={styles.emptyExercisesText}>No exercises added yet</Text>
              <TouchableOpacity
                style={styles.addFirstExerciseButton}
                onPress={() => setShowExercisePicker(true)}
              >
                <Text style={styles.addFirstExerciseText}>Add First Exercise</Text>
              </TouchableOpacity>
            </View>
          ) : (
            templateExercises.map(renderExerciseCard)
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.categoryList}>
            {templateCategories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryOption,
                  selectedCategory === category && styles.selectedCategoryOption
                ]}
                onPress={() => {
                  setSelectedCategory(category);
                  setShowCategoryPicker(false);
                }}
              >
                <Text style={[
                  styles.categoryOptionText,
                  selectedCategory === category && styles.selectedCategoryOptionText
                ]}>
                  {category}
                </Text>
                {selectedCategory === category && (
                  <Text style={styles.selectedIndicator}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Exercise Picker Modal */}
      <Modal
        visible={showExercisePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExercisePicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Exercise</Text>
            <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          {/* Search */}
          <View style={styles.searchContainer}>
            <Search size={20} color={colors.textTertiary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView style={styles.exerciseList}>
            {filteredExercises.length === 0 ? (
              <View style={styles.emptyExerciseList}>
                <Text style={styles.emptyExerciseListText}>
                  {searchQuery ? 'No exercises found' : 'No exercises available'}
                </Text>
                <TouchableOpacity
                  style={styles.createExerciseButton}
                  onPress={() => {
                    setShowExercisePicker(false);
                    router.push('/create-exercise');
                  }}
                >
                  <Plus size={16} color={colors.primary} />
                  <Text style={styles.createExerciseText}>Create New Exercise</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredExercises.map((exercise) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.exerciseOption}
                  onPress={() => handleAddExercise(exercise)}
                >
                  <View style={styles.exerciseOptionInfo}>
                    <Text style={styles.exerciseOptionName}>{exercise.name}</Text>
                    <Text style={styles.exerciseOptionCategory}>{exercise.category}</Text>
                    <Text style={styles.exerciseOptionMuscles}>
                      {exercise.muscleGroups.join(', ')}
                    </Text>
                  </View>
                  <Plus size={20} color={colors.primary} />
                </TouchableOpacity>
              ))
            )}
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
    marginBottom: 16,
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
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
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
  },
  pickerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    color: colors.textTertiary,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addExerciseText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.primary,
    marginLeft: 4,
  },
  emptyExercises: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyExercisesText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  addFirstExerciseButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  addFirstExerciseText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  exerciseCategory: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.primary,
    marginBottom: 2,
  },
  exerciseMuscles: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setsInfo: {
    marginTop: 8,
  },
  setsText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
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
  categoryList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
  },
  selectedCategoryOption: {
    backgroundColor: `${colors.primary}20`,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  categoryOptionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: colors.text,
  },
  selectedCategoryOptionText: {
    color: colors.primary,
    fontFamily: 'Inter-SemiBold',
  },
  selectedIndicator: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: colors.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
  },
  exerciseList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyExerciseList: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyExerciseListText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  createExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  createExerciseText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.primary,
    marginLeft: 8,
  },
  exerciseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  exerciseOptionInfo: {
    flex: 1,
  },
  exerciseOptionName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  exerciseOptionCategory: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.primary,
    marginBottom: 2,
  },
  exerciseOptionMuscles: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
});