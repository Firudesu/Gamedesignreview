// GitHub Storage System for Game Design Review
class GitHubStorage {
    constructor() {
        // Remove hardcoded token for security - will be set via environment or user input
        this.token = null;
        this.owner = 'Firudesu';
        this.repo = 'game-review-data';
        this.baseUrl = 'https://api.github.com';
    }

    // Method to set token (called after user provides it)
    setToken(token) {
        this.token = token;
    }

    // Check if token is available
    hasToken() {
        return this.token && this.token.length > 0;
    }

    // Helper method to make GitHub API requests
    async makeRequest(endpoint, options = {}) {
        if (!this.hasToken()) {
            throw new Error('GitHub token not set. Please configure your token first.');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    // Get file content from GitHub
    async getFile(path) {
        try {
            const response = await this.makeRequest(`/repos/${this.owner}/${this.repo}/contents/${path}`);
            
            if (response.type === 'file') {
                const content = atob(response.content);
                return JSON.parse(content);
            }
            return null;
        } catch (error) {
            if (error.message.includes('404')) {
                return null; // File doesn't exist
            }
            throw error;
        }
    }

    // Create or update file in GitHub
    async putFile(path, content, message = 'Update data') {
        try {
            // First, try to get the existing file to get its SHA
            let sha = null;
            try {
                const existingFile = await this.makeRequest(`/repos/${this.owner}/${this.repo}/contents/${path}`);
                sha = existingFile.sha;
            } catch (error) {
                // File doesn't exist, that's okay
            }

            const response = await this.makeRequest(`/repos/${this.owner}/${this.repo}/contents/${path}`, {
                method: 'PUT',
                body: JSON.stringify({
                    message: message,
                    content: btoa(JSON.stringify(content, null, 2)),
                    sha: sha
                })
            });

            return response;
        } catch (error) {
            console.error('Error saving to GitHub:', error);
            throw error;
        }
    }

    // Load all games
    async loadGames() {
        try {
            const games = await this.getFile('data/games.json');
            return games || [];
        } catch (error) {
            console.error('Error loading games:', error);
            return [];
        }
    }

    // Save all games
    async saveGames(games) {
        try {
            await this.putFile('data/games.json', games, 'Update games data');
            return true;
        } catch (error) {
            console.error('Error saving games:', error);
            return false;
        }
    }

    // Load all members
    async loadMembers() {
        try {
            const members = await this.getFile('data/members.json');
            return members || [];
        } catch (error) {
            console.error('Error loading members:', error);
            return [];
        }
    }

    // Save all members
    async saveMembers(members) {
        try {
            await this.putFile('data/members.json', members, 'Update members data');
            return true;
        } catch (error) {
            console.error('Error saving members:', error);
            return false;
        }
    }
}

// Enhanced Game Manager with GitHub Storage
class GameManagerWithGitHub {
    constructor() {
        this.storage = new GitHubStorage();
        this.games = [];
        this.members = [];
        this.gameToDelete = null;
        this.isLoading = false;
        this.autoRefreshInterval = null;
        console.log('GameManagerWithGitHub constructor called');
    }

    async init() {
        console.log('Initializing GameManagerWithGitHub...');
        
        // Check if token is already stored in localStorage
        let token = localStorage.getItem('github_token');
        
        if (!token) {
            // Prompt user for token
            token = prompt('Please enter your GitHub Personal Access Token:');
            if (token) {
                localStorage.setItem('github_token', token);
            } else {
                console.error('GitHub token is required for this application to work.');
                this.showNotification('GitHub token is required. Please refresh and enter your token.', 'error');
                return;
            }
        }
        
        this.storage.setToken(token);
        
        this.setupEventListeners();
        await this.loadData();
        this.renderGames();
        this.updateEmptyState();
        this.startAutoRefresh();
        console.log('GameManagerWithGitHub initialized successfully');
    }

    async loadData() {
        try {
            this.isLoading = true;
            this.showLoadingState();
            
            // Load games and members in parallel
            const [games, members] = await Promise.all([
                this.storage.loadGames(),
                this.storage.loadMembers()
            ]);
            
            this.games = games;
            this.members = members;
            
            this.hideLoadingState();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Error loading data. Check your GitHub token and repository settings.', 'error');
            this.hideLoadingState();
        }
    }

    async saveData() {
        try {
            // Save games and members in parallel
            await Promise.all([
                this.storage.saveGames(this.games),
                this.storage.saveMembers(this.members)
            ]);
        } catch (error) {
            console.error('Error saving data:', error);
            this.showNotification('Error saving data. Please try again.', 'error');
        }
    }

    async addGame(gameData) {
        try {
            const game = {
                id: Date.now().toString(),
                name: gameData.name,
                description: gameData.description,
                genre: gameData.genre,
                completed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                issues: {
                    bug: [],
                    controls: [],
                    quest: [],
                    review: []
                }
            };

            this.games.push(game);
            await this.saveData();
            this.renderGames();
            this.updateEmptyState();
            this.showNotification('Game created successfully!', 'success');
        } catch (error) {
            console.error('Error adding game:', error);
            this.showNotification('Error creating game. Please try again.', 'error');
        }
    }

    async addMember(memberData) {
        try {
            const member = {
                id: Date.now().toString(),
                name: memberData.name,
                role: memberData.role,
                email: memberData.email,
                createdAt: new Date().toISOString()
            };

            this.members.push(member);
            await this.saveData();
            this.showNotification('Team member added successfully!', 'success');
        } catch (error) {
            console.error('Error adding member:', error);
            this.showNotification('Error adding member. Please try again.', 'error');
        }
    }

    async toggleGameComplete(gameId) {
        try {
            const game = this.games.find(g => g.id === gameId);
            if (game) {
                game.completed = !game.completed;
                game.updatedAt = new Date().toISOString();
                await this.saveData();
                this.renderGames();
                this.showNotification(
                    game.completed ? 'Game marked as completed!' : 'Game marked as active!', 
                    'success'
                );
            }
        } catch (error) {
            console.error('Error toggling game completion:', error);
            this.showNotification('Error updating game. Please try again.', 'error');
        }
    }

    async deleteGame(gameId) {
        this.gameToDelete = gameId;
        const game = this.games.find(g => g.id === gameId);
        if (game) {
            document.getElementById('deleteGameName').textContent = game.name;
            document.getElementById('deleteGameModal').classList.add('active');
        }
    }

    async confirmDeleteGame() {
        if (this.gameToDelete) {
            try {
                // Remove from local array
                this.games = this.games.filter(g => g.id !== this.gameToDelete);
                
                // Save updated games list
                await this.saveData();
                
                this.renderGames();
                this.updateEmptyState();
                this.closeModal('deleteGameModal');
                this.showNotification('Game deleted successfully!', 'success');
                this.gameToDelete = null;
            } catch (error) {
                console.error('Error deleting game:', error);
                this.showNotification('Error deleting game. Please try again.', 'error');
            }
        }
    }

    getGameStats(gameId) {
        const game = this.games.find(g => g.id === gameId);
        if (!game) return { total: 0, open: 0, completed: 0 };

        const allIssues = [
            ...game.issues.bug,
            ...game.issues.controls,
            ...game.issues.quest,
            ...game.issues.review
        ];

        return {
            total: allIssues.length,
            open: allIssues.filter(issue => issue.status !== 'completed').length,
            completed: allIssues.filter(issue => issue.status === 'completed').length
        };
    }

    renderGames() {
        const container = document.getElementById('gamesContainer');
        
        if (this.games.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="games-grid">
                ${this.games.map(game => {
                    const stats = this.getGameStats(game.id);
                    return `
                        <div class="game-card ${game.completed ? 'completed' : ''}" onclick="window.gameManager.openGame('${game.id}')">
                            <div class="game-actions">
                                <button class="action-btn ${game.completed ? 'complete' : 'complete'}" 
                                        onclick="event.stopPropagation(); window.gameManager.toggleGameComplete('${game.id}')"
                                        title="${game.completed ? 'Mark as Active' : 'Mark as Complete'}">
                                    <i class="fas ${game.completed ? 'fa-undo' : 'fa-check'}"></i>
                                </button>
                                <button class="action-btn delete" 
                                        onclick="event.stopPropagation(); window.gameManager.deleteGame('${game.id}')"
                                        title="Delete Game">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                            <h3>${game.name}</h3>
                            <p class="game-description">${game.description || 'No description'}</p>
                            
                            <div class="game-stats">
                                <div class="stat">
                                    <span class="stat-number">${stats.total}</span>
                                    <span class="stat-label">Total</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-number">${stats.open}</span>
                                    <span class="stat-label">Open</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-number">${stats.completed}</span>
                                    <span class="stat-label">Done</span>
                                </div>
                            </div>

                            ${game.genre ? `
                                <div class="game-categories">
                                    <span class="category-tag">${game.genre}</span>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    updateEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const gamesContainer = document.getElementById('gamesContainer');
        
        if (this.games.length === 0) {
            emptyState.style.display = 'block';
            gamesContainer.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            gamesContainer.style.display = 'block';
        }
    }

    openGame(gameId) {
        localStorage.setItem('currentGameId', gameId);
        window.location.href = 'game-design-review.html';
    }

    // Auto-refresh functionality
    startAutoRefresh() {
        // Clear any existing interval
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Start new interval - refresh every 30 seconds
        this.autoRefreshInterval = setInterval(async () => {
            if (!this.isLoading) {
                console.log('Auto-refreshing data from GitHub...');
                await this.loadData();
                this.renderGames();
                this.updateEmptyState();
            }
        }, 30000); // 30 seconds

        console.log('Auto-refresh started - will refresh every 30 seconds');
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            console.log('Auto-refresh stopped');
        }
    }

    showLoadingState() {
        const container = document.getElementById('gamesContainer');
        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading data from GitHub...</p>
            </div>
        `;
    }

    hideLoadingState() {
        this.isLoading = false;
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Add Game button
        const addGameBtn = document.getElementById('addGameBtn');
        if (addGameBtn) {
            addGameBtn.addEventListener('click', () => {
                console.log('Add Game button clicked');
                document.getElementById('addGameModal').classList.add('active');
            });
        } else {
            console.error('Add Game button not found');
        }

        // Create First Game button
        const createFirstGameBtn = document.getElementById('createFirstGameBtn');
        if (createFirstGameBtn) {
            createFirstGameBtn.addEventListener('click', () => {
                console.log('Create First Game button clicked');
                document.getElementById('addGameModal').classList.add('active');
            });
        } else {
            console.error('Create First Game button not found');
        }

        // Add Member button
        const addMemberBtn = document.getElementById('addMemberBtn');
        if (addMemberBtn) {
            addMemberBtn.addEventListener('click', () => {
                console.log('Add Member button clicked');
                document.getElementById('addMemberModal').classList.add('active');
            });
        } else {
            console.error('Add Member button not found');
        }

        // Add Game form
        const addGameForm = document.getElementById('addGameForm');
        if (addGameForm) {
            addGameForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Add Game form submitted');
                const formData = {
                    name: document.getElementById('gameName').value,
                    description: document.getElementById('gameDescription').value,
                    genre: document.getElementById('gameGenre').value
                };
                
                this.addGame(formData);
                this.closeModal('addGameModal');
                document.getElementById('addGameForm').reset();
            });
        } else {
            console.error('Add Game form not found');
        }

        // Add Member form
        const addMemberForm = document.getElementById('addMemberForm');
        if (addMemberForm) {
            addMemberForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Add Member form submitted');
                const formData = {
                    name: document.getElementById('memberName').value,
                    role: document.getElementById('memberRole').value,
                    email: document.getElementById('memberEmail').value
                };
                
                this.addMember(formData);
                this.closeModal('addMemberModal');
                document.getElementById('addMemberForm').reset();
            });
        } else {
            console.error('Add Member form not found');
        }

        // Refresh on window focus (when user returns to tab)
        window.addEventListener('focus', async () => {
            if (!this.isLoading) {
                console.log('Window focused - refreshing data...');
                await this.loadData();
                this.renderGames();
                this.updateEmptyState();
            }
        });

        // Stop auto-refresh when page is hidden (saves API calls)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAutoRefresh();
            } else {
                this.startAutoRefresh();
            }
        });

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('active');
            }
        });
        
        console.log('Event listeners setup complete');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }
}

// Global functions
function closeModal(modalId) {
    if (window.gameManager) {
        window.gameManager.closeModal(modalId);
    }
}

// CSS for loading state
const loadingStyles = `
<style>
.loading-state {
    text-align: center;
    padding: 4rem 2rem;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 1.5rem;
    border: 2px solid rgba(226, 232, 240, 0.5);
}

.loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid #e2e8f0;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.auto-refresh-indicator {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    background: rgba(16, 185, 129, 0.9);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 2rem;
    font-size: 0.75rem;
    font-weight: 600;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
`;

// Add loading styles to document
document.head.insertAdjacentHTML('beforeend', loadingStyles);