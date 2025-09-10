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
  Platform,
  Modal,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { 
  getDisputeById, 
  joinDispute, 
  rejectDispute, 
  submitDisputeResponse, 
  deleteDispute, 
  leaveDispute, 
  submitSatisfactionResponse,
  getContacts,
  inviteToDispute
} from '../services/api';
import { theme } from '../styles/theme';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function DisputeDetailScreen({ route, navigation, token, currentUserId }) {
  const { disputeId } = route.params;
  const [dispute, setDispute] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [additionalResponseText, setAdditionalResponseText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSatisfactionQuestion, setShowSatisfactionQuestion] = useState(false);
  const [showAdditionalResponseBox, setShowAdditionalResponseBox] = useState(false);
  const [editingResponse, setEditingResponse] = useState(false);
  const [editingRound, setEditingRound] = useState(null);

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableContacts, setAvailableContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

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

      const currentRound = data.dispute.current_round || 1;

      // Set response text for current round if user has responded
      if (data.dispute.responses_by_round && data.dispute.responses_by_round[currentRound]) {
        const currentRoundResponses = data.dispute.responses_by_round[currentRound];
        const userResponse = currentRoundResponses.find(r => r.user_id === currentUserId);
        if (userResponse) {
          setResponseText(userResponse.response_text);
        }
      } else {
        // Fall back to old format for backward compatibility
        const currentUserParticipant = data.dispute.participants.find(p => p.user_id === currentUserId);
        if (currentUserParticipant && currentUserParticipant.response_text) {
          setResponseText(currentUserParticipant.response_text);
        }
      }

      // Check if user needs to see satisfaction question
      const currentVerdict = data.dispute.verdicts && data.dispute.verdicts.length > 0 ? 
        data.dispute.verdicts.find(v => v.round_number === currentRound) : 
        (data.dispute.verdict ? { verdict: data.dispute.verdict, round_number: 1 } : null);
      
      const userSatisfaction = data.dispute.satisfaction && data.dispute.satisfaction.length > 0 ?
        data.dispute.satisfaction.find(s => s.user_id === currentUserId && s.round_number === currentRound) :
        null;
    
      setShowSatisfactionQuestion(
        data.dispute.status === 'evaluated' && 
        currentVerdict && 
        !userSatisfaction
      );
      
    } catch (error) {
      showError('Failed to load dispute details');
      console.error('Error loading dispute:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSatisfactionResponse = async (isSatisfied) => {
    if (!isSatisfied && !additionalResponseText.trim()) {
      showError('Please provide additional context if you\'re not satisfied with the verdict');
      return;
    }

    setSubmitting(true);
    try {
      await submitSatisfactionResponse(disputeId, {
        is_satisfied: isSatisfied,
        additional_response: isSatisfied ? null : additionalResponseText
      }, token);
      
      if (isSatisfied) {
        showSuccess('Thank you for your feedback');
      } else {
        showSuccess('Additional response submitted for next round');
      }
      
      setShowSatisfactionQuestion(false);
      setShowAdditionalResponseBox(false);
      setAdditionalResponseText('');
      loadDisputeDetails();
    } catch (error) {
      showError(error.message || 'Failed to submit satisfaction response');
    } finally {
      setSubmitting(false);
    }
  };

  const showConfirmDialog = (title, message, onConfirm, confirmText = 'Confirm') => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        onConfirm();
      }
    } else {
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
      showSuccess('You have joined the dispute!');
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
      
      if (result.result && result.result.round_completed) {
        showSuccess('Response submitted! All participants have responded - verdict is being generated.');
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

  const handleInviteMoreContacts = async () => {
    try {
      setLoadingContacts(true);
      const data = await getContacts(token);
      
      const existingEmails = dispute.participants.map(p => p.email);
      const available = data.contacts.filter(contact => 
        !existingEmails.includes(contact.contact_email)
      );
      
      setAvailableContacts(available);
      setSelectedContacts([]);
      setShowInviteModal(true);
    } catch (error) {
      showError('Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  const toggleContactSelection = (contact) => {
    setSelectedContacts(prev => {
      const isSelected = prev.find(c => c.contact_email === contact.contact_email);
      if (isSelected) {
        return prev.filter(c => c.contact_email !== contact.contact_email);
      } else {
        return [...prev, contact];
      }
    });
  };

  const handleSendInvitations = async () => {
    if (selectedContacts.length === 0) {
      showError('Please select at least one contact to invite');
      return;
    }

    try {
      setSubmitting(true);
      const participant_emails = selectedContacts.map(c => c.contact_email);
      
      await inviteToDispute(disputeId, participant_emails, token);
      
      showSuccess(`Invited ${selectedContacts.length} contact(s) to the dispute`);
      setShowInviteModal(false);
      loadDisputeDetails();
    } catch (error) {
      showError(error.message || 'Failed to send invitations');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper functions
  const canSubmitResponse = () => {
    if (!dispute) return false;
    
    const currentUser = dispute.participants.find(p => p.user_id === currentUserId);
    if (!currentUser || currentUser.status !== 'accepted') return false;
    
    const currentRound = dispute.current_round || 1;
    
    // Check if dispute is incomplete and user hasn't responded to current round
    if (dispute.responses_by_round && dispute.responses_by_round[currentRound]) {
      const userHasResponded = dispute.responses_by_round[currentRound].some(r => r.user_id === currentUserId);
      return dispute.status === 'incomplete' && !userHasResponded;
    } else {
      // Fall back to old format
      return dispute.status === 'incomplete' && !currentUser.response_text;
    }
  };

  const canEditResponse = () => {
    if (!dispute) return false;
    return dispute.status === 'incomplete' || dispute.status === 'evaluated';
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

  const getParticipantStatus = (participant) => {
    if (participant.status === 'invited') return 'Invited';
    if (participant.status === 'accepted' && participant.response_text) return 'Responded';
    if (participant.status === 'accepted') return 'Joined';
    if (participant.status === 'rejected') return 'Rejected';
    return participant.status;
  };

  const renderTimelineItem = (item, index) => {
    const isVerdict = item.type === 'verdict';
    const isResponse = item.type === 'response';
    
    return (
      <View key={index} style={styles.timelineItem}>
        <View style={styles.timelineMarker}>
          <View style={[
            styles.timelineDot,
            isVerdict ? styles.verdictDot : styles.responseDot
          ]} />
          {index < timeline.length - 1 && <View style={styles.timelineLine} />}
        </View>
        
        <View style={styles.timelineContent}>
          {isResponse && (
            <View style={styles.responseContainer}>
              <Text style={styles.participantName}>{item.name}</Text>
              <Text style={styles.roundLabel}>Round {item.round}</Text>
              <View style={[
                styles.responseBox,
                item.user_id === currentUserId && styles.userResponseBox
              ]}>
                <Text style={styles.responseText}>{item.response_text}</Text>
                {item.user_id === currentUserId && canEditResponse() && (
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => {
                      setResponseText(item.response_text);
                      setEditingResponse(true);
                      setEditingRound(item.round);
                    }}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.timestamp}>
                {formatDate(item.submitted_at)}
              </Text>
            </View>
          )}
          
          {isVerdict && (
            <View style={styles.verdictContainer}>
              <Text style={styles.verdictTitle}>
                Verdict - Round {item.round}
              </Text>
              <View style={styles.verdictBox}>
                <Markdown style={markdownStyles}>
                  {item.verdict}
                </Markdown>
              </View>
              <Text style={styles.timestamp}>
                {formatDate(item.generated_at)}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading dispute details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dispute) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text>Dispute not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Create chronological timeline of all responses and verdicts
  const timeline = [];
  
  // Add all responses and verdicts in chronological order
  if (dispute.responses_by_round) {
    Object.keys(dispute.responses_by_round).forEach(round => {
      const roundNum = parseInt(round);
      
      // Add responses for this round
      dispute.responses_by_round[round].forEach(response => {
        timeline.push({
          type: 'response',
          round: roundNum,
          ...response,
          sortKey: `${roundNum}-response-${response.submitted_at}`
        });
      });
      
      // Add verdict for this round if it exists
      const verdict = dispute.verdicts && dispute.verdicts.find(v => v.round_number === roundNum);
      if (verdict) {
        timeline.push({
          type: 'verdict',
          round: roundNum,
          ...verdict,
          sortKey: `${roundNum}-verdict-${verdict.generated_at}`
        });
      }
    });
  } else {
    // Fall back to old format
    dispute.participants.filter(p => p.response_text).forEach(participant => {
      timeline.push({
        type: 'response',
        round: 1,
        user_id: participant.user_id,
        name: participant.name,
        response_text: participant.response_text,
        submitted_at: participant.response_submitted_at,
        sortKey: `1-response-${participant.response_submitted_at}`
      });
    });
    
    if (dispute.verdict) {
      timeline.push({
        type: 'verdict',
        round: 1,
        verdict: dispute.verdict,
        generated_at: dispute.updated_at,
        sortKey: `1-verdict-${dispute.updated_at}`
      });
    }
  }
  
  // Sort timeline chronologically
  timeline.sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    if (a.type === 'response' && b.type === 'verdict') return -1;
    if (a.type === 'verdict' && b.type === 'response') return 1;
    return new Date(a.submitted_at || a.generated_at) - new Date(b.submitted_at || b.generated_at);
  });

  const currentUserParticipant = dispute.participants?.find(p => p.user_id === currentUserId);
  const isCreator = dispute.creator_id === currentUserId;
  const isInvited = currentUserParticipant?.status === 'invited';
  const isAccepted = currentUserParticipant?.status === 'accepted';
  const canDelete = isCreator && dispute.status !== 'evaluated' && dispute.status !== 'concluded';
  const canLeave = !isCreator && isAccepted && dispute.status === 'incomplete';
  const canInvite = isCreator && dispute.status === 'incomplete';

  const markdownStyles = {
    body: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.colors.text,
    },
    strong: {
      fontWeight: 'bold',
    },
    em: {
      fontStyle: 'italic',
    },
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
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

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          
          {/* Dispute Header */}
          <View style={styles.header}>
            <Text style={styles.disputeTitle}>{dispute.title}</Text>
            <Text style={styles.subtitle}>
              Created by {dispute.creator_name} • Round {dispute.current_round || 1} • {dispute.status}
            </Text>
          </View>

          {/* Status Summary */}
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>
                {dispute.status === 'incomplete' && 'Waiting for all participants to respond'}
                {dispute.status === 'evaluated' && 'Verdict available - awaiting participant feedback'}
                {dispute.status === 'concluded' && 'Dispute concluded - all participants satisfied'}
                {dispute.status === 'cancelled' && 'Dispute cancelled'}
                {dispute.status === 'rejected' && 'Dispute rejected'}
              </Text>
            </View>
          </View>

          {/* Accept/Reject Invitation */}
          {isInvited && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Invitation</Text>
              <Text style={styles.invitationText}>
                You've been invited to participate in this dispute. Do you accept?
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={handleJoinDispute}
                  disabled={submitting}
                >
                  <Text style={styles.actionButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={handleRejectDispute}
                  disabled={submitting}
                >
                  <Text style={styles.actionButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Participants */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participants</Text>
            {dispute.participants.map((participant) => (
              <View key={participant.user_id} style={styles.participantRow}>
                <Text style={styles.participantName}>
                  {participant.name}
                  {participant.user_id === currentUserId && ' (You)'}
                  {participant.user_id === dispute.creator_id && ' (Creator)'}
                </Text>
                <Text style={[
                  styles.participantStatus,
                  participant.status === 'accepted' ? styles.acceptedStatus : 
                  participant.status === 'rejected' ? styles.rejectedStatus : styles.invitedStatus
                ]}>
                  {participant.status}
                </Text>
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          {(canDelete || canLeave || canInvite) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actions</Text>
              {canInvite && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.inviteButton]}
                  onPress={handleInviteMoreContacts}
                  disabled={submitting || loadingContacts}
                >
                  <Text style={styles.actionButtonText}>
                    {loadingContacts ? 'Loading...' : 'Invite More Contacts'}
                  </Text>
                </TouchableOpacity>
              )}
              {canDelete && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={handleDeleteDispute}
                  disabled={submitting}
                >
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
                  <Text style={styles.actionButtonText}>
                    {submitting ? 'Leaving...' : 'Leave Dispute'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Current Round Response Input */}
          {canSubmitResponse() && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Your Response - Round {dispute.current_round || 1}
              </Text>
              <Text style={styles.responsePrompt}>
                {(dispute.current_round && dispute.current_round > 1)
                  ? "Please add any context, corrections, updates, or counterpoints that haven't been adequately considered in the discussion so far."
                  : "Describe the dispute in your own words. What happened? What did you do? What did the other participants do? What is the problem as you see it, and how do you feel about it? Finally, what outcome would you like to achieve?"
                }
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
                  {submitting ? 'Submitting...' : 'Submit Response'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Satisfaction Question */}
          {showSatisfactionQuestion && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Verdict Feedback</Text>
              <Text style={styles.satisfactionQuestion}>
                Are you satisfied with the verdict or do you want to discuss further?
              </Text>
              
              {showAdditionalResponseBox && (
                <View style={styles.additionalResponseContainer}>
                  <Text style={styles.responsePrompt}>
                    Please add any context, corrections, updates, or counterpoints that haven't been adequately considered in the discussion so far.
                  </Text>
                  <TextInput
                    style={styles.responseInput}
                    placeholder="Additional context or corrections..."
                    value={additionalResponseText}
                    onChangeText={setAdditionalResponseText}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  <Text style={styles.characterCount}>{additionalResponseText.length} characters</Text>
                </View>
              )}
              
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.satisfiedButton]}
                  onPress={() => handleSatisfactionResponse(true)}
                  disabled={submitting}
                >
                  <Text style={styles.actionButtonText}>
                    {submitting ? 'Submitting...' : 'Satisfied'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.notSatisfiedButton]}
                  onPress={() => {
                    if (showAdditionalResponseBox) {
                      handleSatisfactionResponse(false);
                    } else {
                      setShowAdditionalResponseBox(true);
                    }
                  }}
                  disabled={submitting || (showAdditionalResponseBox && !additionalResponseText.trim())}
                >
                  <Text style={styles.actionButtonText}>
                    {showAdditionalResponseBox ? 'Submit Additional Response' : 'Not Satisfied'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Timeline of Responses and Verdicts */}
          {timeline.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Discussion Timeline</Text>
              {timeline.map((item, index) => renderTimelineItem(item, index))}
            </View>
          )}

          {/* Edit Response Modal */}
          {editingResponse && (
            <Modal
              visible={editingResponse}
              animationType="slide"
              presentationStyle="pageSheet"
            >
              <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setEditingResponse(false)}>
                    <Text style={styles.cancelButton}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Edit Response</Text>
                  <TouchableOpacity 
                    onPress={async () => {
                      setEditingResponse(false);
                      await handleSubmitResponse();
                    }}
                    disabled={!responseText.trim() || submitting}
                  >
                    <Text style={[
                      styles.saveButton,
                      (!responseText.trim() || submitting) && styles.buttonDisabled
                    ]}>
                      Save
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.modalContent}>
                  <Text style={styles.modalPrompt}>
                    Edit your response for Round {editingRound}:
                  </Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={responseText}
                    onChangeText={setResponseText}
                    multiline
                    textAlignVertical="top"
                    autoFocus
                  />
                  <Text style={styles.characterCount}>{responseText.length} characters</Text>
                </View>
              </SafeAreaView>
            </Modal>
          )}

          {/* Invite More Contacts Modal */}
          {showInviteModal && (
            <Modal
              visible={showInviteModal}
              animationType="slide"
              presentationStyle="pageSheet"
            >
              <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                    <Text style={styles.cancelButton}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Invite Contacts</Text>
                  <TouchableOpacity 
                    onPress={handleSendInvitations}
                    disabled={selectedContacts.length === 0 || submitting}
                  >
                    <Text style={[
                      styles.sendButton,
                      (selectedContacts.length === 0 || submitting) && styles.buttonDisabled
                    ]}>
                      {submitting ? 'Sending...' : 'Send'}
                    </Text>
                  </TouchableOpacity>
                </View>
        
                <View style={styles.modalContent}>
                  <Text style={styles.modalSubtitle}>
                    Select contacts to invite to this dispute ({selectedContacts.length} selected)
                  </Text>
          
                  {availableContacts.length === 0 ? (
                    <View style={styles.centerContainer}>
                      <Text style={styles.emptyText}>No additional contacts available to invite</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={availableContacts}
                      renderItem={({ item }) => {
                        const isSelected = selectedContacts.find(c => c.contact_email === item.contact_email);
                
                        return (
                          <TouchableOpacity 
                            style={[styles.contactItem, isSelected && styles.selectedContact]}
                            onPress={() => toggleContactSelection(item)}
                          >
                            <View style={styles.contactInfo}>
                              <Text style={styles.contactName}>{item.contact_name}</Text>
                              <Text style={styles.contactEmail}>{item.contact_email}</Text>
                            </View>
                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                              {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                            </View>
                          </TouchableOpacity>
                        );
                      }}
                      keyExtractor={(item) => item.contact_email}
                      showsVerticalScrollIndicator={false}
                    />
                  )}
                </View>
              </SafeAreaView>
            </Modal>
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
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error,
    fontFamily: theme.fonts.body,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    marginRight: 16,
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
  disputeHeader: {
    marginBottom: 24,
  },
  disputeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
    marginBottom: 12,
  },
  statusSection: {
    marginBottom: 24,
  },
  statusContainer: {
    backgroundColor: theme.colors.surfaceSecondary,
    padding: 12,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  participantName: {
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.headingRegular,
    flex: 1,
  },
  participantStatus: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: theme.fonts.headingMedium,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  acceptedStatus: {
    color: '#1B7B3A', // Darker, muted green
    backgroundColor: '#E8F5E8', // Light green background
  },
  rejectedStatus: {
    color: '#B91C1C', // Darker, muted red
    backgroundColor: '#FEF2F2', // Light red background
  },
  invitedStatus: {
    color: '#D97706', // Darker, muted orange
    backgroundColor: '#FEF3C7', // Light orange background
  },
  responsePrompt: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    marginBottom: 12,
    lineHeight: 20,
  },
  responseInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    backgroundColor: theme.colors.surface,
    minHeight: 120,
  },
  characterCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.fonts.headingMedium,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.fonts.headingMedium,
    color: '#FFFFFF',
  },
  acceptButton: {
    backgroundColor: '#16A34A', // More muted green
  },
  rejectButton: {
    backgroundColor: '#DC2626', // More muted red
  },
  satisfiedButton: {
    backgroundColor: '#16A34A', // More muted green
  },
  notSatisfiedButton: {
    backgroundColor: '#EA580C', // More muted orange
  },
  inviteButton: {
    backgroundColor: theme.colors.primary,
  },
  deleteButton: {
    backgroundColor: '#DC2626', // Muted red
  },
  leaveButton: {
    backgroundColor: '#EA580C', // Muted orange
  },
  satisfactionQuestion: {
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.headingRegular,
    marginBottom: 16,
    fontWeight: '500',
  },
  additionalResponseContainer: {
    marginBottom: 16,
  },
  invitationText: {
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineMarker: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  responseDot: {
    backgroundColor: theme.colors.primary,
  },
  verdictDot: {
    backgroundColor: theme.colors.warning,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginTop: 8,
  },
  timelineContent: {
    flex: 1,
  },
  responseContainer: {
    marginBottom: 8,
  },
  responseBox: {
    backgroundColor: theme.colors.surfaceSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  userResponseBox: {
    backgroundColor: theme.colors.primaryBackground,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  responseText: {
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    lineHeight: 22,
  },
  editButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  editButtonText: {
    color: theme.colors.surface,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: theme.fonts.headingMedium,
  },
  verdictContainer: {
    marginBottom: 8,
  },
  verdictTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
    marginBottom: 8,
  },
  verdictBox: {
    backgroundColor: theme.colors.warningBackground,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warning,
    marginBottom: 8,
  },
  roundLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
  },
  cancelButton: {
    fontSize: 16,
    color: theme.colors.error,
    fontFamily: theme.fonts.headingRegular,
  },
  saveButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingMedium,
    fontWeight: '600',
  },
  sendButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingMedium,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalPrompt: {
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.headingRegular,
    marginBottom: 16,
  },
  modalTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    backgroundColor: theme.colors.surface,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  selectedContact: {
    backgroundColor: theme.colors.primaryBackground,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
  },
  contactEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    textAlign: 'center',
  },
});