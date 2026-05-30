document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in - verify with server
    if (localStorage.getItem('isLoggedIn') === 'true') {
        fetch('/api/check-auth', { credentials: 'include' })
            .then(res => {
                if (res.ok) {
                    window.location.href = 'home.html';
                } else {
                    // Server session expired, clear local state
                    localStorage.removeItem('isLoggedIn');
                    localStorage.removeItem('username');
                    localStorage.removeItem('userRole');
                }
            })
            .catch(() => {
                // Server unreachable, stay on login
            });
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('errorMessage');
        const btnText = document.getElementById('btnText');
        const btnLoader = document.getElementById('btnLoader');
        const loginBtn = document.querySelector('.btn-login');
        
        // Hide error message
        errorMessage.classList.remove('show');
        
        // Show loading state
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';
        loginBtn.disabled = true;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
                credentials: 'include' // Important for session cookies
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Login successful
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('username', data.username);
                localStorage.setItem('userRole', data.role);
                window.location.href = 'home.html';
            } else {
                // Login failed
                errorMessage.textContent = data.error || 'Invalid username or password';
                errorMessage.classList.add('show');
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = 'Connection error. Please check if the server is running.';
            errorMessage.classList.add('show');
        } finally {
            // Reset button state
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
            loginBtn.disabled = false;
        }
    });
});
