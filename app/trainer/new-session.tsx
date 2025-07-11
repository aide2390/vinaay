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
import { ArrowLeft, Calendar, Clock, MapPin, User, Plus, X, ChevronDown } from 'lucide-react-native';
import { useColorScheme, getColors } from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';

const sessionTypes = [
  'Personal Training',
  'Strength Training',
  'HIIT Session',
  'Cardio Training',
  'Athletic Performance',
  'Flexibility Training',
  'Rehabilitation',
  'Group Training',
  'Virtual Session',
];

const locations = [
  'Gym A - Main Floor',
  'Gym B - Upper Level',
  'Studio A - Yoga Room',
  'Studio B - Dance Room',
  'Outdoor Area',
  'Pool Area',
  'Virtual/Online',
  'Client\'s Home',
];

export default function TrainerNewSessionsView() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = getColors(colorScheme);
  const styles = createStyles(colors);
  const params = useLocalSearchParams();
  const clientId = params.clientId as string | undefined;
  const editSessionId = params.editSessionId as string | undefined;
  
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [sessionType, setSessionType] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [duration, setDuration] = useState('60');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEditing = !!editSessionId;

  useEffect(() => {
    // Fetch only assigned clients for this trainer
    const fetchClients = async () => {
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
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar')
          .in('id', assignedClientIds);
        
        if (error) throw error;
        
        setClients(
          (data || []).map((c: any) => ({
            id: c.id,
            name: c.full_name || c.email,
            avatar: c.avatar || '👤',
            email: c.email,
          }))
        );
      } catch (err) {
        console.error('Error fetching assigned clients:', err);
        setClients([]);
      }
    };
    fetchClients();
  }, []);

  useEffect(() => {
    // Pre-select client if coming from client detail page
    if (clientId && clients.length > 0) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setSelectedClient(client);
      }
    }

    // Load session data if editing
    if (isEditing) {
      loadSessionData();
    }
    // eslint-disable-next-line
  }, [clientId, editSessionId, clients]);

  const loadSessionData = () => {
    // Mock loading existing session data
    // In a real app, this would fetch from your database
    const mockSession = {
      client: clients[0],
      type: 'Strength Training',
      session_date: new Date(),
      time: new Date(),
      duration: '60',
      location: 'Gym A - Main Floor',
      notes: 'Focus on upper body strength',
    };

    setSelectedClient(mockSession.client);
    setSessionType(mockSession.type);
    setSelectedDate(mockSession.session_date);
    setSelectedTime(mockSession.time);
    setDuration(mockSession.duration);
    setLocation(mockSession.location);
    setNotes(mockSession.notes);
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    setShowTimePicker(false);
    if (time) {
      setSelectedTime(time);
    }
  };

  const handleSaveSession = async () => {
    if (!selectedClient) {
      Alert.alert('Error', 'Please select a client');
      return;
    }

    if (!sessionType) {
      Alert.alert('Error', 'Please select a session type');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Please select a location');
      return;
    }

    setLoading(true);
    try {
      // Get current trainer ID from Supabase Auth
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        throw new Error('Could not get trainer ID');
      }
      const trainerId = userData.user.id;

      // Prepare session data for DB
      const sessionData = {
        client_id: selectedClient.id,
        trainer_id: trainerId,
        session_type: sessionType,
        session_date: selectedDate.toISOString().split('T')[0],
       scheduled_time: selectedTime.toTimeString().slice(0, 5),
        duration: parseInt(duration),
        location,
        trainer_notes: notes.trim(),
        status: 'scheduled',
      };

      // Insert session into Supabase
      const { error: insertError } = await supabase
        .from('training_sessions')
        .insert([sessionData]);
      if (insertError) throw insertError;

      Alert.alert(
        'Success',
        `Session ${isEditing ? 'updated' : 'scheduled'} successfully!`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving session:', error);
      Alert.alert('Error', 'Failed to save session');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isEditing ? 'Edit Session' : 'New Training Session'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Client Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client *</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowClientPicker(true)}
          >
            {selectedClient ? (
              <View style={styles.selectedClientContainer}>
                <Text style={styles.clientAvatar}>{selectedClient.avatar}</Text>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{selectedClient.name}</Text>
                  <Text style={styles.clientEmail}>{selectedClient.email}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.placeholderContainer}>
                <User size={20} color={colors.textTertiary} />
                <Text style={styles.placeholderText}>Select a client</Text>
              </View>
            )}
            <ChevronDown size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Session Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Type *</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowTypePicker(true)}
          >
            <Text style={[
              styles.pickerText,
              !sessionType && styles.placeholderText
            ]}>
              {sessionType || 'Select session type'}
            </Text>
            <ChevronDown size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date & Time *</Text>
          <View style={styles.dateTimeRow}>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar size={20} color={colors.textSecondary} />
              <Text style={styles.dateTimeText}>
                {selectedDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Clock size={20} color={colors.textSecondary} />
              <Text style={styles.dateTimeText}>
                {formatTime(selectedTime)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration (minutes)</Text>
          <View style={styles.durationContainer}>
            {['30', '45', '60', '75', '90'].map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.durationButton,
                  duration === time && styles.selectedDurationButton
                ]}
                onPress={() => setDuration(time)}
              >
                <Text style={[
                  styles.durationText,
                  duration === time && styles.selectedDurationText
                ]}>
                  {time}min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.customDurationInput}
            value={duration}
            onChangeText={setDuration}
            placeholder="Custom duration"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location *</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowLocationPicker(true)}
          >
            <View style={styles.locationContainer}>
              <MapPin size={20} color={colors.textSecondary} />
              <Text style={[
                styles.pickerText,
                !location && styles.placeholderText
              ]}>
                {location || 'Select location'}
              </Text>
            </View>
            <ChevronDown size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Notes</Text>
          <TextInput
            style={styles.textArea}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any special notes, goals, or instructions for this session..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
          onPress={handleSaveSession}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : isEditing ? 'Update Session' : 'Schedule Session'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
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
                <Text style={styles.clientOptionAvatar}>{client.avatar}</Text>
                <View style={styles.clientOptionInfo}>
                  <Text style={styles.clientOptionName}>{client.name}</Text>
                  <Text style={styles.clientOptionEmail}>{client.email}</Text>
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

      {/* Session Type Picker Modal */}
      <Modal
        visible={showTypePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTypePicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Session Type</Text>
            <TouchableOpacity onPress={() => setShowTypePicker(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.typeList}>
            {sessionTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeOption,
                  sessionType === type && styles.selectedTypeOption
                ]}
                onPress={() => {
                  setSessionType(type);
                  setShowTypePicker(false);
                }}
              >
                <Text style={[
                  styles.typeOptionText,
                  sessionType === type && styles.selectedTypeOptionText
                ]}>
                  {type}
                </Text>
                {sessionType === type && (
                  <Text style={styles.selectedText}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Location</Text>
            <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.locationList}>
            {locations.map((loc) => (
              <TouchableOpacity
                key={loc}
                style={[
                  styles.locationOption,
                  location === loc && styles.selectedLocationOption
                ]}
                onPress={() => {
                  setLocation(loc);
                  setShowLocationPicker(false);
                }}
              >
                <MapPin size={20} color={colors.textSecondary} />
                <Text style={[
                  styles.locationOptionText,
                  location === loc && styles.selectedLocationOptionText
                ]}>
                  {loc}
                </Text>
                {location === loc && (
                  <Text style={styles.selectedText}>✓</Text>
                )}
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
  placeholder: {
    width: 32,
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
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedClientContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clientAvatar: {
    fontSize: 24,
    marginRight: 12,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  clientEmail: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  placeholderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  placeholderText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.textTertiary,
    marginLeft: 8,
  },
  pickerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateTimeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
    marginLeft: 8,
  },
  durationContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  durationButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectedDurationButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedDurationText: {
    color: '#FFFFFF',
  },
  customDurationInput: {
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
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    minHeight: 100,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
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
  clientOptionAvatar: {
    fontSize: 24,
    marginRight: 16,
  },
  clientOptionInfo: {
    flex: 1,
  },
  clientOptionName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  clientOptionEmail: {
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
  typeList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
  },
  selectedTypeOption: {
    backgroundColor: `${colors.primary}20`,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  typeOptionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: colors.text,
  },
  selectedTypeOptionText: {
    color: colors.primary,
    fontFamily: 'Inter-SemiBold',
  },
  locationList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
  },
  selectedLocationOption: {
    backgroundColor: `${colors.primary}20`,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  locationOptionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: colors.text,
    flex: 1,
    marginLeft: 12,
  },
  selectedLocationOptionText: {
    color: colors.primary,
    fontFamily: 'Inter-SemiBold',
  },
});