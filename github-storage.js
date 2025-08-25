// GitHub Storage System for Game Design Review
class GitHubStorage {
    constructor() {
        this.token = 'YOUR_GITHUB_TOKEN'; // Replace with your token
        this.owner = 'YOUR_USERNAME'; // Replace with your GitHub username
        this.repo = 'game-review-data'; // Your repository name
        this.baseUrl = 'https://api.github.com';
    }

    // Helper method to make GitHub API requests
    async makeRequest(endpoint, options = {}) {
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

    // Load specific game data
    async loadGameData(gameId) {
        try {
            const gameData = await this.getFile(`data/games/${gameId}.json`);
            return gameData || null;
        } catch (error) {
            console.error('Error loading game data:', error);
            return null;
        }
    }

    // Save specific game data
    async saveGameData(gameId, gameData) {
        try {
            await this.putFile(`data/games/${gameId}.json`, gameData, `Update game ${gameId}`);
            return true;
        } catch (error) {
            console.error('Error saving game data:', error);
            return false;
        }
    }

    // Delete a game
    async deleteGame(gameId) {
        try {
            // Get the file to get its SHA
            const file = await this.makeRequest(`/repos/${this.owner}/${this.repo}/contents/data/games/${gameId}.json`);
            
            await this.makeRequest(`/repos/${this.owner}/${this.repo}/contents/data/games/${gameId}.json`, {
                method: 'DELETE',
                body: JSON.stringify({
                    message: `Delete game ${gameId}`,
                    sha: file.sha
                })
            });

            return true;
        } catch (error) {
            console.error('Error deleting game:', error);
            return false;
        }
    }

    // Get repository info (useful for debugging)
    async getRepoInfo() {
        try {
            const response = await this.makeRequest(`/repos/${this.owner}/${this.repo}`);
            return response;
        } catch (error) {
            console.error('Error getting repo info:', error);
            return null;
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
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadData();
        this.renderGames();
        this.updateEmptyState();
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
                
                // Optionally delete the individual game file
                // await this.storage.deleteGame(this.gameToDelete);
                
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

    // ... rest of the methods remain the same as before ...

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

    // ... rest of the existing methods ...
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
</style>
`;

// Add loading styles to document
document.head.insertAdjacentHTML('beforeend', loadingStyles);