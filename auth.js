// Authentication check - include this in all protected pages
(function() {
    // Check if user is logged in
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
        return;
    }
    
    // Add top navigation bar
    function addTopNav() {
        // Check if top nav already exists
        if (document.querySelector('.auth-top-nav')) return;
        
        const topNav = document.createElement('div');
        topNav.className = 'auth-top-nav';
        
        const username = localStorage.getItem('username') || 'User';
        const userRole = localStorage.getItem('userRole') || 'contributor';
        const roleDisplay = userRole === 'owner' ? '👑 Owner' : '👤 Contributor';
        
        topNav.innerHTML = `
            <div class="auth-nav-container">
                <div class="auth-welcome">
                    <span class="auth-icon">${userRole === 'owner' ? '👑' : '👤'}</span>
                    <span class="auth-user-text">Welcome, <strong>${username}</strong> <span class="role-badge">(${roleDisplay})</span></span>
                </div>
                <div class="auth-buttons">
                    <a href="home.html" class="btn-home-top">🏠 Home</a>
                    <button class="btn-logout-top" id="authLogoutBtn">🚪 Logout</button>
                </div>
            </div>
        `;
        
        document.body.insertBefore(topNav, document.body.firstChild);
        
        // Add logout handler
        document.getElementById('authLogoutBtn').onclick = function() {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('username');
                localStorage.removeItem('userRole');
                
                fetch('http://localhost:5000/api/logout', {
                    method: 'POST',
                    credentials: 'include'
                }).finally(() => {
                    window.location.href = 'login.html';
                });
            }
        };
        
        // Add CSS for the top nav
        if (!document.getElementById('auth-styles')) {
            const style = document.createElement('style');
            style.id = 'auth-styles';
            style.textContent = `
                body {
                    padding-top: 60px !important;
                }
                
                .auth-top-nav {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    z-index: 10000;
                    padding: 10px 0;
                }
                
                .auth-nav-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .auth-welcome {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: white;
                    font-size: 15px;
                }
                
                .auth-icon {
                    font-size: 24px;
                }
                
                .auth-user-text {
                    font-weight: 400;
                }
                
                .auth-user-text strong {
                    font-weight: 700;
                }
                
                .role-badge {
                    font-size: 0.85em;
                    opacity: 0.9;
                    font-weight: 500;
                }
                
                .auth-buttons {
                    display: flex;
                    gap: 12px;
                }
                
                .btn-home-top,
                .btn-logout-top {
                    padding: 8px 20px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .btn-home-top {
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
                
                .btn-home-top:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: translateY(-1px);
                }
                
                .btn-logout-top {
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    color: white;
                }
                
                .btn-logout-top:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
                }
                
                @media (max-width: 768px) {
                    body {
                        padding-top: 100px !important;
                    }
                    
                    .auth-nav-container {
                        flex-direction: column;
                        gap: 12px;
                    }
                    
                    .auth-welcome {
                        font-size: 13px;
                    }
                    
                    .auth-buttons {
                        width: 100%;
                        justify-content: center;
                    }
                    
                    .btn-home-top,
                    .btn-logout-top {
                        padding: 8px 16px;
                        font-size: 13px;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addTopNav);
    } else {
        addTopNav();
    }
})();
