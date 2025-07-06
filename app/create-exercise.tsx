import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, X } from 'lucide-react-native';
import { useColorScheme, getColors } from '@/hooks/useColorScheme';
import { router } from 'expo-router';
import { Exercise } from '@/types/workout';
import { saveExercise } from '@/utils/storage';

const exerciseCategories = [
  'Strength',
  'Cardio',
  'Bodyweight',
  'Flexibility',
  'Olympic Lifting',
  'Powerlifting',
  'Functional',
  'Rehabilitation',
  'Sports Specific',
];

const muscleGroups = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Core',
  'Quadriceps',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Full Body',
];

const equipmentOptions = [
  'None (Bodyweight)',
  'Barbell',
  'Dumbbell',
  'Kettlebell',
  'Resistance Bands',
  'Cable Machine',
  'Pull-up Bar',
  'Bench',
  'Medicine Ball',
  'TRX',
  'Cardio Machine',
  'Other',
];

export default function CreateExerciseScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const styles = createStyles(colors);

  const [exerciseName, setExerciseName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);

  const handleMuscleGroupToggle = (muscleGroup: string) => {
    setSelectedMuscleGroups(prev => 
      prev.includes(muscleGroup)
        ? prev.filter(mg => mg !== muscleGroup)
        : [...prev, muscleGroup]
    );
  };

  const handleSaveExercise = async () => {
    if (!exerciseName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (selectedMuscleGroups.length === 0) {
      Alert.alert('Error', 'Please select at least one muscle group');
      return;
    }

    setLoading(true);
    try {
      const newExercise: Omit<Exercise, 'id'> = {
        name: exerciseName.trim(),
        category: selectedCategory,
        muscleGroups: selectedMuscleGroups,
        instructions: instructions.trim() || undefined,
        equipment: selectedEquipment || undefined,
      };

      const savedExercise = await saveExercise(newExercise);

      if (savedExercise) {
        Alert.alert(
          'Success',
          'Exercise created successfully!',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', 'Failed to save exercise');
      }
    } catch (error) {
      console.error('Error saving exercise:', error);
      Alert.alert('Error', 'Failed to save exercise');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Create Exercise</Text>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveExercise}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Exercise Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exercise Name *</Text>
          <TextInput
            style={styles.textInput}
            value={exerciseName}
            onChangeText={setExerciseName}
            placeholder="Enter exercise name"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category *</Text>
          <View style={styles.optionsGrid}>
            {exerciseCategories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.optionChip,
                  selectedCategory === category && styles.selectedOptionChip
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[
                  styles.optionText,
                  selectedCategory === category && styles.selectedOptionText
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Muscle Groups */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Muscle Groups *</Text>
          <Text style={styles.sectionSubtitle}>Select all muscle groups this exercise targets</Text>
          <View style={styles.optionsGrid}>
            {muscleGroups.map((muscleGroup) => (
              <TouchableOpacity
                key={muscleGroup}
                style={[
                  styles.optionChip,
                  selectedMuscleGroups.includes(muscleGroup) && styles.selectedOptionChip
                ]}
                onPress={() => handleMuscleGroupToggle(muscleGroup)}
              >
                <Text style={[
                  styles.optionText,
                  selectedMuscleGroups.includes(muscleGroup) && styles.selectedOptionText
                ]}>
                  {muscleGroup}
                </Text>
                {selectedMuscleGroups.includes(muscleGroup) && (
                  <X size={14} color="#FFFFFF" style={styles.removeIcon} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Equipment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipment</Text>
          <View style={styles.optionsGrid}>
            {equipmentOptions.map((equipment) => (
              <TouchableOpacity
                key={equipment}
                style={[
                  styles.optionChip,
                  selectedEquipment === equipment && styles.selectedOptionChip
                ]}
                onPress={() => setSelectedEquipment(equipment)}
              >
                <Text style={[
                  styles.optionText,
                  selectedEquipment === equipment && styles.selectedOptionText
                ]}>
                  {equipment}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          <Text style={styles.sectionSubtitle}>Provide step-by-step instructions for proper form</Text>
          <TextInput
            style={styles.textArea}
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Enter detailed instructions for proper form and execution..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
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
    fontSize: 20,
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
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
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
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
    minHeight: 120,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedOptionChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedOptionText: {
    color: '#FFFFFF',
  },
  removeIcon: {
    marginLeft: 6,
  },
});