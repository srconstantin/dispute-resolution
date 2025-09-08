import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { getDisputeById, joinDispute, rejectDispute, submitDisputeResponse, deleteDispute, leaveDispute} from '../services/api';
import { theme } from '../styles/theme';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function DisputeDetailScreen({ route, navigation, token, currentUserId }) {
  const { disputeId } = route.params
  const [dispute, setDispute] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showSuccess, showError, hideToast } = useToast();

  useEffect(() => {
    loadDisputeDetails();
  }, []);

 useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadDisputeDetails();
    });

    return unsubscribe;
  }, [navigation]);

  const loadDisputeDetails = async () => {
    try {
      const data = await getDisputeById(disputeId, token);
      setDispute(data.dispute);
      
      const currentUserParticipant = data.dispute.participants.find(p => p.user_id === currentUserId);
      if (currentUserParticipant && currentUserParticipant.response_text) {
        setResponseText(currentUserParticipant.response_text);
      }
    } catch (error) {
      showError('Failed to load dispute details');
      console.error('Error loading dispute:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cross-platform confirmation dialog
  const showConfirmDialog = (title, message, onConfirm, confirmText = 'Confirm') => {
    if (Platform.OS === 'web') {
      // Use window.confirm for web
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        onConfirm();
      }
    } else {
      // Use Alert.alert for mobile
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: confirmText,
            style: 'destructive',
            onPress: onConfirm
          }
        ]
      );
    }
  };

  const handleDeleteDispute = async () => {
    showConfirmDialog(
      'Delete Dispute',
      'Are you sure you want to delete this dispute? This will permanently remove the dispute and all associated data. This action cannot be undone.',
      async () => {
        try {
          setSubmitting(true);
          await deleteDispute(disputeId, token);
          showSuccess('Dispute deleted successfully');
          navigation.goBack();
        } catch (error) {
          showError(error.message || 'Failed to delete dispute');
        } finally {
          setSubmitting(false);
        }
      },
      'Delete'
    );
  };

  const handleLeaveDispute = async () => {
    showConfirmDialog(
      'Leave Dispute',
      'Are you sure you want to leave this dispute? You will no longer be able to participate and cannot rejoin later.',
      async () => {
        try {
          setSubmitting(true);
          await leaveDispute(disputeId, token);
          showSuccess('You have left the dispute');
          navigation.goBack();
        } catch (error) {
          showError(error.message || 'Failed to leave dispute');
        } finally {
          setSubmitting(false);
        }
      },
      'Leave'
    );
  };

  const handleJoinDispute = async () => {
    try {
      setSubmitting(true);
      await joinDispute(disputeId, token);
      showSuccess('You have joined the dispute!')
      loadDisputeDetails();

    } catch (error) {
      showError(error.message || 'Failed to join dispute');
    } finally {
      setSubmitting(false);
    }
  };


  const handleRejectDispute = async () => {
    showConfirmDialog(
      'Reject Dispute',
      'Are you sure you want to reject this dispute? This action cannot be undone.',
      async () => {
        try {
          setSubmitting(true);
          await rejectDispute(disputeId, token);
          showSuccess('You have rejected the dispute');
          navigation.goBack();
        } catch (error) {
          showError(error.message || 'Failed to reject dispute');
        } finally {
          setSubmitting(false);
        }
      },
      'Reject'
    );
  };


  const handleSubmitResponse = async () => {
    if (!responseText.trim()) {
      showError('Please enter your response');
      return;
    }

    try {
      setSubmitting(true);
      const result = await submitDisputeResponse(disputeId, responseText.trim(), token);
      
      if (result.result.completed) {
        showSuccess('Response submitted! All participants have responded - dispute is now completed.');
      } else {
        showSuccess('Response submitted successfully');
      }
      
      loadDisputeDetails();
    } catch (error) {
      showError(error.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };
 
 if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (!dispute) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text>Dispute not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentUserParticipant = dispute.participants?.find(p => p.user_id === currentUserId);
  const isCreator = dispute.creator_id === currentUserId;
  const isInvited = currentUserParticipant?.status === 'invited';
  const isAccepted = currentUserParticipant?.status === 'accepted';
  const canSubmitResponse = isAccepted && dispute.status === 'ongoing';
  const canDelete = isCreator && dispute.status !== 'completed' && dispute.status !== 'resolved';
  const canLeave = !isCreator && isAccepted && dispute.status === 'ongoing';


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
    if (participant.status === 'invited') return 'Invited';
    if (participant.status === 'accepted' && participant.response_text) return 'Responded';
    if (participant.status === 'accepted') return 'Joined';
    if (participant.status === 'rejected') return 'Rejected';
    return participant.status;
  };

  const markdownStyles = {
    body: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.colors.text,
      fontFamily: theme.fonts.body,
    },
    paragraph: {
      marginBottom: theme.spacing.md,
    },
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back-outline" size={20} color={theme.colors.primary} style={{marginRight: 4}} />
            <Text style={styles.backButtonText}>Back</Text>
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

          {/* Action Buttons for Creator and Participants */}
          {(canDelete || canLeave) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actions</Text>
              {canDelete && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={handleDeleteDispute}
                  disabled={submitting}
                >
                  <Ionicons name="trash-outline" size={18} color="#FFFFFF" style={{marginRight: 8}} />
                  <Text style={styles.actionButtonText}>
                    {submitting ? 'Deleting...' : 'Delete Dispute'}
                  </Text>
                </TouchableOpacity>
              )}
              {canLeave && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.leaveButton]}
                  onPress={handleLeaveDispute}
                  disabled={submitting}
                >
                  <Ionicons name="exit-outline" size={18} color="#FFFFFF" style={{marginRight: 8}} />
                  <Text style={styles.actionButtonText}>
                    {submitting ? 'Leaving...' : 'Leave Dispute'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Participants */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participants</Text>
            {dispute.participants.map((participant, index) => (
              <View key={index} style={styles.participantItem}>
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>
                    {participant.name}
                    {participant.user_id === dispute.creator_id && ' (Creator)'}
                  </Text>
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
                <Markdown style={markdownStyles}>
                  {dispute.verdict || 'Verdict will appear here'}
                </Markdown>
              </View>
            </View>
          )}
        </ScrollView>

        {toast.visible && (
          <Toast 
            message={toast.message}
            type={toast.type}
            onHide={hideToast}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 50,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.small,
  },
  backButton: {
    marginRight: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingRegular,
  },
  title: {
    fontSize: 22,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  disputeTitle: {
    fontSize: 22,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  disputeInfo: {
    gap: 4,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  invitationText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
    fontFamily: theme.fonts.body,
  },
  invitationButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: theme.borderRadius.small,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: theme.colors.success,
  },
  rejectButton: {
    backgroundColor: theme.colors.error,
  },

  deleteButton: {
    backgroundColor: '#DC2626', // Red color for delete
  },
  leaveButton: {
    backgroundColor: '#F59E0B', // Orange color for leave
  },

  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
  },
  participantEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  participantStatus: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.headingRegular,
  },
  responsePrompt: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
    fontFamily: theme.fonts.body,
  },
  responseInput: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.small,
    padding: theme.spacing.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: theme.fonts.body,
  },
  characterCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    fontFamily: theme.fonts.body,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.small,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.small,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.textLight,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
  },
  verdictContainer: {
    backgroundColor: '#F0F9F0',
    borderRadius: theme.borderRadius.small,
    padding: theme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error,
    fontFamily: theme.fonts.body,
  },
});
