const API_URL =  'https://fairenough-production.up.railway.app/api'
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

export const getContacts = async (token) => {
  try {
    const response = await fetch(`${API_URL}/contacts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json(); // Read response only once

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get contacts');
    }

    return data;
  } catch (error) {
    console.log('Error in getContacts:', error.message);
    throw error;
  }
};

export const sendContactRequest = async (email, token) => {
  try {
    const response = await fetch(`${API_URL}/contacts/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send contact request');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const approveContactRequest = async (requestId, token) => {
  try {
    const response = await fetch(`${API_URL}/contacts/${requestId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to approve request');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const rejectContactRequest = async (requestId, token) => {
  try {
    const response = await fetch(`${API_URL}/contacts/${requestId}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reject request');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const removeContact = async (contactId, token) => {
  try {
    const response = await fetch(`${API_URL}/contacts/${contactId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to remove contact');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const getDisputes = async (token) => {
  try {
    const response = await fetch(`${API_URL}/disputes`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get disputes');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const createDispute = async (disputeData, token) => {
  try {
    const response = await fetch(`${API_URL}/disputes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(disputeData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create dispute');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const getDisputeById = async (disputeId, token) => {
  try {
    const response = await fetch(`${API_URL}/disputes/${disputeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get dispute details');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const joinDispute = async (disputeId, token) => {
  try {
    const response = await fetch(`${API_URL}/disputes/${disputeId}/join`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to join dispute');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const rejectDispute = async (disputeId, token) => {
  try {
    const response = await fetch(`${API_URL}/disputes/${disputeId}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reject dispute');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const submitDisputeResponse = async (disputeId, responseText, token) => {
  try {
    const response = await fetch(`${API_URL}/disputes/${disputeId}/response`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ response_text: responseText }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit response');
    }

    return data;
  } catch (error) {
    throw error;
  }
};
