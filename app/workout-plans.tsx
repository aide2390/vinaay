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
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft, 
  Plus, 
  Search,
  Filter,
  Calendar,
  Clock,
  Users,
  Target,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Edit3,
  Trash2,
  MoreHorizontal,
  TrendingUp,
  Activity,
  Dumbbell,
  User,
  CalendarDays,
  Timer,
  X,
  ChevronRight,
  Star,
  Award,
  Zap
} from 'lucide-react-native';
import { useColorScheme, getColors } from '@/hooks/useColorScheme';
import { router } from 'expo-router';
import { 
  WorkoutPlan,
  getTrainerClients,
  getWorkoutTemplatesForPlans,
  createWorkoutPlan,
  updateWorkoutPlan,
  getWorkoutPlan,
  ClientProfile,
  WorkoutTemplateForPlan
} from '@/lib/planDatabase';

const { width } = Dimensions.get('window');

// Mock data for demonstration
const mockPlans: WorkoutPlan[] = [
  {
    id: '1',
    client_id: 'client1',
    trainer_id: 'trainer1',
    name: 'Summer Shred Program',
    description: 'Intensive 8-week program focused on fat loss and muscle definition',
    start_date: '2024-01-15',
    end_date: '2024-03-15',
    schedule_type: 'weekly',
    schedule_data: {
      Monday: 'template1',
      Wednesday: 'template2',
      Friday: 'template3',
      Sunday: 'rest'
    },
    status: 'active',
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z',
  },
  {
    id: '2',
    client_id: 'client2',
    trainer_id: 'trainer1',
    name: 'Strength Building Foundation',
    description: 'Progressive strength training for beginners',
    start_date: '2024-02-01',
    end_date: '2024-04-01',
    schedule_type: 'weekly',
    schedule_data: {
      Tuesday: 'template4',
      Thursday: 'template5',
      Saturday: 'template6'
    },
    status: 'draft',
    created_at: '2024-01-25T14:30:00Z',
    updated_at: '2024-01-25T14:30:00Z',
  },
  {
    id: '3',
    client_id: 'client3',
    trainer_id: 'trainer1',
    name: 'Athletic Performance',
    description: 'Sport-specific training for competitive athletes',
    start_date: '2023-12-01',
    end_date: '2024-01-01',
    schedule_type: 'custom',
    schedule_data: {
      sessions: [
        { date: '2023-12-05', template: 'template7' },
        { date: '2023-12-08', template: 'template8' },
        { date: '2023-12-12', template: 'template9' }
      ]
    },
    status: 'completed',
    created_at: '2023-11-20T09:15:00Z',
    updated_at: '2024-01-01T18:00:00Z',
  }
];

const mockClients: ClientProfile[] = [
  {
    id: 'client1',
    full_name: 'Sarah Johnson',
    email: 'sarah@example.com',
    role: 'client',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'client2',
    full_name: 'Mike Chen',
    email: 'mike@example.com',
    role: 'client',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'client3',
    full_name: 'Emma Wilson',
    email: 'emma@example.com',
    role: 'client',
    created_at: '2024-01-01T00:00:00Z'
  }
];

export default function WorkoutPlansScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const styles = createStyles(colors);

  const [plans, setPlans] = useState<WorkoutPlan[]>(mockPlans);
  const [clients, setClients] = useState<ClientProfile[]>(mockClients);
  const [templates, setTemplates] = useState<WorkoutTemplateForPlan[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<WorkoutPlan[]>(mockPlans);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [showPlanDetails, setShowPlanDetails] = useState(false);

  const statusFilters = ['all', 'active', 'draft', 'completed', 'cancelled'];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterPlans();
  }, [plans, searchQuery, selectedStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // In a real app, uncomment these lines:
      // const [clientsData, templatesData] = await Promise.all([
      //   getTrainerClients(),
      //   getWorkoutTemplatesForPlans()
      // ]);
      // setClients(clientsData);
      // setTemplates(templatesData);
      
      // For now, using mock data
      console.log('Loading workout plans data...');
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load workout plans');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filterPlans = () => {
    let filtered = plans;

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(plan => plan.status === selectedStatus);
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(plan =>
        plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getClientName(plan.client_id).toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredPlans(filtered);
  };

  const getClientName = (clientId: string): string => {
    const client = clients.find(c => c.id === clientId);
    return client?.full_name || 'Unknown Client';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return colors.success;
      case 'draft': return colors.warning;
      case 'completed': return colors.primary;
      case 'cancelled': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play size={16} color="#FFFFFF" />;
      case 'draft': return <Edit3 size={16} color="#FFFFFF" />;
      case 'completed': return <CheckCircle size={16} color="#FFFFFF" />;
      case 'cancelled': return <XCircle size={16} color="#FFFFFF" />;
      default: return <Pause size={16} color="#FFFFFF" />;
    }
  };

  const calculatePlanProgress = (plan: WorkoutPlan): number => {
    const startDate = new Date(plan.start_date);
    const endDate = new Date(plan.end_date);
    const currentDate = new Date();
    
    if (currentDate < startDate) return 0;
    if (currentDate > endDate) return 100;
    
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = currentDate.getTime() - startDate.getTime();
    
    return Math.round((elapsed / totalDuration) * 100);
  };

  const calculatePlanDuration = (plan: WorkoutPlan): string => {
    const startDate = new Date(plan.start_date);
    const endDate = new Date(plan.end_date);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks`;
    return `${Math.ceil(diffDays / 30)} months`;
  };

  const getWorkoutsPerWeek = (plan: WorkoutPlan): number => {
    if (plan.schedule_type === 'weekly') {
      return Object.values(plan.schedule_data).filter(value => value && value !== 'rest').length;
    }
    return 3; // Default estimate
  };

  const handlePlanPress = (plan: WorkoutPlan) => {
    setSelectedPlan(plan);
    setShowPlanDetails(true);
  };

  const handleCreatePlan = () => {
    router.push('/create-plan');
  };

  const handleEditPlan = (plan: WorkoutPlan) => {
    router.push(`/create-plan?edit=${plan.id}`);
  };

  const handleDeletePlan = (plan: WorkoutPlan) => {
    Alert.alert(
      'Delete Plan',
      `Are you sure you want to delete "${plan.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setPlans(prev => prev.filter(p => p.id !== plan.id));
            Alert.alert('Success', 'Plan deleted successfully');
          }
        }
      ]
    );
  };

  const handleUpdatePlanStatus = (plan: WorkoutPlan, newStatus: string) => {
    setPlans(prev => prev.map(p => 
      p.id === plan.id 
        ? { ...p, status: newStatus as any, updated_at: new Date().toISOString() }
        : p
    ));
    Alert.alert('Success', `Plan status updated to ${newStatus}`);
  };

  const renderPlanCard = (plan: WorkoutPlan) => {
    const progress = calculatePlanProgress(plan);
    const duration = calculatePlanDuration(plan);
    const workoutsPerWeek = getWorkoutsPerWeek(plan);
    const clientName = getClientName(plan.client_id);

    return (
      <TouchableOpacity
        key={plan.id}
        style={styles.planCard}
        onPress={() => handlePlanPress(plan)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={[colors.surface, colors.surfaceSecondary]}
          style={styles.planCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Header */}
          <View style={styles.planHeader}>
            <View style={styles.planHeaderLeft}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planClient}>{clientName}</Text>
            </View>
            <View style={styles.planHeaderRight}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(plan.status) }]}>
                {getStatusIcon(plan.status)}
                <Text style={styles.statusText}>{plan.status}</Text>
              </View>
              <TouchableOpacity
                style={styles.moreButton}
                onPress={() => {
                  Alert.alert(
                    'Plan Actions',
                    'Choose an action',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Edit', onPress: () => handleEditPlan(plan) },
                      { text: 'Delete', style: 'destructive', onPress: () => handleDeletePlan(plan) },
                    ]
                  );
                }}
              >
                <MoreHorizontal size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          {plan.description && (
            <Text style={styles.planDescription} numberOfLines={2}>
              {plan.description}
            </Text>
          )}

          {/* Stats */}
          <View style={styles.planStats}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Calendar size={16} color={colors.primary} />
              </View>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{duration}</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: `${colors.success}15` }]}>
                <Dumbbell size={16} color={colors.success} />
              </View>
              <Text style={styles.statLabel}>Workouts/Week</Text>
              <Text style={styles.statValue}>{workoutsPerWeek}</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: `${colors.warning}15` }]}>
                <TrendingUp size={16} color={colors.warning} />
              </View>
              <Text style={styles.statLabel}>Progress</Text>
              <Text style={styles.statValue}>{progress}%</Text>
            </View>
          </View>

          {/* Progress Bar */}
          {plan.status === 'active' && (
            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryLight]}
                  style={[styles.progressFill, { width: `${progress}%` }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
              <Text style={styles.progressText}>{progress}% Complete</Text>
            </View>
          )}

          {/* Dates */}
          <View style={styles.planDates}>
            <View style={styles.dateItem}>
              <CalendarDays size={14} color={colors.textSecondary} />
              <Text style={styles.dateText}>
                {new Date(plan.start_date).toLocaleDateString()} - {new Date(plan.end_date).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderOverviewCards = () => {
    const activeCount = plans.filter(p => p.status === 'active').length;
    const draftCount = plans.filter(p => p.status === 'draft').length;
    const completedCount = plans.filter(p => p.status === 'completed').length;

    return (
      <View style={styles.overviewContainer}>
        <LinearGradient
          colors={[colors.primary, colors.primaryLight]}
          style={styles.overviewCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.overviewIcon}>
            <Activity size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.overviewNumber}>{activeCount}</Text>
          <Text style={styles.overviewLabel}>Active Plans</Text>
        </LinearGradient>

        <LinearGradient
          colors={[colors.warning, '#FBBF24']}
          style={styles.overviewCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.overviewIcon}>
            <Edit3 size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.overviewNumber}>{draftCount}</Text>
          <Text style={styles.overviewLabel}>Drafts</Text>
        </LinearGradient>

        <LinearGradient
          colors={[colors.success, '#34D399']}
          style={styles.overviewCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.overviewIcon}>
            <Award size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.overviewNumber}>{completedCount}</Text>
          <Text style={styles.overviewLabel}>Completed</Text>
        </LinearGradient>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            style={styles.loadingCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Zap size={32} color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading workout plans...</Text>
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Workout Plans</Text>
          <Text style={styles.subtitle}>Manage your training programs</Text>
        </View>
        <TouchableOpacity onPress={handleCreatePlan} style={styles.createButton}>
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            style={styles.createButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Plus size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Search and Filters */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Search size={20} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search plans..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Filter size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Overview Cards */}
      {renderOverviewCards()}

      {/* Plans List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {filteredPlans.length === 0 ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={[colors.surfaceSecondary, colors.surface]}
              style={styles.emptyCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Target size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No workout plans found</Text>
              <Text style={styles.emptyText}>
                {searchQuery || selectedStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first workout plan to get started'}
              </Text>
              {!searchQuery && selectedStatus === 'all' && (
                <TouchableOpacity style={styles.emptyButton} onPress={handleCreatePlan}>
                  <Text style={styles.emptyButtonText}>Create Plan</Text>
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>
        ) : (
          filteredPlans.map(renderPlanCard)
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilters(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Plans</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterContent}>
            <Text style={styles.filterSectionTitle}>Status</Text>
            {statusFilters.map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterOption,
                  selectedStatus === status && styles.selectedFilterOption
                ]}
                onPress={() => {
                  setSelectedStatus(status);
                  setShowFilters(false);
                }}
              >
                <Text style={[
                  styles.filterOptionText,
                  selectedStatus === status && styles.selectedFilterOptionText
                ]}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
                {selectedStatus === status && (
                  <CheckCircle size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Plan Details Modal */}
      <Modal
        visible={showPlanDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPlanDetails(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Plan Details</Text>
            <TouchableOpacity onPress={() => setShowPlanDetails(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {selectedPlan && (
            <ScrollView style={styles.detailsContent}>
              <LinearGradient
                colors={[colors.primary, colors.primaryLight]}
                style={styles.detailsHeader}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.detailsTitle}>{selectedPlan.name}</Text>
                <Text style={styles.detailsClient}>{getClientName(selectedPlan.client_id)}</Text>
                <View style={styles.detailsStats}>
                  <View style={styles.detailsStat}>
                    <Text style={styles.detailsStatValue}>{calculatePlanDuration(selectedPlan)}</Text>
                    <Text style={styles.detailsStatLabel}>Duration</Text>
                  </View>
                  <View style={styles.detailsStat}>
                    <Text style={styles.detailsStatValue}>{getWorkoutsPerWeek(selectedPlan)}</Text>
                    <Text style={styles.detailsStatLabel}>Workouts/Week</Text>
                  </View>
                  <View style={styles.detailsStat}>
                    <Text style={styles.detailsStatValue}>{calculatePlanProgress(selectedPlan)}%</Text>
                    <Text style={styles.detailsStatLabel}>Progress</Text>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.detailsSection}>
                <Text style={styles.detailsSectionTitle}>Description</Text>
                <Text style={styles.detailsDescription}>
                  {selectedPlan.description || 'No description provided'}
                </Text>
              </View>

              <View style={styles.detailsSection}>
                <Text style={styles.detailsSectionTitle}>Schedule</Text>
                <Text style={styles.detailsScheduleType}>
                  Type: {selectedPlan.schedule_type.charAt(0).toUpperCase() + selectedPlan.schedule_type.slice(1)}
                </Text>
                {/* Add schedule details here based on schedule_type */}
              </View>

              <View style={styles.detailsActions}>
                <TouchableOpacity
                  style={[styles.detailsActionButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowPlanDetails(false);
                    handleEditPlan(selectedPlan);
                  }}
                >
                  <Edit3 size={20} color="#FFFFFF" />
                  <Text style={styles.detailsActionText}>Edit Plan</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.detailsActionButton, { backgroundColor: colors.success }]}
                  onPress={() => {
                    setShowPlanDetails(false);
                    Alert.alert('Success', 'Plan started successfully');
                  }}
                >
                  <Play size={20} color="#FFFFFF" />
                  <Text style={styles.detailsActionText}>Start Plan</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleCreatePlan}>
        <LinearGradient
          colors={[colors.primary, colors.primaryLight]}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Plus size={24} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
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
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  loadingText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 16,
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
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
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
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overviewContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  overviewIcon: {
    marginBottom: 8,
  },
  overviewNumber: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  overviewLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  planCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  planCardGradient: {
    padding: 20,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  planName: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 4,
  },
  planClient: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.textSecondary,
  },
  planHeaderRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  statusText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  planStats: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
    textAlign: 'center',
  },
  statValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: colors.text,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  planDates: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyCard: {
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    width: '100%',
  },
  emptyTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 20,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
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
  filterContent: {
    padding: 20,
  },
  filterSectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  selectedFilterOption: {
    backgroundColor: colors.primary,
  },
  filterOptionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: colors.text,
  },
  selectedFilterOptionText: {
    color: '#FFFFFF',
  },
  detailsContent: {
    flex: 1,
  },
  detailsHeader: {
    padding: 24,
    alignItems: 'center',
  },
  detailsTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  detailsClient: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 24,
  },
  detailsStats: {
    flexDirection: 'row',
    gap: 24,
  },
  detailsStat: {
    alignItems: 'center',
  },
  detailsStatValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  detailsStatLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  detailsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailsSectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 12,
  },
  detailsDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  detailsScheduleType: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailsActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  detailsActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  detailsActionText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});