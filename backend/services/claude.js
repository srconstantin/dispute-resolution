const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY, // Store in environment variable
});

const generateVerdict = async (disputeData) => {
  try {

    console.log('=== DEBUG: Dispute data received ===');
    console.log('Dispute ID:', disputeData.id);
    console.log('Dispute title:', disputeData.title);
    console.log('Dispute status:', disputeData.status);
    console.log('Number of participants:', disputeData.participants?.length);

    // Handle both old and new data formats
    let allResponses = [];
    let isMultiRound = false;

    if (disputeData.all_responses && disputeData.all_responses.length > 0) {
      // New multi-round format
      allResponses = disputeData.all_responses;
      isMultiRound = true;
      console.log('Total responses across all rounds:', allResponses.length);
    } else if (disputeData.participants) {
      // Old format - convert to new format
      allResponses = disputeData.participants
        .filter(p => p.response || p.response_text)
        .map(p => ({
          round: 1,
          name: p.name,
          response_text: p.response || p.response_text
        }));
      console.log('Converted from old format, total responses:', allResponses.length);
    }
  
      // Organize responses by round and participant for better formatting
    const responsesByRound = {};
    const participantNames = new Set();
    
    allResponses.forEach(response => {
      if (!responsesByRound[response.round]) {
        responsesByRound[response.round] = [];
      }
      responsesByRound[response.round].push(response);
      participantNames.add(response.name);
    });

    console.log('Participants:', Array.from(participantNames));
    console.log('Rounds with responses:', Object.keys(responsesByRound));

    // Format the conversation history for Claude
    let conversationHistory = '';

    // Add initial round
    if (responsesByRound[1]) {
      conversationHistory += "=== INITIAL ROUND ===\n";
      responsesByRound[1].forEach(response => {
        conversationHistory += `${response.name}: ${response.response_text}\n\n`;
      });
    }

    // Add subsequent rounds if they exist
    for (let round = 2; round <= disputeData.round_number; round++) {
      if (responsesByRound[round]) {
        conversationHistory += `=== ROUND ${round} - ADDITIONAL RESPONSES ===\n`;
        responsesByRound[round].forEach(response => {
          conversationHistory += `${response.name}: ${response.response_text}\n\n`;
        });
      }
    }

    console.log('=== DEBUG: Formatted conversation history ===');
    console.log('History length:', conversationHistory.length);
    console.log('First 300 chars:', conversationHistory.substring(0, 300));

    const isFollowUp = disputeData.round_number > 1;
    
    let promptContent;
    if (isFollowUp) {
      promptContent = `The following is an ongoing dispute that has had ${disputeData.round_number} rounds of discussion. After the initial round, a verdict was provided, but some participants were not satisfied and provided additional context, corrections, or counterpoints.

Please provide an updated analysis of the situation, taking into account ALL of the information provided across all rounds. Consider how the additional responses change or reinforce your understanding of the situation.

Dispute: ${disputeData.title}

${conversationHistory}

Please give a comprehensive analysis of the situation considering all rounds of discussion, identify who (if anyone) is in the right or wrong, and recommend next steps to resolve the conflict. Address any new information or perspectives that emerged in later rounds.`;
    } else {
      promptContent = `The following stories are told by participants in a dispute. Please give an analysis of the situation, identify who (if anyone) is in the right or wrong, and recommend next steps to resolve the conflict.

Dispute: ${disputeData.title}

${conversationHistory}`;
    }


 
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: "You are a fair, objective, trustworthy mediator. You are excellent at resolving interpersonal disputes ethically and constructively. You take everyone's interests and perspectives into account. You don't necessarily take anyone's side of the story at face value; you don't always side with the person telling the story; you are aware that people often have self-serving biases and you try to see through rationalizations to understand the real situation. When asked to identify who is at fault or in the wrong, you consider the specific facts of the situation, what moral and social obligations the participants have, who should be responsible for what, and who has violated norms; sometimes everyone or nobody is in the wrong, but sometimes particular people are clearly more at fault than others, or behaving more unwisely or inconsiderately, and you're willing to say so directly.  When asked to come up with a solution to the dispute, you look for actions the participants can take that will have the best chance of ending the conflict, that are fair to everyone, and that make restitution for wrongs as appropriate. You balance justice and compassion. You communicate in a normal, straightforward, conversational tone. You don't exaggerate, flatter, or give long explanations; you stay grounded in practical reality.",
      messages: [{
        role: "user",
        content: promptContent
      
      }]
    });

    console.log('=== DEBUG: Claude response ===');
    console.log('Response length:', message.content[0].text.length);
    console.log('Response preview:', message.content[0].text.substring(0, 200));
    
    
    return message.content[0].text;
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
};

module.exports = { generateVerdict };