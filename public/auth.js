function showAuthError(message) {
  const el = document.getElementById('authError');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideAuthError() {
  const el = document.getElementById('authError');
  if (el) el.classList.add('hidden');
}

function showAuthSuccess(message) {
  const el = document.getElementById('authSuccess');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

async function submitAuthForm(url, body, submitBtn, onSuccess, onFailure) {
  hideAuthError();
  submitBtn.disabled = true;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      if (onFailure && onFailure(data, response.status)) return;
      showAuthError(data.error || 'Something went wrong. Please try again.');
      submitBtn.disabled = false;
      return;
    }
    onSuccess(data);
  } catch (err) {
    showAuthError('Network error — please try again.');
    submitBtn.disabled = false;
  }
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitAuthForm('/login/signup', {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
      termsAgreed: document.getElementById('termsAgreed').checked,
    }, submitBtn, (data) => {
      window.location.href = '/verify-code.html?email=' + encodeURIComponent(data.email);
    });
  });
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitAuthForm('/login/local', {
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
    }, submitBtn, () => { window.location.href = '/app'; }, (data) => {
      // Account exists but hasn't finished the signup verification-code step yet —
      // send them back there instead of just showing an error with no way forward.
      if (data.requiresVerification) {
        window.location.href = '/verify-code.html?email=' + encodeURIComponent(data.email);
        return true;
      }
      return false;
    });
  });

  // Banners from links landed on this page (reset flow).
  const params = new URLSearchParams(window.location.search);
  if (params.get('reset')) {
    showAuthSuccess('Password updated — log in with your new password.');
  }
}

const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
  forgotForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitAuthForm('/login/forgot-password', {
      email: document.getElementById('email').value.trim(),
    }, submitBtn, (data) => {
      showAuthSuccess(data.message || "If that email has an account, we've sent a reset link.");
      forgotForm.reset();
    });
  });
}

const resetForm = document.getElementById('resetForm');
if (resetForm) {
  resetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const token = new URLSearchParams(window.location.search).get('token');
    submitAuthForm('/login/reset-password', {
      token,
      password: document.getElementById('password').value,
    }, submitBtn, () => { window.location.href = '/login.html?reset=1'; });
  });
}

const verifyCodeForm = document.getElementById('verifyCodeForm');
if (verifyCodeForm) {
  const email = new URLSearchParams(window.location.search).get('email') || '';
  const sentTo = document.getElementById('codeSentTo');
  if (sentTo && email) sentTo.textContent = `Enter the 6-digit code we sent to ${email}.`;

  verifyCodeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitAuthForm('/login/verify-code', {
      email,
      code: document.getElementById('code').value.trim(),
    }, submitBtn, () => { window.location.href = '/app'; });
  });

  const resendLink = document.getElementById('resendCodeLink');
  if (resendLink) {
    resendLink.addEventListener('click', async (e) => {
      e.preventDefault();
      hideAuthError();
      try {
        const response = await fetch('/login/resend-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await response.json();
        showAuthSuccess(data.message || 'If that email needs verifying, a new code is on its way.');
      } catch {
        showAuthError('Network error — please try again.');
      }
    });
  }
}
