import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { getDisputeById, joinDispute, rejectDispute, submitDisputeResponse } from '../services/api';

export default function DisputeDetailScreen({ disputeId, token, currentUserId, onBack, onDisputeUpdated }) {
  const [dispute, setDispute] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDisputeDetails();
  }, []);

  const loadDisputeDetails = async () => {
    try {
      const data = await getDisputeById(disputeId, token);
      setDispute(data.dispute);
      
      // Pre-fill response text if user already has a response
      const currentUserParticipant = data.dispute.participants.find(p => p.user_id === currentUserId);
      if (currentUserParticipant && currentUserParticipant.response_text) {
        setResponseText(currentUserParticipant.response_text);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load dispute details');
      console.error('Error loading dispute:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinDispute = async () => {
    try {
      setSubmitting(true);
      await joinDispute(disputeId, token);
      Alert.alert('Success', 'You have joined the dispute');
      loadDisputeDetails(); // Refresh
      onDisputeUpdated?.();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to join dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectDispute = async () => {
    Alert.alert(
      'Reject Dispute',
      'Are you sure you want to reject this dispute? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              await rejectDispute(disputeId, token);
              Alert.alert('Success', 'You have rejected the dispute');
              loadDisputeDetails(); // Refresh
              onDisputeUpdated?.();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to reject dispute');
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) {
      Alert.alert('Error', 'Please enter your response');
      return;
    }

    try {
      setSubmitting(true);
      const result = await submitDisputeResponse(disputeId, responseText.trim(), token);
      
      if (result.result.completed) {
        Alert.alert('Success', 'Response submitted! All participants have responded - dispute is now completed.');
      } else {
        Alert.alert('Success', 'Response submitted successfully');
      }
      
      loadDisputeDetails(); // Refresh
      onDisputeUpdated?.();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCurrentUserParticipant = () => {
    return dispute?.participants.find(p => p.user_id === currentUserId);
  };

  const getParticipantStatus = (participant) => {
    if (participant.status === 'invited') return '⏳ Invited';
    if (participant.status === 'accepted' && participant.response_text) return '✅ Responded';
    if (participant.status === 'accepted') return '✅ Joined';
    if (participant.status === 'rejected') return '❌ Rejected';
    return participant.status;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Dispute Details</Text>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading dispute...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dispute) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Dispute Details</Text>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Dispute not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentUserParticipant = getCurrentUserParticipant();
  const canSubmitResponse = currentUserParticipant?.status === 'accepted' && dispute.status === 'ongoing';
  const isInvited = currentUserParticipant?.status === 'invited';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Dispute Details</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Dispute Info */}
          <View style={styles.section}>
            <Text style={styles.disputeTitle}>{dispute.title}</Text>
            <View style={styles.disputeInfo}>
              <Text style={styles.infoText}>Created by: {dispute.creator_name}</Text>
              <Text style={styles.infoText}>Created: {formatDate(dispute.created_at)}</Text>
              <Text style={styles.infoText}>Status: {dispute.status}</Text>
            </View>
          </View>

          {/* Invitation Actions */}
          {isInvited && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>You're Invited!</Text>
              <Text style={styles.invitationText}>
                {dispute.creator_name} has invited you to participate in this dispute. 
                Would you like to accept or reject the invitation?
              </Text>
              <View style={styles.invitationButtons}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={handleJoinDispute}
                  disabled={submitting}
                >
                  <Text style={styles.actionButtonText}>
                    {submitting ? 'Joining...' : 'Accept'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={handleRejectDispute}
                  disabled={submitting}
                >
                  <Text style={styles.actionButtonText}>
                    {submitting ? 'Rejecting...' : 'Reject'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Participants */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participants</Text>
            {dispute.participants.map((participant, index) => (
              <View key={index} style={styles.participantItem}>
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>{participant.name}</Text>
                  <Text style={styles.participantEmail}>{participant.email}</Text>
                </View>
                <Text style={styles.participantStatus}>
                  {getParticipantStatus(participant)}
                </Text>
              </View>
            ))}
          </View>

          {/* Response Section */}
          {canSubmitResponse && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Response</Text>
              <Text style={styles.responsePrompt}>
                Describe the dispute in your own words. What happened? What did you do? 
                What did the other participants do? What is the problem as you see it, and how do you feel about it? Finally, what outcome would you like to achieve?
              </Text>
              <TextInput
                style={styles.responseInput}
                placeholder="Share your side of the story..."
                value={responseText}
                onChangeText={setResponseText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>{responseText.length} characters</Text>
              
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!responseText.trim() || submitting) && styles.buttonDisabled
                ]}
                onPress={handleSubmitResponse}
                disabled={!responseText.trim() || submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : 
                   currentUserParticipant?.response_text ? 'Update Response' : 'Submit Response'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Completed Dispute - Show Verdict */}
          {dispute.status === 'completed' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Verdict</Text>
              <View style={styles.verdictContainer}>
                <Text style={styles.verdictText}>
                  {dispute.verdict || 'NO VERDICT EXISTS'}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  disputeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  disputeInfo: {
    gap: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  invitationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  invitationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  participantEmail: {
    fontSize: 14,
    color: '#666',
  },
  participantStatus: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  responsePrompt: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  responseInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  verdictContainer: {
    backgroundColor: '#f0f9f0',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  verdictText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  responseItem: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  responseAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  responseContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  responseDate: {
    fontSize: 12,
    color: '#666',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
  },
});