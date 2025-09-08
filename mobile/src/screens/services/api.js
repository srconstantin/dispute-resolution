const API_URL = 'https://e3fc094bfa97.ngrok-free.app/api';

export const createUser = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const loginUser = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const inviteToDispute = async (disputeId, participant_emails, token) => {
  try {
    const response = await fetch(`${API_URL}/disputes/${disputeId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ participant_emails }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to invite participants');
    }

    return data;
  } catch (error) {
    throw error;
  }
};
