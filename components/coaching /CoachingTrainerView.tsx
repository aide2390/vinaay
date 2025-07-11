import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Dumbbell,
  Clock,
  Flame,
  Trophy,
  Play,
  Calendar,
  TrendingUp,
  ChevronRight,
  Users,
  Target,
  Award,
  Activity,
  CheckCircle,
  AlertCircle,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme, getColors } from '../../hooks/useColorScheme';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTodayDataNew } from '../../hooks/useTodayDataNew';
import { getWorkoutTemplates, initializeDefaultTemplates } from '../../lib/workoutTemplates';
import { supabase } from '@/lib/supabase'; // Import supabase
import { getClientTrainingSessions } from '../../lib/trainingSessionQueries'; // Import getClientTrainingSessions
import { TrainingSession } from '../../lib/database'; // Import TrainingSession type

const { width } = Dimensions.get('window');

interface WeeklyWorkout {
  dayName: string;
  dayNumber: number;
  template: { id: string; name: string } | null;
  completed: boolean;
  missed: boolean;
  sessionId?: string;
  scheduledTime?: string;
}

export default function CoachingClientView() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = getColors(colorScheme);
  const styles = createStyles(colors);
  const { data, loading, error, refreshData } = useTodayDataNew();

  const [selectedTab, setSelectedTab] = useState('workouts');
  const [refreshing, setRefreshing] = useState(false);
  const [workoutTemplates, setWorkoutTemplates] = useState<any[]>([]);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<WeeklyWorkout[]>([]);
  const [loadingWeekly, setLoadingWeekly] = useState(true);

  useEffect(() => {
    loadWorkoutTemplates();
  }, []);

  useEffect(() => {
    if (data?.profile?.id) {
      loadWeeklyWorkouts(data.profile.id);
    }
  }, [data?.profile?.id, workoutTemplates]);

  // Refresh weekly workouts every time the screen comes into focus (e.g., user navigates back after trainer edited plan)
  useFocusEffect(
    React.useCallback(() => {
      if (data?.profile?.id) {
        loadWeeklyWorkouts(data.profile.id);
      }
    }, [data?.profile?.id, workoutTemplates])
  );

  const loadWorkoutTemplates = async () => {
    try {
      const templates = await getWorkoutTemplates();
      setWorkoutTemplates(templates);
    } catch (error) {
      console.error('Error loading workout templates:', error);
    }
  };

  const loadWeeklyWorkouts = async (clientId: string) => {
    try {
      setLoadingWeekly(true);

      const today = new Date();
      const currentDay = today.getDay();
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset);

      const weekDates = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        weekDates.push(date);
      }

      const startDate = weekDates[0] && typeof weekDates[0].toISOString === 'function' ? weekDates[0].toISOString().split('T')[0] : '';
      const endDate = weekDates[6] && typeof weekDates[6].toISOString === 'function' ? weekDates[6].toISOString().split('T')[0] : '';

      let trainingSessions = await getClientTrainingSessions(clientId, startDate, endDate);

      // Fallback: if no rows in training_sessions (e.g., mirroring failed), fetch from plan_sessions directly
      if (trainingSessions.length === 0) {
        const { data: planSessions, error } = await supabase
          .from('plan_sessions')
          .select('*, workout_templates(id, name), workout_plans!inner(client_id)')
          .eq('workout_plans.client_id', clientId)
          .gte('scheduled_date', startDate)
          .lte('scheduled_date', endDate);
        if (!error && planSessions) {
          trainingSessions = planSessions.map((ps: any) => ({
            id: ps.id,
            client_id: clientId,
            trainer_id: null,
            template_id: ps.template_id,
            plan_id: ps.plan_id,
            scheduled_date: ps.scheduled_date,
            scheduled_time: ps.scheduled_time ?? null,
            duration: 0,
            session_type: 'workout',
            status: ps.status ?? 'scheduled',
            session_data: {},
            completion_data: {},
          })).map(item => ({ ...item, created_at: item.scheduled_date, updated_at: item.scheduled_date })) as unknown as TrainingSession[];
        }
      }

      const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      const weeklyData: WeeklyWorkout[] = weekDates.map((date, index) => {
        const dateString = date && typeof date.toISOString === 'function' ? date.toISOString().split('T')[0] : '';
        const dayNumber = date.getDate();
        
        const session = trainingSessions.find(s => {
          const sDate = s.scheduled_date ? new Date(s.scheduled_date).toISOString().split('T')[0] : '';
          return sDate === dateString;
        });

        let template = null;
        let completed = false;
        let missed = false;
        let sessionId = undefined;
        let scheduledTime: string | undefined = undefined;

        if (session) {
          if (session.template_id) {
            const templateData = workoutTemplates.find(t => t.id === session.template_id);
            if (templateData) {
              template = { id: templateData.id, name: templateData.name };
            } else {
              template = { id: session.template_id, name: 'Workout' };
            }
          }
          sessionId = session.id;
          scheduledTime = session.scheduled_time ?? undefined;

          if (session.status === 'completed') {
            completed = true;
          } else if (session.status === 'no_show' || session.status === 'cancelled') {
            missed = true;
          } else {
            const sessionDate = new Date(dateString);
            const now = new Date();
            if (sessionDate < now && session.status === 'scheduled') {
              missed = true;
            }
          }
        }

        return {
          dayName: dayNames[index],
          dayNumber,
          template,
          completed,
          missed,
          sessionId,
          scheduledTime: scheduledTime as string | undefined
        };
      });

      setWeeklyWorkouts(weeklyData);
    } catch (error) {
      console.error('Error loading weekly workouts:', error);
    } finally {
      setLoadingWeekly(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    await loadWorkoutTemplates();
    if (data?.profile?.id) {
      await loadWeeklyWorkouts(data.profile.id);
    }
    setRefreshing(false);
  };

  const handleTrainingCalendarPress = () => {
    router.push('/training-calendar');
  };

  const handleDayPress = (workout: WeeklyWorkout) => {
    router.push(`/workout-detail/${workout.template?.id}`);
    // if (!workout.template && !workout.sessionId) {
    //   console.log('No workout scheduled for this day');
    //   return;
    // }

    // // If we have a session ID, always use that for navigation
    // if (workout.sessionId) {
    //   if (workout.completed) {
    //     router.push(`/workout-detail/${workout.sessionId}`);
    //   } else {
    //     // For incomplete sessions, go to today's workout with the session ID
    //     router.push(`/todays-workout/${workout.sessionId}`);
    //   }
    // } 
    // // If we only have a template ID (no session ID)
    // else if (workout.template) {
    //   if (workout.completed) {
    //     // For completed workouts, try to find a matching session first
    //     const matchingSession = trainingSessions.find(
    //       s => s.template_id === workout.template?.id && s.status === 'completed'
    //     );
        
    //     if (matchingSession) {
    //       // If we found a completed session, navigate to its detail
    //       router.push(`/workout-detail/${matchingSession.id}`);
    //     } else {
    //       // Otherwise, navigate to the template detail
    //       router.push(`/todays-workout/${workout.template.id}`);
    //     }
    //   }
    // } else {
    //   Alert.alert('Info', 'No specific session found to start or view details for this workout.');
    // }
  };

  const getWorkoutCount = () => {
    return weeklyWorkouts.filter(w => w.template !== null).length;
  };

  const renderWeeklyCalendar = () => (
    <View style={styles.calendarSection}>
      <TouchableOpacity
        style={styles.calendarHeader}
        onPress={handleTrainingCalendarPress}
        activeOpacity={0.7}
      >
        <Text style={styles.calendarTitle}>Training (this week)</Text>
        <ChevronRight size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {loadingWeekly ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading workouts...</Text>
        </View>
      ) : (
        <>
          <View style={styles.weekContainer}>
            {(weeklyWorkouts || []).map((workout, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayButton,
                  workout.template && styles.activeDayButton,
                  workout.completed && styles.completedDayButton,
                  workout.missed && styles.missedDayButton
                ]}
                onPress={() => handleDayPress(workout)}
                disabled={!workout.template && !workout.sessionId}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dayName,
                  workout.template && styles.activeDayName,
                  workout.completed && styles.completedDayName,
                  workout.missed && styles.missedDayName
                ]}>
                  {workout.dayName}
                </Text>
                <Text style={[
                  styles.dayNumber,
                  workout.template && styles.activeDayNumber,
                  workout.completed && styles.completedDayNumber,
                  workout.missed && styles.missedDayNumber
                ]}>
                  {workout.dayNumber.toString().padStart(2, '0')}
                </Text>
                {workout.scheduledTime && (
                  <Text style={[
                    styles.dayTime,
                    workout.template && styles.activeDayTime,
                    workout.completed && styles.completedDayTime,
                    workout.missed && styles.missedDayTime
                  ]}>
                    {workout.scheduledTime.slice(0, 5)}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.weekSummary}>
            You have {getWorkoutCount()} workouts this week!
          </Text>
        </>
      )}
    </View>
  );

  const renderTaskSection = () => (
    <View style={styles.taskSection}>
      <Text style={styles.taskTitle}>Task (last 7 days)</Text>
      <Text style={styles.taskMessage}>There are no tasks</Text>
    </View>
  );

  const renderMacrosSection = () => (
    <View style={styles.macrosSection}>
      <Text style={styles.macrosTitle}>Macros</Text>
      <View style={styles.macrosContent}>
        <View style={styles.macrosText}>
          <Text style={styles.macrosDescription}>
            Start by setting your daily goal
          </Text>
          <TouchableOpacity
            style={styles.macrosButton}
            onPress={() => router.push('/food-journal')}
          >
            <Text style={styles.macrosButtonText}>Set daily goal</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.macrosEmoji}>🥗🍎🥕</Text>
      </View>
    </View>
  );

  const renderResourcesSection = () => (
    <View style={styles.resourcesSection}>
      <Text style={styles.resourcesTitle}>Resources</Text>
      <View style={styles.resourcesGrid}>
        <TouchableOpacity style={styles.resourceCard}>
          <Text style={styles.resourceTitle}>Welcome Kit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resourceCard}>
          <Text style={styles.resourceTitle}>Nutrition Resources</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resourceCard}>
          <Text style={styles.resourceTitle}>Other Resources</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAchievementsTab = () => {
    const achievements = [
      { name: '7-Day Streak', icon: '🔥', completed: false, progress: 3 },
      { name: 'First Workout', icon: '💪', completed: true, progress: 1 },
      { name: '100 Workouts', icon: '🏆', completed: false, progress: 23 },
    ];

    return (
      <>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your Progress</Text>
            <Trophy size={24} color={colors.warning} />
          </View>

          <Text style={styles.achievementSummary}>
            You've unlocked 1 out of 3 achievements. Keep going!
          </Text>

          <View style={styles.achievementProgressBar}>
            <View style={[styles.achievementProgress, { width: '33.33%' }]} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Achievements</Text>

        {achievements.map((achievement, index) => (
          <View key={index} style={styles.achievementCard}>
            <View style={styles.achievementIcon}>
              <Text style={styles.achievementEmoji}>{achievement.icon}</Text>
            </View>

            <View style={styles.achievementInfo}>
              <Text style={styles.achievementName}>{achievement.name}</Text>
              <Text style={styles.achievementProgressText}>
                {achievement.completed
                  ? 'Completed!'
                  : `${achievement.progress}/${achievement.name === '7-Day Streak' ? 7 : achievement.name === '100 Workouts' ? 100 : 1}`
                }
              </Text>
            </View>

            {achievement.completed && (
              <View style={styles.completedBadge}>
                <Text style={styles.completedText}>✓</Text>
              </View>
            )}
          </View>
        ))}
      </>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your coaching data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to load data</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Coaching</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'workouts' && styles.activeTab]}
            onPress={() => setSelectedTab('workouts')}
          >
            <Text style={[styles.tabText, selectedTab === 'workouts' && styles.activeTabText]}>
              Workouts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'achievements' && styles.activeTab]}
            onPress={() => setSelectedTab('achievements')}
          >
            <Text style={[styles.tabText, selectedTab === 'achievements' && styles.activeTabText]}>
              Achievements
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {selectedTab === 'workouts' ? (
          <>
            {renderWeeklyCalendar()}
            {renderTaskSection()}
            {renderMacrosSection()}
            {renderResourcesSection()}
            {data && 'clientAssignment' in data && data.clientAssignment && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Your Team</Text>
                  <Users size={24} color={colors.info} />
                </View>

                {data.clientAssignment.trainer && (
                  <View style={styles.teamMember}>
                    <Text style={styles.teamMemberRole}>Trainer</Text>
                    <Text style={styles.teamMemberName}>{data.clientAssignment.trainer.full_name}</Text>
                  </View>
                )}

                {data.clientAssignment.nutritionist && (
                  <View style={styles.teamMember}>
                    <Text style={styles.teamMemberRole}>Nutritionist</Text>
                    <Text style={styles.teamMemberName}>{data.clientAssignment.nutritionist.full_name}</Text>
                  </View>
                )}
              </View>
            )}
          </>
        ) : (
          renderAchievementsTab()
        )}

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    marginBottom: 8,
    textAlign: 'center',
    color: colors.text,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: colors.text,
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: colors.surface,
  },
  tabText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  calendarSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  calendarTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
  },
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dayButton: {
    width: 40,
    height: 70,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeDayButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  completedDayButton: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  missedDayButton: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  dayName: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  activeDayName: {
    color: '#FFFFFF',
  },
  completedDayName: {
    color: '#FFFFFF',
  },
  missedDayName: {
    color: '#FFFFFF',
  },
  dayNumber: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  activeDayNumber: {
    color: '#FFFFFF',
  },
  completedDayNumber: {
    color: '#FFFFFF',
  },
  missedDayNumber: {
    color: '#FFFFFF',
  },
  dayTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 8,
    color: colors.textTertiary,
  },
  activeDayTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  completedDayTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  missedDayTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  weekSummary: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  taskSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  taskTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 12,
  },
  taskMessage: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  macrosSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  macrosTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 16,
  },
  macrosContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macrosText: {
    flex: 1,
  },
  macrosDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  macrosButton: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  macrosButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: colors.primary,
  },
  macrosEmoji: {
    fontSize: 32,
    marginLeft: 16,
  },
  resourcesSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  resourcesTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 16,
  },
  resourcesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  resourceCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  resourceTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
  },
  achievementSummary: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  achievementProgressBar: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  achievementProgress: {
    height: '100%',
    backgroundColor: colors.warning,
    borderRadius: 4,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  achievementCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  achievementEmoji: {
    fontSize: 24,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  achievementProgressText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  completedBadge: {
    width: 24,
    height: 24,
    backgroundColor: colors.success,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  teamMember: {
    marginBottom: 12,
  },
  teamMemberRole: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  teamMemberName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
  },
});
