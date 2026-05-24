// Check if user is logged in
if (localStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = 'login.html';
}

// Display username
const username = localStorage.getItem('username') || 'User';
document.getElementById('username').textContent = username;

// Navigation function
function navigateTo(page) {
    window.location.href = page;
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear session
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        
        // Call logout endpoint
        fetch('http://localhost:5000/api/logout', {
            method: 'POST',
            credentials: 'include'
        }).then(() => {
            window.location.href = 'login.html';
        }).catch(() => {
            // Even if API call fails, redirect to login
            window.location.href = 'login.html';
        });
    }
}

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.altKey) {
        switch(e.key) {
            case '1':
                navigateTo('form.html');
                break;
            case '2':
                navigateTo('dashboard.html');
                break;
            case '3':
                navigateTo('categories.html');
                break;
        }
    }
});
