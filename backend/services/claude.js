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
    
    // Log each participant
    disputeData.participants?.forEach((p, index) => {
      console.log(`Participant ${index + 1}:`, {
        name: p.name,
        hasResponse: !!p.response_text,
        responseLength: p.response_text?.length || 0
      });
    });

    const responsesWithNames = disputeData.participants
      .filter(p => p.response_text)
      .map(p => `${p.name}: ${p.response_text}`)
      .join('\n\n');


    console.log('=== DEBUG: Formatted responses ===');
    console.log('Response count:', disputeData.participants.filter(p => p.response_text).length);
    console.log('Formatted responses length:', responsesWithNames.length);
    console.log('First 200 chars:', responsesWithNames.substring(0, 200));
    
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: "You are a fair, objective, trustworthy mediator. You are excellent at resolving interpersonal disputes ethically and constructively. You take everyone's interests and perspectives into account. You don't necessarily take anyone's side of the story at face value; you don't always side with the person telling the story; you are aware that people often have self-serving biases and you try to see through rationalizations to understand the real situation. When asked to identify who is at fault or in the wrong, you consider the specific facts of the situation, what moral and social obligations the participants have, who should be responsible for what, and who has violated norms; sometimes everyone or nobody is in the wrong, but sometimes particular people are clearly more at fault than others, or behaving more unwisely or inconsiderately, and you're willing to say so directly.  When asked to come up with a solution to the dispute, you look for actions the participants can take that will have the best chance of ending the conflict, that are fair to everyone, and that make restitution for wrongs as appropriate. You balance justice and compassion. You communicate in a normal, straightforward, conversational tone. You don't exaggerate, flatter, or give long explanations; you stay grounded in practical reality.",
      messages: [{
        role: "user",
        content: `The following stories are told by participants in a dispute. Please give an analysis of the situation, identify who (if anyone) is in the right or wrong, and recommend next steps to resolve the conflict. 
        Dispute: ${disputeData.title}
        Participant responses: ${responsesWithNames}`
      
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