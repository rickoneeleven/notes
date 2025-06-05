class AuthManager {
    constructor(app) {
        this.app = app;
    }

    setApp(app) {
        this.app = app;
    }

    checkAuthentication() {
        const authCookie = document.cookie.split('; ').find(row => row.startsWith('auth_session='));
        this.app.isAuthenticated = !!authCookie;
    }

    async login(password) {
        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            
            if (response.ok) {
                this.app.isAuthenticated = true;
                this.app.ui.hideLoginModal();
                this.app.ui.updateAuthenticationUI();
                this.app.updateUI();
                this.app.noteManager.loadNotes();
                return true;
            } else {
                alert('Invalid password');
                return false;
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed');
            return false;
        }
    }

    async logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            this.app.isAuthenticated = false;
            this.app.pollingManager.stopAllPolling();
            this.app.ui.updateAuthenticationUI();
            this.app.noteManager.loadNotes();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }
    
    isAuthenticated() {
        return this.app.isAuthenticated;
    }
}

export default AuthManager;